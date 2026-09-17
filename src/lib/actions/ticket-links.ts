"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, type SessionUser } from "@/lib/auth";
import { canEditTicket, canViewTicket, ticketVisibilityFilter } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { refreshTicket } from "@/lib/refresh";
import { fieldErrors, ticketLinkSchema } from "@/lib/validation";
import type { Messages } from "@/lib/i18n";
import type { Priority } from "@/generated/prisma/enums";
import type { TicketStatus } from "@/lib/tickets";
import { linkEntry } from "@/lib/ticket-links";
import { notify } from "@/lib/notify";

/**
 * What one ticket has to do with another.
 *
 * A link is one directed row with two readings, so every write here touches two
 * histories: the ticket it was made from reads it forwards — "this blocks
 * INC-4471" — and the far ticket reads the same row with itself as the object.
 * `src/lib/record-references.ts` already solved that problem for prose
 * references and this behaves the same way, because a link and a reference are
 * the same kind of fact to whoever is reading the trail.
 *
 * Adding and removing are list-level commands, not drafts: pressing Add records
 * the statement, the X withdraws it. That is the exception `CLAUDE.md` names.
 */

/** Enough of a ticket to check who may see it and to name it in the trail. */
const END = {
  id: true,
  number: true,
  reference: true,
  reporterId: true,
  assigneeId: true,
} as const;

type End = { id: string; number: number; reference: string; assigneeId: string | null };

/**
 * Both ends and permission to touch them, or the one sentence saying why not.
 * Tagged rather than told apart by which key is present: a union narrowed by
 * `in` leaves the error a `string | undefined` at the call site, which is a
 * refusal with nothing in it.
 */
type Ends = { ok: false; error: string } | { ok: true; source: End; target: End };

/** Both ends of a link, checked: the pair exists and this person may read both. */
async function ends(
  sourceId: string,
  targetId: string,
  user: SessionUser,
  t: Messages,
): Promise<Ends> {
  const tickets = await prisma.ticket.findMany({
    where: { id: { in: [sourceId, targetId] } },
    select: END,
  });

  const source = tickets.find((ticket) => ticket.id === sourceId);
  const target = tickets.find((ticket) => ticket.id === targetId);
  if (!source || !target) return { ok: false, error: t.errors.ticketGone };

  if (!canEditTicket(user)) return { ok: false, error: t.errors.noTicketChange };

  // Both ends, not just the one being looked at: a link is a way to learn that
  // a ticket exists at all, so making one to a ticket you cannot read would
  // disclose it — and so would removing one to find out whether it was there.
  if (!canViewTicket(user, source) || !canViewTicket(user, target)) {
    return { ok: false, error: t.errors.noTicketChange };
  }

  return { ok: true, source, target };
}

export async function linkTickets(sourceId: string, input: unknown) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const parsed = ticketLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const { targetId, kind } = parsed.data;
  // A ticket saying something about itself is always a slip of the picker, and
  // every reading of it — "this blocks this" — is nonsense.
  if (sourceId === targetId) {
    return { ok: false as const, errors: { targetId: t.errors.linkToItself } };
  }

  const found = await ends(sourceId, targetId, user, t);
  if (!found.ok) return { ok: false as const, errors: { form: found.error } };
  const { source, target } = found;

  // The mirror, not just the duplicate: `A blocks B` and `B blocks A` are two
  // rows that say opposite things, and the unique index cannot see the second
  // one coming. Named in the refusal, because "already linked" sends somebody
  // looking at the wrong ticket for it.
  const existing = await prisma.ticketLink.findFirst({
    where: {
      kind,
      OR: [
        { sourceId, targetId },
        { sourceId: targetId, targetId: sourceId },
      ],
    },
    select: { sourceId: true },
  });
  if (existing) {
    const forwards = existing.sourceId === sourceId;
    const verb = t.links.verb[kind];
    return {
      ok: false as const,
      errors: {
        targetId: t.errors.linkExists(
          forwards
            ? `${source.reference} ${verb} ${target.reference}`
            : `${target.reference} ${verb} ${source.reference}`,
        ),
      },
    };
  }

  await prisma.$transaction([
    prisma.ticketLink.create({ data: { kind, sourceId, targetId, createdById: user.id } }),
    prisma.activity.createMany({
      data: [
        linkEntry("LINKED", kind, { on: source, far: target, incoming: false }, user.id),
        linkEntry("LINKED", kind, { on: target, far: source, incoming: true }, user.id),
      ],
    }),
  ]);

  // The one link whose far end has work taken off it. Nothing was said on the
  // blocked ticket — no comment, no status change — so without this the person
  // holding it finds out by wondering why it never moved.
  if (kind === "BLOCKS") {
    await notify({
      userId: target.assigneeId,
      actorId: user.id,
      ticketId: target.id,
      kind: "BLOCKED",
    });
  }

  refreshTicket(source.number);
  refreshTicket(target.number);
  return { ok: true as const };
}

export async function unlinkTickets(linkId: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const link = await prisma.ticketLink.findUnique({
    where: { id: linkId },
    select: { id: true, kind: true, sourceId: true, targetId: true },
  });
  if (!link) return { ok: false as const, errors: { form: t.errors.linkGone } };

  const found = await ends(link.sourceId, link.targetId, user, t);
  if (!found.ok) return { ok: false as const, errors: { form: found.error } };
  const { source, target } = found;

  await prisma.$transaction([
    prisma.ticketLink.delete({ where: { id: link.id } }),
    // The statement is gone, but both histories keep the fact that it was made
    // and withdrawn — which is the half somebody is looking for when a link
    // they remember is no longer on the card.
    prisma.activity.createMany({
      data: [
        linkEntry("UNLINKED", link.kind, { on: source, far: target, incoming: false }, user.id),
        linkEntry("UNLINKED", link.kind, { on: target, far: source, incoming: true }, user.id),
      ],
    }),
  ]);

  refreshTicket(source.number);
  refreshTicket(target.number);
  return { ok: true as const };
}

/** Six is what fits in the picker without it becoming a queue of its own. */
const CANDIDATES = 6;

export type LinkCandidate = {
  id: string;
  number: number;
  reference: string;
  title: string;
  priority: Priority;
  status: TicketStatus;
};

/**
 * What this person could link to, newest first — a link is nearly always to
 * something recent.
 *
 * Through the same visibility filter the queue uses. Offering a ticket the
 * viewer may not read would disclose its title, and the action refuses those
 * anyway, so a picker that listed them would only produce refusals.
 */
export async function searchLinkTargets(sourceId: string, query: string): Promise<LinkCandidate[]> {
  const user = await requireUser();
  if (!canEditTicket(user)) return [];

  const needle = query.trim();
  return prisma.ticket.findMany({
    where: {
      ...ticketVisibilityFilter(user),
      id: { not: sourceId },
      // A merged ticket is a conversation that has moved somewhere else, so a
      // link to one points at a page that redirects — and the thing somebody
      // meant to link to is the survivor.
      mergedIntoId: null,
      // And nothing that is already said. The action refuses a duplicate and
      // refuses the mirror of one, so offering them produces only refusals.
      NOT: {
        OR: [{ linksOut: { some: { targetId: sourceId } } }, { linksIn: { some: { sourceId } } }],
      },
      ...(needle
        ? {
            OR: [
              { reference: { contains: needle, mode: "insensitive" } },
              { title: { contains: needle, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: CANDIDATES,
    select: {
      id: true,
      number: true,
      reference: true,
      title: true,
      priority: true,
      status: { select: { id: true, name: true, color: true, settles: true } },
    },
  });
}
