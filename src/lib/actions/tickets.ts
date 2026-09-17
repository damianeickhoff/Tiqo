"use server";

import { revalidatePath } from "next/cache";
import { refreshTicket } from "@/lib/refresh";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  can,
  canComment,
  canDeleteComment,
  canEditComment,
  canEditCis,
  canEditTicket,
  canViewTicket,
  canWriteInternalNote,
  ticketVisibilityFilter,
} from "@/lib/permissions";
import {
  commentSchema,
  createTicketSchema,
  fieldErrors,
  updateTicketSchema,
} from "@/lib/validation";
import type { ActivityType } from "@/generated/prisma/enums";
import { formatReference, pauseFields, referenceBucket } from "@/lib/tickets";
import { findBlockedWord, getClock, getMessages } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { mailPublicReply, mailStatusChange } from "@/lib/mail";
import { moveOnRequesterReply } from "@/lib/reply-status";
import { recordReferences } from "@/lib/record-references";
import { linkBareReferences } from "@/lib/link-references";
import { linkEntry } from "@/lib/ticket-links";
import { copyPlanOnto } from "@/lib/actions/steps";
import { resolveDraftImages, uploadProblem, uploadsFrom } from "@/lib/attachments";
import { purgeUploads, saveUploads } from "@/lib/files";
import type { FormState } from "@/lib/actions/auth";

type ActivityInput = {
  type: ActivityType;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
};

export async function createTicket(_prev: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const rawDue = String(formData.get("dueDate") ?? "").trim();
  const parsed = createTicketSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    // "No project" submits an empty string; it has to become null or the
    // foreign key rejects it.
    projectId: emptyToNull(formData.get("projectId")),
    milestoneId: emptyToNull(formData.get("milestoneId")),
    priority: formData.get("priority") ?? "MEDIUM",
    type: formData.get("type") ?? "QUESTION",
    reporterId: emptyToNull(formData.get("reporterId")),
    assigneeId: emptyToNull(formData.get("assigneeId")),
    labelIds: formData.getAll("labelIds").map(String),
    planId: formData.get("planId"),
    dueDate: rawDue === "" ? null : rawDue,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error, t) };

  const input = parsed.data;

  // A change follows a plan — but only where the desk has written one. Making
  // it required with nothing to choose from would simply stop changes being
  // raised at all.
  let planId: string | null = null;
  if (input.type === "CHANGE" && canEditTicket(user)) {
    const usable = await prisma.changeTemplate.count({ where: { steps: { some: {} } } });
    if (usable > 0) {
      if (!input.planId) return { errors: { planId: t.errors.pickPlan } };
      planId = input.planId;
    }
  }

  if (await findBlockedWord(`${input.title} ${input.description}`)) {
    return { errors: { title: t.errors.blocked } };
  }

  // Checked before the ticket exists, so a file that is too big costs nothing
  // more than a corrected form.
  const uploads = uploadsFrom(formData);
  const fileKeys = formData.getAll("fileKeys").map(String);
  const fileProblem = uploadProblem(uploads, t);
  if (fileProblem) return { errors: { files: fileProblem } };

  // Requesters may raise tickets but never pre-assign or pre-triage them, and
  // they can only raise one for themselves. Agents may file on someone's behalf.
  const assigneeId = canEditTicket(user) ? input.assigneeId : null;

  let reporterId = user.id;
  let onBehalfOfName: string | null = null;
  if (canEditTicket(user) && input.reporterId && input.reporterId !== user.id) {
    const onBehalfOf = await prisma.user.findFirst({
      where: { id: input.reporterId, isActive: true },
      select: { id: true, name: true },
    });
    if (!onBehalfOf) return { errors: { reporterId: t.errors.personInactive } };
    reporterId = onBehalfOf.id;
    onBehalfOfName = onBehalfOf.name;
  }
  const assigneeName = assigneeId
    ? (await prisma.user.findUnique({ where: { id: assigneeId }, select: { name: true } }))?.name
    : null;

  // Raised from another ticket's Links card. Read from the register rather
  // than trusted from the form, and behind the same permission the link action
  // is: a hidden field is a suggestion, not a fact.
  const parentId = String(formData.get("parentId") ?? "").trim();
  const parent =
    parentId && canEditTicket(user)
      ? await prisma.ticket.findFirst({
          where: { id: parentId, mergedIntoId: null, ...ticketVisibilityFilter(user) },
          select: { id: true, number: true, reference: true, teamId: true },
        })
      : null;

  const filedAt = new Date();
  const bucket = referenceBucket(input.type, filedAt);

  // Where a ticket starts, per the desk's own settings. Null is survivable: the
  // ticket exists and shows as having no status, which someone can then set.
  const startingStatus = await prisma.status.findFirst({
    where: { isDefault: true },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  const description = await linkBareReferences(input.description);

  const created = await prisma.$transaction(async (tx) => {
    // Both counters are bumped inside the transaction, so two agents filing at
    // once can take neither the same number nor the same reference. The global
    // one feeds the URL; the per-type-per-month one feeds the reference.
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

    const ticket = await tx.ticket.create({
      data: {
        number: counter.value,
        reference: formatReference(input.type, filedAt, sequence.value),
        title: input.title,
        description,
        statusId: startingStatus?.id ?? null,
        priority: input.priority,
        type: input.type,
        projectId: input.projectId,
        // A child is worked by whoever works its parent. Taken from the parent
        // row, because the form has no team control to have asked for it.
        teamId: parent?.teamId ?? null,
        // Only when it really belongs to the project chosen: a stale value from
        // a switched dropdown would file work under the wrong plan.
        milestoneId: input.projectId ? input.milestoneId : null,
        reporterId,
        createdById: user.id,
        assigneeId,
        dueDate: input.dueDate,
        labels: { connect: input.labelIds.map((id) => ({ id })) },
      },
      select: { id: true, number: true, reference: true },
    });

    await tx.activity.createMany({
      data: [
        {
          ticketId: ticket.id,
          actorId: user.id,
          type: "CREATED",
          // Records the on-behalf-of case so the trail says who it was for.
          ...(onBehalfOfName ? { field: "reporter", newValue: onBehalfOfName } : {}),
        },
        ...(assigneeId
          ? [
              {
                ticketId: ticket.id,
                actorId: user.id,
                type: "ASSIGNED" as ActivityType,
                field: "assignee",
                newValue: assigneeName ?? null,
              },
            ]
          : []),
      ],
    });

    // The link the Links card promised, written in the same transaction as the
    // ticket: a child that exists without the statement it was raised to make
    // is a ticket nobody can find from the work it belongs to.
    if (parent) {
      await tx.ticketLink.create({
        data: {
          kind: "PARENT_OF",
          sourceId: parent.id,
          targetId: ticket.id,
          createdById: user.id,
        },
      });
      await tx.activity.createMany({
        data: [
          linkEntry("LINKED", "PARENT_OF", { on: parent, far: ticket, incoming: false }, user.id),
          linkEntry("LINKED", "PARENT_OF", { on: ticket, far: parent, incoming: true }, user.id),
        ],
      });
    }

    return { number: ticket.number, id: ticket.id };
  });

  // Outside the transaction: neither a plan nor a notification is worth undoing
  // a ticket over. Nor are the files — a disk that cannot be written to is a
  // problem for the desk to fix, and undoing a ticket that has already taken a
  // reference number would be a worse answer to it than one raised without its
  // screenshot.
  const stored = uploads.length
    ? await saveUploads(uploads, { ticketId: created.id }, user.id)
    : [];

  // A picture placed in the description pointed at a draft key, because the
  // file had no address until a moment ago. The rewrite is a second write
  // rather than part of the transaction: the ids only exist once the bytes
  // are down, and a description is not worth undoing a numbered ticket over.
  // Run whatever happened to the files, because a token left standing is a
  // token stored, and `attachment:` in a saved body points at nothing for ever.
  const resolved = resolveDraftImages(description, fileKeys, stored);
  if (resolved !== description) {
    await prisma.ticket.update({ where: { id: created.id }, data: { description: resolved } });
  }

  if (planId) await copyPlanOnto(created.id, planId, user.id);

  // The assets the form named. Checked against the register rather than
  // trusted from the form, and gated on the same permission the picker is: a
  // ticket that quietly filed itself against three servers the person could
  // not have chosen is a register nobody can believe.
  const ciIds = [...new Set(formData.getAll("ciIds").map(String).filter(Boolean))];
  if (ciIds.length && canEditCis(user)) {
    const items = await prisma.configurationItem.findMany({
      where: { id: { in: ciIds } },
      select: { id: true, name: true },
    });

    if (items.length) {
      await prisma.$transaction([
        prisma.ticketCi.createMany({
          data: items.map((item) => ({ ticketId: created.id, itemId: item.id })),
        }),
        prisma.activity.createMany({
          data: items.map((item) => ({
            ticketId: created.id,
            actorId: user.id,
            type: "CI_ADDED" as const,
            field: "ci",
            newValue: item.name,
            link: `/cmdb/${item.id}`,
          })),
        }),
      ]);
    }
  }

  await notify({ userId: assigneeId, actorId: user.id, ticketId: created.id, kind: "ASSIGNED" });

  // The parent's own page is now a link out of date.
  if (parent) refreshTicket(parent.number);

  revalidatePath("/tickets");
  redirect(`/tickets/${created.number}`);
}

const patchSchema = updateTicketSchema;

export async function updateTicket(
  ticketId: string,
  patch: z.input<typeof patchSchema>,
  /// Said once, then stood down. The graph knows this ticket is holding
  /// something up; it does not know the desk has already dealt with it, so the
  /// second press goes through rather than arguing twice. Here rather than only
  /// on the toolbar, because the properties card sets the same status by a
  /// different route and the warning has to reach both.
  anyway = false,
) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false as const, error: t.errors.invalidChange };

  const current = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      number: true,
      title: true,
      description: true,
      statusId: true,
      status: { select: { name: true, settles: true, pausesClock: true } },
      pausedMinutes: true,
      pausedSince: true,
      priority: true,
      type: true,
      assigneeId: true,
      assignee: { select: { name: true } },
      projectId: true,
      project: { select: { name: true } },
      teamId: true,
      team: { select: { name: true } },
      reporterId: true,
      dueDate: true,
      labels: { select: { id: true, name: true } },
    },
  });
  if (!current) return { ok: false as const, error: t.errors.ticketGone };

  const editingOwnDraft =
    current.reporterId === user.id &&
    Object.keys(parsed.data).every((k) => k === "title" || k === "description");

  if (!canEditTicket(user) && !editingOwnDraft) {
    return { ok: false as const, error: t.errors.noTicketChange };
  }

  const words = [parsed.data.title, parsed.data.description].filter(
    (value) => typeof value === "string",
  );
  if (words.length > 0 && (await findBlockedWord(words.join(" ")))) {
    return { ok: false as const, error: t.errors.blocked };
  }

  const data: Record<string, unknown> = {};
  const activities: ActivityInput[] = [];
  /// Who the ticket ends up with, when that is what changed.
  let assignedTo: string | null = null;
  /// Where it ends up, when that is what changed — the requester is mailed it.
  let movedTo: string | null = null;
  const p = parsed.data;

  if (p.title !== undefined && p.title !== current.title) {
    data.title = p.title;
    activities.push({
      type: "TITLE_CHANGED",
      field: "title",
      oldValue: current.title,
      newValue: p.title,
    });
  }

  if (p.description !== undefined && p.description !== current.description) {
    data.description = await linkBareReferences(p.description);
    activities.push({ type: "DESCRIPTION_CHANGED", field: "description" });
  }

  if (p.statusId !== undefined && p.statusId !== current.statusId) {
    const next = p.statusId
      ? await prisma.status.findUnique({
          where: { id: p.statusId },
          select: { name: true, settles: true, pausesClock: true },
        })
      : null;

    // A ticket cannot leave the queue with nobody's name on it. Work that was
    // finished was finished by someone, and a settled ticket with no assignee
    // is a hole in every report that asks who did what — and in every
    // conversation that starts "who dealt with this?".
    //
    // The team is not a substitute: a group is where work is sent, a person is
    // who answered for it.
    const assigneeAfter = p.assigneeId === undefined ? current.assigneeId : p.assigneeId;
    if (next?.settles && !assigneeAfter) {
      return { ok: false as const, error: t.errors.settleNeedsAssignee };
    }

    // What taking this off the queue would leave hanging. Asked of any status
    // that settles rather than of the Close button: a desk that resolves things
    // by picking "Resolved" from the properties card would never see it
    // otherwise, and the ticket waiting on this one is just as stuck either way.
    //
    // Named only where the person can read them — a warning about a ticket they
    // cannot open tells them nothing they can act on.
    if (next?.settles && !anyway) {
      const holding = await prisma.ticketLink.findMany({
        where: {
          kind: "BLOCKS",
          sourceId: ticketId,
          target: { status: { is: { settles: false } }, ...ticketVisibilityFilter(user) },
        },
        select: { target: { select: { reference: true } } },
      });

      if (holding.length > 0) {
        return {
          ok: false as const,
          error: t.ticket.stillBlocking(holding.map((link) => link.target.reference).join(", ")),
          warn: true as const,
        };
      }
    }

    data.statusId = p.statusId;

    // The timestamps follow `settles`, not a particular status: they are set
    // when a ticket first comes off the queue and cleared if it goes back on,
    // otherwise the heat spine would freeze at the wrong moment.
    const settledAt = next?.settles ? new Date() : null;
    data.resolvedAt = settledAt;
    data.closedAt = settledAt;

    // Moving into or out of a status that stops the clock banks the pause.
    Object.assign(data, pauseFields(current.status, next, current, (await getClock()).hours));

    movedTo = next?.name ?? null;

    activities.push({
      type: "STATUS_CHANGED",
      field: "status",
      oldValue: current.status?.name ?? null,
      newValue: next?.name ?? null,
    });
  }

  if (p.priority !== undefined && p.priority !== current.priority) {
    data.priority = p.priority;
    activities.push({
      type: "PRIORITY_CHANGED",
      field: "priority",
      oldValue: current.priority,
      newValue: p.priority,
    });
  }

  if (p.type !== undefined && p.type !== current.type) {
    data.type = p.type;
    activities.push({
      type: "TYPE_CHANGED",
      field: "type",
      oldValue: current.type,
      newValue: p.type,
    });
  }

  if (p.assigneeId !== undefined && p.assigneeId !== current.assigneeId) {
    // Activities store names, not ids: the trail has to stay readable even after
    // an account is deleted, and it is never used to look anything up.
    const next = p.assigneeId
      ? await prisma.user.findUnique({ where: { id: p.assigneeId }, select: { name: true } })
      : null;

    data.assigneeId = p.assigneeId;
    // Told after the write lands, below, so a refused update tells nobody.
    assignedTo = p.assigneeId;
    activities.push({
      type: p.assigneeId ? "ASSIGNED" : "UNASSIGNED",
      field: "assignee",
      oldValue: current.assignee?.name ?? null,
      newValue: next?.name ?? null,
    });
  }

  if (p.projectId !== undefined && p.projectId !== current.projectId) {
    const next = p.projectId
      ? await prisma.project.findUnique({ where: { id: p.projectId }, select: { name: true } })
      : null;

    data.projectId = p.projectId;
    activities.push({
      type: "PROJECT_CHANGED",
      field: "project",
      oldValue: current.project?.name ?? null,
      newValue: next?.name ?? null,
    });
  }

  // Handing work to another team is the escalation path, so it is recorded
  // like any other move rather than happening quietly.
  if (p.teamId !== undefined && p.teamId !== current.teamId) {
    const next = p.teamId
      ? await prisma.team.findUnique({ where: { id: p.teamId }, select: { name: true } })
      : null;

    data.teamId = p.teamId;
    activities.push({
      type: "TEAM_CHANGED",
      field: "team",
      oldValue: current.team?.name ?? null,
      newValue: next?.name ?? null,
    });
  }

  const oldDue = current.dueDate?.toISOString() ?? null;
  const newDue = p.dueDate?.toISOString() ?? null;
  if (p.dueDate !== undefined && newDue !== oldDue) {
    data.dueDate = p.dueDate;
    activities.push({
      type: "DUE_DATE_CHANGED",
      field: "dueDate",
      oldValue: oldDue,
      newValue: newDue,
    });
  }

  if (p.labelIds !== undefined) {
    const before = new Set(current.labels.map((l) => l.id));
    const after = new Set(p.labelIds);
    const added = p.labelIds.filter((id) => !before.has(id));
    const removed = current.labels.filter((l) => !after.has(l.id));

    if (added.length || removed.length) {
      const addedLabels = added.length
        ? await prisma.label.findMany({ where: { id: { in: added } }, select: { name: true } })
        : [];

      data.labels = { set: p.labelIds.map((id) => ({ id })) };
      for (const l of addedLabels) {
        activities.push({ type: "LABEL_ADDED", field: "label", newValue: l.name });
      }
      for (const l of removed) {
        activities.push({ type: "LABEL_REMOVED", field: "label", oldValue: l.name });
      }
    }
  }

  if (activities.length === 0) return { ok: true as const };

  await prisma.$transaction([
    prisma.ticket.update({ where: { id: ticketId }, data }),
    prisma.activity.createMany({
      data: activities.map((a) => ({ ...a, ticketId, actorId: user.id })),
    }),
  ]);

  await notify({ userId: assignedTo, actorId: user.id, ticketId, kind: "ASSIGNED" });

  // Where their request has got to, to the person who raised it. A status and a
  // public reply are the two things a requester should not have to sign in to
  // find out — and a ticket left without a status has nothing to tell them.
  if (movedTo) {
    await mailStatusChange({
      ticketId,
      actorId: user.id,
      status: movedTo,
      previous: current.status?.name ?? null,
    });
  }

  refreshTicket(current.number);
  return { ok: true as const };
}

export async function addComment(_prev: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  const ticketId = String(formData.get("ticketId") ?? "");

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
  if (!canComment(user, ticket)) return { errors: { form: t.errors.noComment } };

  const parsed = commentSchema.safeParse({
    body: formData.get("body"),
    isInternal: formData.get("isInternal") === "on",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error, t) };

  const blocked = await findBlockedWord(parsed.data.body);
  if (blocked) return { errors: { body: t.errors.blocked } };

  // Before anything is written, so a rejected post leaves nothing behind and
  // keeps every word that was typed.
  const uploads = uploadsFrom(formData);
  const fileKeys = formData.getAll("fileKeys").map(String);
  const fileProblem = uploadProblem(uploads, t);
  if (fileProblem) return { errors: { files: fileProblem } };

  // Resolved once, here, so everything downstream — the stored comment, the
  // trail, the notifications — sees one shape whether the reference was picked
  // from the list or pasted in.
  const body = await linkBareReferences(parsed.data.body);

  const isInternal = parsed.data.isInternal && canWriteInternalNote(user);

  // A comment written on one step of a change belongs to that step's own
  // conversation. The step is verified against this ticket rather than trusted
  // from the form.
  const postedStepId = String(formData.get("stepId") ?? "") || null;
  let stepId: string | null = null;
  if (postedStepId) {
    const step = await prisma.changeStep.findFirst({
      where: { id: postedStepId, ticketId: ticket.id },
      select: { id: true },
    });
    if (!step) return { errors: { form: t.errors.stepGone } };
    stepId = step.id;
  }

  // A reply inherits its parent's visibility: answering an internal note must
  // never produce a public comment quoting it. It inherits the parent's step
  // for the same reason — a reply belongs in the thread it answers.
  const parentId = String(formData.get("parentId") ?? "") || null;
  let inheritedInternal = isInternal;
  if (parentId) {
    const parent = await prisma.comment.findFirst({
      where: { id: parentId, ticketId: ticket.id },
      select: { isInternal: true, stepId: true },
    });
    if (!parent) return { errors: { form: t.errors.commentGone } };
    inheritedInternal = parent.isInternal || isInternal;
    stepId = parent.stepId;
  }

  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: {
        ticketId: ticket.id,
        authorId: user.id,
        body,
        isInternal: inheritedInternal,
        parentId,
        stepId,
      },
      select: { id: true },
    }),
    prisma.activity.create({
      data: { ticketId: ticket.id, actorId: user.id, type: "COMMENTED", stepId },
    }),
  ]);

  // After the comment, and never undoing it: a disk that cannot be written to
  // is the desk's problem to fix, and it is not worth throwing away what
  // somebody wrote. The comment then renders without its files — and whoever
  // wrote it is told so at the end, rather than being left to notice.
  const stored = uploads.length
    ? await saveUploads(uploads, { ticketId: ticket.id, commentId: comment.id }, user.id)
    : [];

  // Pictures placed in the reply pointed at draft keys until this moment. Run
  // whatever happened to the files: a token left standing is a token stored,
  // and `attachment:` in a saved body points at nothing for ever.
  const resolved = resolveDraftImages(body, fileKeys, stored);
  if (resolved !== body) {
    await prisma.comment.update({ where: { id: comment.id }, data: { body: resolved } });
  }

  // The requester answering is what un-parks a ticket that was waiting on
  // them. An internal note never is: that is the desk talking to itself.
  if (!stepId && !isInternal && ticket.reporterId === user.id) {
    const moved = await moveOnRequesterReply(ticket);
    if (moved) {
      await prisma.activity.create({
        data: { ...moved, ticketId: ticket.id, actorId: user.id },
      });
    }
  }

  // Anything the comment pointed at goes into the trail, and anyone it named
  // hears about it.
  await recordReferences({
    body,
    actorId: user.id,
    ticketId: ticket.id,
  });

  // Whoever holds the ticket hears about an answer on it. An internal note is
  // no different: it is still someone talking about their work.
  await notify({
    userId: ticket.assigneeId,
    actorId: user.id,
    ticketId: ticket.id,
    kind: "COMMENTED",
  });

  // And the person who raised it reads the answer in their inbox — but only
  // when it is an answer to them. An internal note reaching the person it is
  // about is the worst thing mail can do here, so the test is on the comment
  // that was actually written rather than on what was asked for.
  if (!inheritedInternal) {
    await mailPublicReply({ ticketId: ticket.id, actorId: user.id, body });
  }

  refreshTicket(ticket.number);
  if (stepId) revalidatePath(`/tickets/${ticket.number}/steps/${stepId}`);

  // Said last, because everything above it did happen. The comment is on the
  // ticket; only the files are not, and somebody who attached one deserves to
  // be told rather than to find out by looking.
  if (uploads.length && stored.length === 0) return { errors: { files: t.errors.uploadFailed } };
  return {};
}

/** Authors edit their own; admins can edit anyone's, which is why the trail
 *  records that an edit happened rather than trusting the body alone. */
export async function updateComment(commentId: string, body: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      authorId: true,
      ticketId: true,
      stepId: true,
      author: { select: { name: true } },
      ticket: { select: { number: true, reporterId: true, assigneeId: true } },
    },
  });
  if (!comment) return { ok: false as const, error: t.errors.commentGone };

  if (!canEditComment(user, comment) || !canViewTicket(user, comment.ticket)) {
    return { ok: false as const, error: t.errors.ownCommentsEdit };
  }

  const next = body.trim();
  if (!next) return { ok: false as const, error: t.errors.emptyComment };
  if (next.length > 10_000) return { ok: false as const, error: t.errors.tooLongPlain };

  if (await findBlockedWord(next)) return { ok: false as const, error: t.errors.blocked };

  const linked = await linkBareReferences(next);

  await prisma.$transaction([
    prisma.comment.update({
      where: { id: commentId },
      data: { body: linked, editedAt: new Date() },
    }),
    prisma.activity.create({
      data: {
        ticketId: comment.ticketId,
        actorId: user.id,
        type: "COMMENT_EDITED",
        field: "comment",
        // The mark stays with the conversation it was left in.
        stepId: comment.stepId,
        oldValue: comment.author.name,
      },
    }),
  ]);

  refreshTicket(comment.ticket.number);
  return { ok: true as const };
}

/** Toggling: reacting twice with the same emoji takes the reaction back. */
export async function toggleReaction(commentId: string, emoji: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { ticket: { select: { number: true, reporterId: true, assigneeId: true } } },
  });
  if (!comment) return { ok: false as const, error: t.errors.commentGone };
  if (!canViewTicket(user, comment.ticket)) {
    return { ok: false as const, error: t.errors.noReaction };
  }

  const key = { commentId_userId_emoji: { commentId, userId: user.id, emoji } };
  const existing = await prisma.commentReaction.findUnique({ where: key });

  if (existing) {
    await prisma.commentReaction.delete({ where: key });
  } else {
    await prisma.commentReaction.create({ data: { commentId, userId: user.id, emoji } });
  }

  refreshTicket(comment.ticket.number);
  return { ok: true as const, reacted: !existing };
}

export async function deleteComment(commentId: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      authorId: true,
      ticketId: true,
      stepId: true,
      author: { select: { name: true } },
      ticket: { select: { number: true, reporterId: true, assigneeId: true } },
    },
  });
  if (!comment) return { ok: false as const, error: t.errors.commentAlreadyGone };

  if (!canDeleteComment(user, comment) || !canViewTicket(user, comment.ticket)) {
    return { ok: false as const, error: t.errors.ownCommentsDelete };
  }

  // The rows cascade with the comment and with its replies; the files behind
  // them do not. Replies nest one level, so direct children are all of them.
  const replies = await prisma.comment.findMany({
    where: { parentId: commentId },
    select: { id: true },
  });
  await purgeUploads({ commentId: { in: [commentId, ...replies.map((reply) => reply.id)] } });

  // A removed comment leaves a mark in the trail — otherwise a conversation can
  // lose a message with nothing to show it ever existed.
  await prisma.$transaction([
    prisma.comment.delete({ where: { id: commentId } }),
    prisma.activity.create({
      data: {
        ticketId: comment.ticketId,
        actorId: user.id,
        type: "COMMENT_DELETED",
        field: "comment",
        stepId: comment.stepId,
        oldValue: comment.author.name,
      },
    }),
  ]);

  refreshTicket(comment.ticket.number);
  return { ok: true as const };
}

/**
 * Removing an activity entry. Its own permission, and deliberately narrow: the
 * trail is the record of what happened, and anyone able to edit it can rewrite
 * history. It exists to clear genuine mistakes, not to tidy.
 */
export async function deleteActivity(activityId: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!can(user, "activity.delete")) {
    return { ok: false as const, error: t.errors.noActivityDelete };
  }

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { ticket: { select: { number: true } }, project: { select: { key: true } } },
  });
  if (!activity) return { ok: false as const, error: t.errors.entryAlreadyGone };

  await prisma.activity.delete({ where: { id: activityId } });
  // An entry hangs off one or the other: a reference pointing at a project is
  // recorded on the project, and there is no ticket page to refresh.
  if (activity.ticket) refreshTicket(activity.ticket.number);
  if (activity.project) revalidatePath(`/projects/${activity.project.key}`);
  return { ok: true as const };
}

/**
 * Tags are defined as they are needed rather than picked from a fixed list.
 * They are instance-wide, so this creates one if the name is new and attaches
 * it either way. Idempotent: typing an existing tag simply attaches it.
 */
export async function createTagOnTicket(ticketId: string, rawName: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canEditTicket(user)) {
    return { ok: false as const, error: t.errors.noTagChange };
  }

  const name = rawName.trim().toLowerCase().slice(0, 30);
  if (!name) return { ok: false as const, error: t.errors.nameTag };

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, number: true },
  });
  if (!ticket) return { ok: false as const, error: t.errors.ticketGone };

  const tag = await prisma.label.upsert({
    where: { name },
    update: {},
    create: { name },
    select: { id: true, name: true, color: true },
  });

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticket.id },
      data: { labels: { connect: { id: tag.id } } },
    }),
    prisma.activity.create({
      data: {
        ticketId: ticket.id,
        actorId: user.id,
        type: "LABEL_ADDED",
        field: "label",
        newValue: tag.name,
      },
    }),
  ]);

  refreshTicket(ticket.number);
  return { ok: true as const, tag };
}

function emptyToNull(value: FormDataEntryValue | null) {
  const str = value === null ? "" : String(value).trim();
  return str === "" ? null : str;
}

/**
 * Raise a comment above the rest of the thread, or put it back.
 *
 * A verb on its own, so it happens now rather than joining a draft. Pinning is
 * a curation act about a shared thread rather than about your own writing, so
 * it takes the moderation permission — not authorship.
 */
export async function toggleCommentPin(commentId: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!can(user, "comment.moderate")) {
    return { ok: false as const, error: t.errors.noCommentPin };
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { pinnedAt: true, ticket: { select: { number: true } } },
  });
  if (!comment) return { ok: false as const, error: t.errors.commentGone };

  await prisma.comment.update({
    where: { id: commentId },
    data: { pinnedAt: comment.pinnedAt ? null : new Date() },
  });

  refreshTicket(comment.ticket.number);
  return { ok: true as const };
}
