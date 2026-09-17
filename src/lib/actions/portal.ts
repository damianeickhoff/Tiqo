"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { moveOnRequesterReply } from "@/lib/reply-status";
import { refreshTicket } from "@/lib/refresh";
import { recordReferences } from "@/lib/record-references";
import { linkBareReferences } from "@/lib/link-references";
import { literal } from "@/lib/markdown-ast";
import { uploadProblem, uploadsFrom } from "@/lib/attachments";
import { saveUploads } from "@/lib/files";
import { findBlockedWord, getMessages, getSettings } from "@/lib/settings";
import { formatReference, referenceBucket } from "@/lib/tickets";
import { copyPlanOnto } from "@/lib/actions/steps";
import { articleMatches, portalSearch, type SearchHit } from "@/lib/portal";
import { localised, readerLocale } from "@/lib/portal-locale";
import type { FormState } from "@/lib/actions/auth";

/** The portal search box, from the client. Scoped to what is published: an
 *  unpublished article or a hidden form is not findable by anyone. */
export async function searchPortal(query: string): Promise<SearchHit[]> {
  await requireUser();
  return portalSearch(query);
}

/**
 * Answers that look like they might be about what someone is typing.
 *
 * Offered while the subject is being written rather than as a fixed shelf above
 * the form: a list of the section's most-read articles is decoration, but "this
 * one is about the thing you just described" is a reason not to raise a ticket
 * at all.
 */
export async function suggestAnswers(query: string): Promise<SearchHit[]> {
  await requireUser();
  if (query.trim().length < 5) return [];
  return articleMatches(query, 3);
}

/**
 * One suggested answer, read in place.
 *
 * The reader is halfway through describing a problem; sending them to the
 * article means losing the form. So the answer comes to them — the words of it
 * only, without the related-answers shelf or the "still stuck" cards, because
 * those are ways out of an article and this reader already has one behind them.
 */
export async function readAnswer(slug: string) {
  const user = await requireUser();

  const article = await prisma.portalArticle.findUnique({
    where: { slug },
    select: {
      title: true,
      summary: true,
      body: true,
      isPublished: true,
      translations: { select: { locale: true, title: true, summary: true, body: true } },
    },
  });
  if (!article || !article.isPublished) return null;

  const locale = await readerLocale(user);
  return localised(
    { title: article.title, summary: article.summary, body: article.body },
    article.translations,
    locale,
  );
}

/* --------------------------------------------------------------- submitting -- */

/**
 * Raising a ticket from a form.
 *
 * Answers become the ticket: the fields mapped to a title and a description
 * fill those, and every other answer is appended as a labelled line. Nothing a
 * person typed is ever dropped — a form that quietly loses an answer is worse
 * than no form.
 */
export async function submitForm(
  formId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const [user, t, settings] = await Promise.all([requireUser(), getMessages(), getSettings()]);
  if (!settings.portalEnabled) return { errors: { form: t.errors.portalClosed } };

  const form = await prisma.portalForm.findUnique({
    where: { id: formId },
    select: {
      id: true,
      name: true,
      isActive: true,
      type: true,
      priority: true,
      teamId: true,
      projectId: true,
      planId: true,
      confirmation: true,
      slug: true,
      fields: { orderBy: { position: "asc" } },
    },
  });
  if (!form || !form.isActive) return { errors: { form: t.errors.formGone } };

  // A hidden question is not asked, so it is neither required nor recorded.
  const answered = new Map<string, string>();
  for (const field of form.fields) {
    answered.set(
      field.id,
      field.kind === "CHECKBOX"
        ? formData.get(field.id) === "on"
          ? t.common.yes
          : t.common.no
        : String(formData.get(field.id) ?? "").trim(),
    );
  }

  const visible = (field: (typeof form.fields)[number]) =>
    !field.showWhenFieldId ||
    (answered.get(field.showWhenFieldId) ?? "") === (field.showWhenValue ?? "");

  const answers = form.fields.filter(visible).map((field) => ({
    field,
    value: answered.get(field.id) ?? "",
  }));

  const missing = answers.find(
    ({ field, value }) => field.required && field.kind !== "CHECKBOX" && !value,
  );
  if (missing) return { errors: { [missing.field.id]: t.errors.fieldRequired } };

  const title =
    answers.find(({ field }) => field.target === "TITLE")?.value.slice(0, 160) || form.name;

  // Every answer arrives under the question it answers. Without the labels an
  // operator reads three unattributed paragraphs and has to open the form in
  // another tab to work out which is which — and "what did they actually ask
  // for" is the whole reason the ticket exists.
  //
  // What the requester wrote is escaped, not merely typed into a plain box: the
  // desk reads it through the same Markdown renderer as everything else, so
  // "# urgent" would arrive as a heading however plain the field was. The
  // labels are the desk's own words and are left as written.
  const body = answers
    .filter(({ field, value }) => field.target !== "TITLE" && value)
    .map(({ field, value }) => {
      // A question with no label predates the rule that every question has
      // one. Better a bare answer than an empty pair of asterisks.
      const label = field.label.trim();
      if (!label) return literal(value);
      return field.target === "DESCRIPTION"
        ? `**${literal(label)}**\n\n${literal(value)}`
        : `**${literal(label)}**: ${literal(value)}`;
    })
    .join("\n\n");

  const blocked = await findBlockedWord(`${title} ${body}`);
  if (blocked) return { errors: { form: t.errors.blocked } };

  // Checked before the ticket exists, so a file that is too big costs nothing
  // more than a corrected form.
  const uploads = uploadsFrom(formData);
  const fileProblem = uploadProblem(uploads, t);
  if (fileProblem) return { errors: { files: fileProblem } };

  const filedAt = new Date();
  const bucket = referenceBucket(form.type, filedAt);

  const created = await prisma.$transaction(async (tx) => {
    const [counter, sequence] = await Promise.all([
      tx.counter.upsert({
        where: { id: "ticket" },
        update: { value: { increment: 1 } },
        create: { id: "ticket", value: 1 },
        select: { value: true },
      }),
      tx.counter.upsert({
        where: { id: bucket.key },
        update: { value: { increment: 1 } },
        create: { id: bucket.key, value: 1 },
        select: { value: true },
      }),
    ]);

    const status = await tx.status.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });

    const ticket = await tx.ticket.create({
      data: {
        number: counter.value,
        reference: formatReference(form.type, filedAt, sequence.value),
        title,
        description: body,
        statusId: status?.id ?? null,
        priority: form.priority,
        type: form.type,
        projectId: form.projectId,
        teamId: form.teamId,
        reporterId: user.id,
        createdById: user.id,
        portalFormId: form.id,
      },
      select: { id: true, number: true },
    });

    await tx.activity.create({
      data: { ticketId: ticket.id, actorId: user.id, type: "CREATED" },
    });

    return ticket;
  });

  // Outside the transaction, and never undoing the request: a disk that cannot
  // be written to is the desk's problem to fix, and undoing a request that has
  // already taken a reference number would be a worse answer to it than one
  // raised without its screenshot.
  // No picture is ever placed in a portal body: the boxes here are plain and
  // everything typed into them is escaped, deliberately. A requester's
  // screenshot becomes an attachment, which is the whole of what they meant.
  if (uploads.length) await saveUploads(uploads, { ticketId: created.id }, user.id);

  // A change raised through the portal still follows its plan.
  if (form.type === "CHANGE" && form.planId) {
    await copyPlanOnto(created.id, form.planId, user.id);
  }

  revalidatePath("/tickets");
  revalidatePath("/portal/requests");
  redirect(`/portal/requests/${created.number}?new=1`);
}

/** A requester answering on their own ticket, from the portal. */
export async function replyFromPortal(
  ticketId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      number: true,
      reporterId: true,
      assigneeId: true,
      statusId: true,
      pausedMinutes: true,
      pausedSince: true,
    },
  });
  if (!ticket) return { errors: { form: t.errors.ticketGone } };
  // The portal is for your own requests, and only your own.
  if (ticket.reporterId !== user.id) return { errors: { form: t.errors.noComment } };

  const written = String(formData.get("body") ?? "").trim();
  if (!written) return { errors: { body: t.errors.writeSomething } };
  if (await findBlockedWord(written)) return { errors: { body: t.errors.blocked } };

  // Escaped rather than parsed: the box on the portal is a plain one, and a
  // requester who types "# 2 broken" means a hash and a two, not a heading.
  // The desk reads every comment through the same Markdown renderer, so the
  // escaping has to happen here rather than in the component.
  const body = await linkBareReferences(literal(written));

  const uploads = uploadsFrom(formData);
  const fileProblem = uploadProblem(uploads, t);
  if (fileProblem) return { errors: { files: fileProblem } };

  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: { ticketId: ticket.id, authorId: user.id, body, isInternal: false },
      select: { id: true },
    }),
    prisma.activity.create({
      data: { ticketId: ticket.id, actorId: user.id, type: "COMMENTED" },
    }),
  ]);

  const stored = uploads.length
    ? await saveUploads(uploads, { ticketId: ticket.id, commentId: comment.id }, user.id)
    : [];

  await recordReferences({ body, actorId: user.id, ticketId: ticket.id });

  // Answering is what takes the ticket off "waiting on user" and starts the
  // clock again — the same rule as a reply written from the desk.
  const moved = await moveOnRequesterReply(ticket);
  if (moved) {
    await prisma.activity.create({ data: { ...moved, ticketId: ticket.id, actorId: user.id } });
  }

  // The desk hears about it. This is the notification that matters most on a
  // service desk — the requester has come back with something — and it was the
  // one path that wrote the comment without telling anyone.
  await notify({
    userId: ticket.assigneeId,
    actorId: user.id,
    ticketId: ticket.id,
    kind: "COMMENTED",
  });

  refreshTicket(ticket.number);

  // Said last, because everything above it did happen. The reply is on the
  // request; only the files are not, and somebody who attached one deserves to
  // be told rather than to find out by looking.
  if (uploads.length && stored.length === 0) return { errors: { files: t.errors.uploadFailed } };
  return {};
}

/**
 * Whether an answer solved it, from the person who just read it.
 *
 * One row per person, replaced rather than added to: changing your mind should
 * correct the tally, not vote twice. The portal is signed in, so there is a
 * person to hang the vote on — no cookie, no way to stuff it.
 */
export async function voteOnArticle(articleId: string, helpful: boolean) {
  const user = await requireUser();

  const article = await prisma.portalArticle.findUnique({
    where: { id: articleId },
    select: { slug: true, isPublished: true },
  });
  // An answer nobody can read is not one anybody can rate.
  if (!article?.isPublished) return { ok: false as const };

  await prisma.portalArticleVote.upsert({
    where: { articleId_userId: { articleId, userId: user.id } },
    update: { helpful, createdAt: new Date() },
    create: { articleId, userId: user.id, helpful },
  });

  revalidatePath(`/portal/kb/${article.slug}`);
  return { ok: true as const };
}
