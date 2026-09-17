import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isStale, reviewDueAt } from "@/lib/docs";
import { notify } from "@/lib/notify";

/** The desk's own answer to "how hard do we chase a review". */
export type DocReviewDefaults = {
  remindDays: number;
  remindEveryDays: number;
  escalateToTeam: boolean;
  editCountsAsReview: boolean;
};

const FALLBACK: DocReviewDefaults = {
  remindDays: 7,
  remindEveryDays: 14,
  escalateToTeam: false,
  editCountsAsReview: true,
};

/**
 * The review defaults, read once per request.
 *
 * Apart from `getSettings` because nothing outside the documentation asks for
 * them, and a settings object every page in the app loads should not grow four
 * columns for the benefit of one section.
 */
export const docReviewDefaults = cache(async (): Promise<DocReviewDefaults> => {
  const row = await prisma.instance.findUnique({
    where: { id: "instance" },
    select: {
      docRemindDays: true,
      docRemindEveryDays: true,
      docEscalateToTeam: true,
      docEditCountsAsReview: true,
    },
  });
  if (!row) return FALLBACK;

  return {
    remindDays: row.docRemindDays,
    remindEveryDays: row.docRemindEveryDays,
    escalateToTeam: row.docEscalateToTeam,
    editCountsAsReview: row.docEditCountsAsReview,
  };
});

/**
 * Telling an owner their page is due, and then telling them again.
 *
 * Three things the desk decides and this obeys: how long before the date the
 * first notice goes, how often it repeats while nobody answers, and whether
 * the team that answers for the shelf is told once the second one has gone
 * unheard. `staleNotifiedAt` is when the last notice went and `staleReminders`
 * how many this lapse has cost — confirming the page (`markReviewed`) clears
 * both, so the next lapse is news again rather than the same one said twice.
 *
 * A snooze stops all of it until its day. Without one the only two answers to
 * a page somebody cannot read this afternoon are to lie or to learn to ignore
 * the notice, and both end with a review date nobody believes.
 *
 * Run from the mail poll route because that is the only thing in this app that
 * runs on a clock. Next has no background worker and this is not the place to
 * grow a process model for one.
 *
 * Nobody did it, so there is no actor: the desk noticed, and a notice signed by
 * a person who did nothing is one somebody answers to the wrong person.
 */
export async function sweepStaleDocs() {
  const defaults = await docReviewDefaults();

  // Everything that can go stale and has an owner to tell. The arithmetic —
  // `reviewedAt` plus a per-page interval — is not something a `where` clause
  // can do, so the filtering is done here on a list that is one row per page.
  const pages = await prisma.doc.findMany({
    where: { archivedAt: null, reviewDays: { gt: 0 }, ownerId: { not: null } },
    select: {
      id: true,
      ownerId: true,
      reviewDays: true,
      reviewedAt: true,
      createdAt: true,
      staleNotifiedAt: true,
      staleReminders: true,
      staleSnoozedTo: true,
      space: { select: { team: { select: { members: { select: { id: true } } } } } },
    },
  });

  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  let told = 0;

  for (const page of pages) {
    // Put off on purpose, by somebody who knows.
    if (page.staleSnoozedTo && page.staleSnoozedTo.getTime() > now.getTime()) continue;

    const due = reviewDueAt(page);
    if (!due) continue;

    // The first notice goes before the date, which is the only one that can
    // still be acted on cheaply. Zero turns that half off and waits for the
    // lapse itself.
    const opensAt = due.getTime() - defaults.remindDays * day;
    if (now.getTime() < opensAt) continue;

    if (page.staleNotifiedAt) {
      // Already told about this lapse. Again only on the rhythm the desk set,
      // and never at all when it set none.
      if (defaults.remindEveryDays <= 0) continue;
      const nextAt = page.staleNotifiedAt.getTime() + defaults.remindEveryDays * day;
      if (now.getTime() < nextAt) continue;
    }

    await notify({ userId: page.ownerId, actorId: null, docId: page.id, kind: "DOC_STALE" });

    // The team that answers for the shelf, once the owner has had two notices
    // and answered neither. Not before: an owner on holiday is a normal week,
    // and telling four people on the Tuesday is how a desk learns to ignore
    // the notice altogether.
    const reminders = page.staleReminders + 1;
    if (defaults.escalateToTeam && reminders >= 2 && isStale(page, now)) {
      for (const member of page.space.team?.members ?? []) {
        if (member.id === page.ownerId) continue;
        await notify({ userId: member.id, actorId: null, docId: page.id, kind: "DOC_STALE" });
      }
    }

    await prisma.doc.update({
      where: { id: page.id },
      data: { staleNotifiedAt: now, staleReminders: reminders },
    });
    told += 1;
  }

  return { stale: told };
}
