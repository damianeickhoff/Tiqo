"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canEditDocs, canManageDocs, canViewDocs } from "@/lib/permissions";
import { INSTANCE_ID, getMessages } from "@/lib/settings";
import { docHref, docSearchWhere, spaceHref, subtreeIds, writeDocPrefs } from "@/lib/docs";
import { purgeUploads, saveUploads } from "@/lib/files";
import { resolveDraftImages, uploadProblem, uploadsFrom } from "@/lib/attachments";
import { recordReferences } from "@/lib/record-references";
import { notify } from "@/lib/notify";
import { slugify, uniqueSlug } from "@/lib/portal";
import {
  docCareSchema,
  docDefaultsSchema,
  docPublishSchema,
  docSchema,
  docSpaceSchema,
  fieldErrors,
} from "@/lib/validation";
import type { Messages } from "@/lib/i18n";

/**
 * Documentation: shelves, pages, and what was on a page last week.
 *
 * Three permissions. `doc.view` is whether the section exists for you at all,
 * `doc.edit` is a day's work — write a page, reorder it, say it is still
 * correct — and `doc.manage` decides what shelves there are, what is archived,
 * and what is put in front of requesters on the portal.
 *
 * The house rule about drafts is what shapes the surface: the editor and the
 * care card each hold a draft that reaches the database when somebody presses
 * Save. Adding, reordering, archiving, restoring and publishing are list-level
 * commands and happen at once.
 */

function refreshSpaces() {
  revalidatePath("/docs");
  revalidatePath("/settings/docs");
}

/** One page changed. The tree is drawn from the space, and both sit under
 *  /docs, so the shelf is revalidated with the page. */
function refreshDoc(spaceKey: string, slug?: string) {
  revalidatePath("/docs");
  revalidatePath(spaceHref(spaceKey));
  if (slug) revalidatePath(docHref(spaceKey, slug));
}

async function guard() {
  const [t, user] = await Promise.all([getMessages(), requireUser()]);
  return { t, user };
}

/* ----------------------------------------------------------------- spaces -- */

export async function createSpace(input: unknown) {
  const { t, user } = await guard();
  if (!canManageDocs(user)) return { ok: false as const, errors: { form: t.errors.noDocManage } };

  const parsed = docSpaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const taken = await prisma.docSpace.findUnique({
    where: { key: parsed.data.key },
    select: { id: true },
  });
  if (taken) {
    return { ok: false as const, errors: { key: t.errors.spaceKeyTaken(parsed.data.key) } };
  }

  // Appended rather than inserted: the order on the shelf is the desk's, and a
  // new space arriving in the middle of one somebody arranged is a small theft.
  const last = await prisma.docSpace.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const space = await prisma.docSpace.create({
    data: { ...parsed.data, position: (last?.position ?? -1) + 1 },
    select: { id: true, key: true },
  });

  refreshSpaces();
  return { ok: true as const, id: space.id, key: space.key };
}

export async function updateSpace(id: string, input: unknown) {
  const { t, user } = await guard();
  if (!canManageDocs(user)) return { ok: false as const, errors: { form: t.errors.noDocManage } };

  const parsed = docSpaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const clash = await prisma.docSpace.findUnique({
    where: { key: parsed.data.key },
    select: { id: true },
  });
  if (clash && clash.id !== id) {
    return { ok: false as const, errors: { key: t.errors.spaceKeyTaken(parsed.data.key) } };
  }

  await prisma.docSpace.update({ where: { id }, data: parsed.data });
  refreshSpaces();
  return { ok: true as const };
}

/**
 * Refused while anything is on the shelf, rather than cascaded.
 *
 * The database would take every page with it, which is the one deletion in this
 * feature nobody could explain afterwards — and the count is the whole of what
 * somebody needs in order to decide what to do instead.
 */
export async function deleteSpace(id: string) {
  const { t, user } = await guard();
  if (!canManageDocs(user)) return { ok: false as const, error: t.errors.noDocManage };

  const docs = await prisma.doc.count({ where: { spaceId: id } });
  if (docs > 0) return { ok: false as const, error: t.errors.spaceInUse(docs) };

  await prisma.docSpace.delete({ where: { id } });
  refreshSpaces();
  return { ok: true as const };
}

/** Up or down one place, swapped with its neighbour so two spaces can never
 *  end up holding the same position. */
export async function moveSpace(id: string, direction: "up" | "down") {
  const { t, user } = await guard();
  if (!canManageDocs(user)) return { ok: false as const, error: t.errors.noDocManage };

  const space = await prisma.docSpace.findUnique({
    where: { id },
    select: { id: true, position: true },
  });
  if (!space) return { ok: false as const, error: t.errors.spaceGone };

  const neighbour = await prisma.docSpace.findFirst({
    where: { position: direction === "up" ? { lt: space.position } : { gt: space.position } },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
    select: { id: true, position: true },
  });
  // Already at the end. Not an error: the button is simply the edge of the list.
  if (!neighbour) return { ok: true as const };

  await prisma.$transaction([
    prisma.docSpace.update({ where: { id: space.id }, data: { position: neighbour.position } }),
    prisma.docSpace.update({ where: { id: neighbour.id }, data: { position: space.position } }),
  ]);

  refreshSpaces();
  return { ok: true as const };
}

/**
 * How hard the desk chases a review.
 *
 * On the instance rather than on each shelf: "when do we start reminding
 * people" is one decision a desk makes once, and four columns repeated per
 * space would be four places to change it and three to forget.
 */
export async function updateDocDefaults(input: unknown) {
  const { t, user } = await guard();
  if (!canManageDocs(user)) return { ok: false as const, errors: { form: t.errors.noDocManage } };

  const parsed = docDefaultsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  await prisma.instance.update({
    where: { id: INSTANCE_ID },
    data: {
      docRemindDays: parsed.data.remindDays,
      docRemindEveryDays: parsed.data.remindEveryDays,
      docEscalateToTeam: parsed.data.escalateToTeam,
      docEditCountsAsReview: parsed.data.editCountsAsReview,
    },
  });

  revalidatePath("/settings/docs");
  return { ok: true as const };
}

/* -------------------------------------------------------------- documents -- */

/**
 * A slug nothing else on this shelf is using.
 *
 * Scoped to the space rather than global, so two teams can each have a page
 * called "escalation" without one of them getting "escalation-2". Written at
 * creation and again whenever the title changes: an address that still says
 * what the page used to be called is a link that lies, and the old address is
 * kept on the page and redirected from rather than left to rot.
 */
async function uniqueDocSlug(spaceId: string, title: string, exceptId?: string) {
  const base = slugify(title);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await prisma.doc.findUnique({
      where: { spaceId_slug: { spaceId, slug } },
      select: { id: true },
    });
    // Its own address is not a clash: a page renamed back to what it was
    // called should get its own slug again rather than "-2".
    if (!taken || taken.id === exceptId) return slug;
  }

  return `${base}-${Date.now()}`;
}

/** The page, with enough of its shelf to build an address. */
async function findDoc(id: string) {
  return prisma.doc.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      pastSlugs: true,
      title: true,
      body: true,
      spaceId: true,
      parentId: true,
      ownerId: true,
      updatedById: true,
      updatedAt: true,
      archivedAt: true,
      articleId: true,
      space: { select: { key: true } },
      updatedBy: { select: { name: true } },
    },
  });
}

/** An archived page is out of the tree on purpose. Everything that would write
 *  to one refuses, rather than relying on the control being hidden — a hidden
 *  button is presentation, and the action is the boundary. */
function refuseIfArchived(doc: { archivedAt: Date | null }, t: Messages) {
  return doc.archivedAt ? t.errors.docArchived : null;
}

/**
 * A new, empty page.
 *
 * Only a title is asked for. Everything else about a document — who owns it,
 * how often it is reviewed, what it says — is answered by writing it, and a
 * form standing between somebody and a blank page is how a runbook stays
 * unwritten.
 */
export async function createDoc({
  spaceId,
  parentId,
  title,
}: {
  spaceId: string;
  parentId?: string | null;
  title: string;
}) {
  const { t, user } = await guard();
  if (!canEditDocs(user)) return { ok: false as const, error: t.errors.noDocEdit };

  const clean = title.trim().slice(0, 160);
  if (!clean) return { ok: false as const, error: t.errors.nameDoc };

  const space = await prisma.docSpace.findUnique({
    where: { id: spaceId },
    select: { id: true, key: true, reviewDays: true },
  });
  if (!space) return { ok: false as const, error: t.errors.spaceGone };

  // Only inside this space: a page filed under a parent on another shelf would
  // be reachable at an address it does not have.
  const parent = parentId
    ? await prisma.doc.findFirst({
        where: { id: parentId, spaceId },
        select: { id: true },
      })
    : null;

  const last = await prisma.doc.findFirst({
    where: { spaceId, parentId: parent?.id ?? null },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const doc = await prisma.doc.create({
    data: {
      spaceId,
      parentId: parent?.id ?? null,
      title: clean,
      slug: await uniqueDocSlug(spaceId, clean),
      position: (last?.position ?? -1) + 1,
      // From the shelf it is going on: security notes go stale in a quarter and
      // a supplier arrangement does not, and that is a fact about the writing
      // rather than about whoever happens to start the page.
      reviewDays: space.reviewDays,
      // Writing a page is the strongest possible statement that it is correct
      // today, so the review clock starts now rather than leaving a brand new
      // document to be marked stale by a clock that has never been set.
      reviewedAt: new Date(),
      ownerId: user.id,
      createdById: user.id,
      updatedById: user.id,
    },
    select: { slug: true },
  });

  refreshDoc(space.key, doc.slug);
  return { ok: true as const, href: docHref(space.key, doc.slug) };
}

/**
 * One saved edit: the revision first, then the document, in one transaction.
 *
 * The revision holds what the page said *before* this save, so the history
 * reads as a list of changes — who changed it, when, why, and what it replaced.
 * That is the question people actually arrive with ("what did this say last
 * week"), and it is answered by finding the change after last week rather than
 * by counting versions.
 *
 * One transaction because a revision without its update, or an update without
 * its revision, is worse than neither: the first is a history of a change that
 * did not happen, the second is the missing week.
 *
 * A form rather than an object, because the files picked in the editor's own
 * toolbar travel with it — a diagram pasted into a runbook is part of the save
 * that placed it, not a second thing to remember to do afterwards.
 */
export async function saveDoc(id: string, formData: FormData) {
  const { t, user } = await guard();
  if (!canEditDocs(user)) return { ok: false as const, errors: { form: t.errors.noDocEdit } };

  const parsed = docSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    body: formData.get("body"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const current = await findDoc(id);
  if (!current) return { ok: false as const, errors: { form: t.errors.docGone } };

  const archived = refuseIfArchived(current, t);
  if (archived) return { ok: false as const, errors: { form: archived } };

  // What the editor had when it loaded. Two tabs open on one runbook is not a
  // hypothetical on a desk where everybody is told to write things down, and
  // last-write-wins there means somebody's afternoon disappears without a word.
  const loaded = String(formData.get("loadedAt") ?? "");
  if (loaded && new Date(loaded).getTime() !== current.updatedAt.getTime()) {
    return {
      ok: false as const,
      errors: { form: t.errors.docMovedOn(current.updatedBy?.name ?? t.notifications.someone) },
    };
  }

  const files = uploadsFrom(formData);
  const problem = uploadProblem(files, t);
  if (problem) return { ok: false as const, errors: { form: problem } };

  const { title, summary, note } = parsed.data;

  // The bytes first, so a picture placed in the text can be pointed at a real
  // address before the text is stored. A file that fails to land takes the save
  // with it: half a runbook with a broken diagram in it is worse than the
  // version that is already there.
  let body = parsed.data.body;
  if (files.length) {
    const ids = await saveUploads(files, { docId: id }, user.id);
    if (!ids.length) return { ok: false as const, errors: { form: t.errors.uploadFailed } };
    body = resolveDraftImages(body, formData.getAll("fileKeys").map(String), ids);
  }

  // Nothing changed, so there is nothing to record. Without this, opening the
  // editor and pressing Save writes a revision saying somebody changed
  // something, which is the fastest way to make a history unreadable.
  const unchanged = title === current.title && body === current.body;

  // The address follows the title. Freezing the slug at creation kept old
  // links working, but it also meant a page renamed a week later answered for
  // ever to the thing it used to be called — so the slug is rewritten and the
  // address it had is kept, and redirected from, instead.
  const nextSlug =
    title === current.title ? current.slug : await uniqueDocSlug(current.spaceId, title, id);
  const readdressed = nextSlug !== current.slug;

  // Whether somebody said, on the way past, that they have read the whole
  // thing. The tick starts from the desk's own setting and is theirs to clear:
  // rewriting a page usually is a review, and fixing a typo is not.
  const counts = formData.get("review") !== null;

  const [saved] = await prisma.$transaction([
    prisma.doc.update({
      where: { id },
      data: {
        title,
        summary,
        body,
        updatedById: user.id,
        ...(readdressed
          ? {
              slug: nextSlug,
              // The address it is leaving joins the ones it left before, and
              // the one it has just taken back leaves the list: a page renamed
              // twice is reachable from both of its old names.
              pastSlugs: [...new Set([...current.pastSlugs, current.slug])].filter(
                (slug) => slug !== nextSlug,
              ),
            }
          : {}),
        ...(counts
          ? {
              reviewedAt: new Date(),
              staleNotifiedAt: null,
              staleReminders: 0,
              staleSnoozedTo: null,
            }
          : {}),
      },
      select: { updatedAt: true },
    }),
    ...(unchanged
      ? []
      : [
          prisma.docRevision.create({
            data: {
              docId: id,
              title: current.title,
              body: current.body,
              note,
              authorId: user.id,
            },
          }),
        ]),
  ]);

  // The other end of every reference in the new text. Done after the write, so
  // a trail is never recorded for a save that did not happen.
  await recordReferences({ body, actorId: user.id, docId: id });

  // Whoever answers for the page hears that somebody else has changed it. Only
  // on a real change — `notify` drops a notice to the person who wrote it, so
  // an owner editing their own page is told nothing.
  if (!unchanged) {
    await notify({ userId: current.ownerId, actorId: user.id, docId: id, kind: "DOC_EDITED" });
  }

  refreshDoc(current.space.key, current.slug);
  if (readdressed) refreshDoc(current.space.key, nextSlug);
  // The version this save produced, so the editor's next save is measured
  // against it rather than against whatever the page happened to be showing.
  // The address too, when the rename changed it: the browser is standing on
  // the old one, and it should not have to be told to go and look.
  return {
    ok: true as const,
    updatedAt: saved.updatedAt.toISOString(),
    href: readdressed ? docHref(current.space.key, nextSlug) : undefined,
  };
}

/**
 * Who answers for this page, how long it may go unconfirmed, and where it sits.
 *
 * Kept apart from the body on purpose. It is a different decision, made by a
 * different person at a different time — and, unlike the words, changing it
 * must not write a revision: moving a page in the tree is not an edit anybody
 * would want to read back.
 */
export async function updateDocCare(id: string, input: unknown) {
  const { t, user } = await guard();
  if (!canEditDocs(user)) return { ok: false as const, errors: { form: t.errors.noDocEdit } };

  const parsed = docCareSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const current = await findDoc(id);
  if (!current) return { ok: false as const, errors: { form: t.errors.docGone } };

  const archived = refuseIfArchived(current, t);
  if (archived) return { ok: false as const, errors: { form: archived } };

  const { ownerId, reviewDays, parentId } = parsed.data;

  // Moving the page to another shelf. Its own branch goes with it — a subtree
  // split across two spaces is a set of pages reachable from a tree they are
  // not on — and it lands at the top of the new one, because the parent it had
  // is on a shelf it no longer stands on.
  const moving = parsed.data.spaceId && parsed.data.spaceId !== current.spaceId;
  if (moving) {
    const moved = await moveToSpace(current, parsed.data.spaceId!, user.id, t);
    if (!moved.ok) return moved;
    refreshDoc(current.space.key, current.slug);
    refreshDoc(moved.spaceKey, moved.slug);
  }

  if (parentId) {
    const siblings = await prisma.doc.findMany({
      where: { spaceId: current.spaceId },
      select: { id: true, parentId: true, position: true, title: true },
    });
    // Filing a page under one of its own children would cut the branch off the
    // tree: everything on it would still be in the database, answering to
    // nothing and reachable from nowhere.
    if (subtreeIds(siblings, id).has(parentId)) {
      return { ok: false as const, errors: { parentId: t.errors.docParentLoop } };
    }
    const parent = siblings.find((row) => row.id === parentId);
    if (!parent) return { ok: false as const, errors: { parentId: t.errors.docGone } };
  }

  // Moved to a different branch, so it goes to the end of its new one rather
  // than landing on whatever position it happened to hold in the old.
  const moved = (parentId ?? null) !== (current.parentId ?? null);
  const last = moved
    ? await prisma.doc.findFirst({
        where: { spaceId: current.spaceId, parentId: parentId ?? null },
        orderBy: { position: "desc" },
        select: { position: true },
      })
    : null;

  await prisma.doc.update({
    where: { id },
    data: {
      ownerId,
      reviewDays,
      // A page that has just changed shelf is already at the top of its new
      // one; the parent that came in with the form belongs to the old tree.
      ...(moving ? {} : { parentId: parentId ?? null }),
      ...(moved && !moving ? { position: (last?.position ?? -1) + 1 } : {}),
      updatedById: user.id,
    },
  });

  refreshDoc(current.space.key, current.slug);
  // Where the page now lives, when that is somewhere else: the address carries
  // the space key, so a move leaves the browser on a URL that no longer exists.
  const after = moving
    ? await prisma.doc.findUnique({
        where: { id },
        select: { slug: true, space: { select: { key: true } } },
      })
    : null;

  return {
    ok: true as const,
    href: after ? docHref(after.space.key, after.slug) : undefined,
  };
}

/**
 * The page and everything under it onto another shelf.
 *
 * Slugs are unique per space, so a page called `escalation` moving onto a shelf
 * that already has one is renamed rather than refused — the move is what
 * somebody asked for, and a second `escalation-2` is a smaller surprise than a
 * refusal they cannot act on without renaming something first.
 */
async function moveToSpace(
  current: { id: string; spaceId: string; slug: string },
  spaceId: string,
  actorId: string,
  t: Messages,
) {
  const space = await prisma.docSpace.findUnique({
    where: { id: spaceId },
    select: { id: true, key: true },
  });
  if (!space) return { ok: false as const, errors: { spaceId: t.errors.docGone } };

  const rows = await prisma.doc.findMany({
    where: { spaceId: current.spaceId },
    select: { id: true, parentId: true, position: true, title: true },
  });
  const branch = [...subtreeIds(rows, current.id)];

  const pages = await prisma.doc.findMany({
    where: { id: { in: branch } },
    select: { id: true, slug: true, title: true },
  });

  const last = await prisma.doc.findFirst({
    where: { spaceId, parentId: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  // One at a time rather than an `updateMany`, because each page may need its
  // own new slug and the check has to see the ones already moved.
  for (const page of pages) {
    const clash = await prisma.doc.findUnique({
      where: { spaceId_slug: { spaceId, slug: page.slug } },
      select: { id: true },
    });
    await prisma.doc.update({
      where: { id: page.id },
      data: {
        spaceId,
        slug: clash ? await uniqueDocSlug(spaceId, page.title) : page.slug,
        updatedById: actorId,
        ...(page.id === current.id ? { parentId: null, position: (last?.position ?? -1) + 1 } : {}),
      },
    });
  }

  const root = await prisma.doc.findUnique({ where: { id: current.id }, select: { slug: true } });
  return { ok: true as const, spaceKey: space.key, slug: root?.slug ?? current.slug };
}

/**
 * Somebody has read it and it is still right.
 *
 * One click, no edit, and deliberately not hidden behind the editor: the cost
 * of confirming has to be lower than the cost of ignoring, or the review date
 * becomes a badge everybody learns to look past.
 */
export async function markReviewed(id: string) {
  const { t, user } = await guard();
  if (!canEditDocs(user)) return { ok: false as const, error: t.errors.noDocEdit };

  const current = await findDoc(id);
  if (!current) return { ok: false as const, error: t.errors.docGone };

  const archived = refuseIfArchived(current, t);
  if (archived) return { ok: false as const, error: archived };

  // `updatedAt` is left alone: saying a page is still correct is not the same
  // as changing it, and a list ordered by "recently updated" should not fill up
  // with pages nobody has touched.
  // The stale mark goes with it: this lapse is over, and the next one is news
  // rather than the same notice sent twice.
  await prisma.doc.update({
    where: { id },
    data: {
      reviewedAt: new Date(),
      staleNotifiedAt: null,
      staleReminders: 0,
      staleSnoozedTo: null,
    },
  });

  refreshDoc(current.space.key, current.slug);
  revalidatePath("/docs/review");
  revalidatePath("/");
  return { ok: true as const };
}

/**
 * "Not today."
 *
 * The page is due, the person knows, and they cannot read it this afternoon.
 * Without this the only two answers are to lie — press Still correct on a page
 * nobody has read — or to let the notice repeat until it is furniture. A week
 * is the snooze because the reminder rhythm is measured in fortnights, so a
 * day would change nothing and a month would be a quiet way of refusing.
 */
export async function snoozeReview(id: string) {
  const { t, user } = await guard();
  if (!canEditDocs(user)) return { ok: false as const, error: t.errors.noDocEdit };

  const current = await findDoc(id);
  if (!current) return { ok: false as const, error: t.errors.docGone };

  const archived = refuseIfArchived(current, t);
  if (archived) return { ok: false as const, error: archived };

  const until = new Date(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000);
  await prisma.doc.update({ where: { id }, data: { staleSnoozedTo: until } });

  refreshDoc(current.space.key, current.slug);
  return { ok: true as const, days: SNOOZE_DAYS };
}

/** How long "Remind me" is worth. Named so the sentence on the button and the
 *  sweep that honours it cannot drift apart. */
const SNOOZE_DAYS = 7;

/* ------------------------------------------------------------------ stars -- */

/**
 * A page somebody keeps coming back to.
 *
 * Personal, so anybody who may read the documentation may pin one: what one
 * operator opens every week is a fact about them and not about the page.
 */
export async function toggleDocStar(id: string) {
  const [t, user] = await Promise.all([getMessages(), requireUser()]);
  if (!canViewDocs(user))
    return { ok: false as const, pinned: false, error: t.errors.noPermission };

  const doc = await prisma.doc.findUnique({ where: { id }, select: { id: true } });
  if (!doc) return { ok: false as const, pinned: false, error: t.errors.docGone };

  const existing = await prisma.docStar.findUnique({
    where: { userId_docId: { userId: user.id, docId: id } },
  });

  if (existing) {
    await prisma.docStar.delete({ where: { userId_docId: { userId: user.id, docId: id } } });
  } else {
    await prisma.docStar.create({ data: { userId: user.id, docId: id } });
  }

  revalidatePath("/docs");
  return { ok: true as const, pinned: !existing };
}

/* ------------------------------------------------------------ preferences -- */

/**
 * How this person likes the documentation drawn.
 *
 * Not a draft: a view toggle is a list-level command, the same as reordering —
 * it changes what is on screen and nothing about what is written down. Asking
 * somebody to press Save after choosing between cards and rows would be asking
 * them to confirm what they can already see.
 */
export async function setDocPref(patch: { shelf?: "cards" | "list"; reading?: boolean }) {
  const user = await requireUser();

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { docPrefs: true },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { docPrefs: writeDocPrefs(current?.docPrefs ?? null, patch) },
    select: { id: true },
  });

  return { ok: true as const };
}

/* ----------------------------------------------------------------- search -- */

/**
 * The documentation, searched from its own front page.
 *
 * The same question the top bar's search asks — one `where`, shared — but with
 * room for a page of answers rather than the five a popup can hold. Somebody
 * standing on the documentation has already narrowed it to documentation.
 */
export async function findDocs(query: string) {
  const user = await requireUser();
  if (!canViewDocs(user)) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  return prisma.doc.findMany({
    where: docSearchWhere(q),
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      space: { select: { key: true, name: true, color: true } },
    },
  });
}

/** Up or down one place among its own siblings. */
export async function moveDoc(id: string, direction: "up" | "down") {
  const { t, user } = await guard();
  if (!canEditDocs(user)) return { ok: false as const, error: t.errors.noDocEdit };

  const doc = await prisma.doc.findUnique({
    where: { id },
    select: {
      id: true,
      spaceId: true,
      parentId: true,
      position: true,
      slug: true,
      space: { select: { key: true } },
    },
  });
  if (!doc) return { ok: false as const, error: t.errors.docGone };

  const neighbour = await prisma.doc.findFirst({
    where: {
      spaceId: doc.spaceId,
      parentId: doc.parentId,
      position: direction === "up" ? { lt: doc.position } : { gt: doc.position },
    },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
    select: { id: true, position: true },
  });
  if (!neighbour) return { ok: true as const };

  await prisma.$transaction([
    prisma.doc.update({ where: { id: doc.id }, data: { position: neighbour.position } }),
    prisma.doc.update({ where: { id: neighbour.id }, data: { position: doc.position } }),
  ]);

  refreshDoc(doc.space.key, doc.slug);
  return { ok: true as const };
}

/**
 * Out of the tree, but not gone.
 *
 * A procedure that was replaced is the first thing wanted when the replacement
 * turns out to be wrong, so archiving takes a page out of the lists and the
 * search and leaves its address working.
 *
 * The whole subtree goes with it, and comes back with it. A page whose parent
 * is archived is not a page at the top of the shelf: the rail builds its tree
 * from what is left and would promote the orphans to roots, while the shelf
 * page lists only pages with no parent and would lose them entirely. Two
 * contradictory answers to "where did my sub-pages go" is worse than either.
 */
export async function archiveDoc(id: string, archived: boolean) {
  const { t, user } = await guard();
  if (!canManageDocs(user)) return { ok: false as const, error: t.errors.noDocManage };

  const current = await findDoc(id);
  if (!current) return { ok: false as const, error: t.errors.docGone };

  const rows = await prisma.doc.findMany({
    where: { spaceId: current.spaceId },
    select: { id: true, parentId: true, position: true, title: true },
  });

  await prisma.doc.updateMany({
    where: { id: { in: [...subtreeIds(rows, id)] } },
    data: { archivedAt: archived ? new Date() : null, updatedById: user.id },
  });

  refreshDoc(current.space.key, current.slug);
  return { ok: true as const };
}

/**
 * Gone for good, with everything under it.
 *
 * The children go too, because a runbook's sub-pages are not documents that
 * happen to sit nearby — but the bytes have to be unlinked first, while the
 * rows that name them are still there to be read.
 */
export async function deleteDoc(id: string) {
  const { t, user } = await guard();
  if (!canManageDocs(user)) return { ok: false as const, error: t.errors.noDocManage };

  const current = await findDoc(id);
  if (!current) return { ok: false as const, error: t.errors.docGone };

  const rows = await prisma.doc.findMany({
    where: { spaceId: current.spaceId },
    select: { id: true, parentId: true, position: true, title: true },
  });
  for (const going of subtreeIds(rows, id)) await purgeUploads({ docId: going });

  await prisma.doc.delete({ where: { id } });

  refreshDoc(current.space.key, current.slug);
  return { ok: true as const };
}

/* ------------------------------------------------------------- revisions -- */

/**
 * An older version, put back.
 *
 * Written as a *new* save rather than by rolling the history back: what came
 * after the version being restored is still what somebody wrote, and a restore
 * that erases it is a second mistake made to correct the first. So the history
 * gains a row instead of losing one, and the restore itself is visible in it.
 */
export async function restoreRevision(revisionId: string) {
  const { t, user } = await guard();
  if (!canEditDocs(user)) return { ok: false as const, error: t.errors.noDocEdit };

  const revision = await prisma.docRevision.findUnique({
    where: { id: revisionId },
    select: { id: true, docId: true, title: true, body: true, createdAt: true },
  });
  if (!revision) return { ok: false as const, error: t.errors.revisionGone };

  const current = await findDoc(revision.docId);
  if (!current) return { ok: false as const, error: t.errors.docGone };

  const archived = refuseIfArchived(current, t);
  if (archived) return { ok: false as const, error: archived };

  await prisma.$transaction([
    prisma.docRevision.create({
      data: {
        docId: current.id,
        title: current.title,
        body: current.body,
        note: t.docs.restoredNote,
        authorId: user.id,
      },
    }),
    prisma.doc.update({
      where: { id: current.id },
      data: { title: revision.title, body: revision.body, updatedById: user.id },
    }),
  ]);

  await recordReferences({ body: revision.body, actorId: user.id, docId: current.id });

  refreshDoc(current.space.key, current.slug);
  return { ok: true as const };
}

/* ---------------------------------------------------------------- portal -- */

/**
 * The one crossover between a document and the portal.
 *
 * The article is created the first time and updated every time after, which is
 * what `articleId` is for: publishing twice must not leave a desk with two
 * answers that disagree. Afterwards the two are free to diverge, and that is
 * correct — what you tell a requester is shorter than what you tell an
 * engineer — so the article stays editable on its own and its admin page says
 * where it came from.
 */
export async function publishDoc(id: string, input: unknown) {
  const { t, user } = await guard();
  if (!canManageDocs(user)) return { ok: false as const, errors: { form: t.errors.noDocManage } };

  const parsed = docPublishSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const doc = await prisma.doc.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      body: true,
      articleId: true,
      space: { select: { key: true } },
    },
  });
  if (!doc) return { ok: false as const, errors: { form: t.errors.docGone } };

  const { categoryId, isPublished } = parsed.data;

  if (doc.articleId) {
    await prisma.portalArticle.update({
      where: { id: doc.articleId },
      data: {
        title: doc.title,
        summary: doc.summary,
        body: doc.body,
        categoryId,
        isPublished,
        updatedById: user.id,
      },
    });
  } else {
    // One transaction, because the two halves are one fact. An article created
    // and a page that does not know about it is exactly the state `articleId`
    // exists to prevent: publish again and the desk has two answers that
    // disagree, with no way to tell which one requesters are reading.
    const slug = await uniqueSlug("portalArticle", doc.title);

    await prisma.$transaction(async (tx) => {
      const article = await tx.portalArticle.create({
        data: {
          title: doc.title,
          slug,
          summary: doc.summary,
          body: doc.body,
          categoryId,
          isPublished,
          createdById: user.id,
          updatedById: user.id,
        },
        select: { id: true },
      });
      await tx.doc.update({ where: { id }, data: { articleId: article.id } });
    });
  }

  refreshDoc(doc.space.key, doc.slug);
  revalidatePath("/portal", "layout");
  revalidatePath("/settings/portal", "layout");
  return { ok: true as const };
}

/**
 * Off the portal, without losing the link.
 *
 * The article is hidden rather than deleted: it has its own views, its own
 * votes and possibly its own edits, and throwing those away to undo a publish
 * is not a trade anybody asked for. Publishing again brings the same answer
 * back rather than a second copy of it.
 */
export async function withdrawDoc(id: string) {
  const { t, user } = await guard();
  if (!canManageDocs(user)) return { ok: false as const, error: t.errors.noDocManage };

  const doc = await prisma.doc.findUnique({
    where: { id },
    select: { articleId: true, slug: true, space: { select: { key: true } } },
  });
  if (!doc?.articleId) return { ok: false as const, error: t.errors.docNotPublished };

  await prisma.portalArticle.update({
    where: { id: doc.articleId },
    data: { isPublished: false, updatedById: user.id },
  });

  refreshDoc(doc.space.key, doc.slug);
  revalidatePath("/portal", "layout");
  revalidatePath("/settings/portal", "layout");
  return { ok: true as const };
}

/**
 * What one older version actually said.
 *
 * Fetched when a row in the history is opened rather than sent with the list:
 * a page of fifty revisions is fifty full documents, and forty-nine of them are
 * never looked at.
 */
export async function readRevision(revisionId: string) {
  const user = await requireUser();
  if (!canViewDocs(user)) return null;

  return prisma.docRevision.findUnique({
    where: { id: revisionId },
    select: {
      id: true,
      title: true,
      body: true,
      note: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });
}
