"use server";

import { revalidatePath } from "next/cache";
import { refreshTicket } from "@/lib/refresh";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  can,
  canEditTicket,
  canViewTicket,
  isStaff,
  ticketVisibilityFilter,
} from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { purgeUploads } from "@/lib/files";
import { notify } from "@/lib/notify";
import { note } from "@/lib/i18n";
import { fieldErrors } from "@/lib/validation";
import type { FormState } from "@/lib/actions/auth";

/* ------------------------------------------------------------------ star -- */

/** Personal, so anyone who can see the ticket can star it. */
export async function toggleStar(ticketId: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { number: true, reporterId: true, assigneeId: true },
  });
  if (!ticket || !canViewTicket(user, ticket)) {
    return { ok: false as const, starred: false, error: t.errors.ticketGone };
  }

  const existing = await prisma.ticketStar.findUnique({
    where: { userId_ticketId: { userId: user.id, ticketId } },
  });

  if (existing) {
    await prisma.ticketStar.delete({ where: { userId_ticketId: { userId: user.id, ticketId } } });
  } else {
    await prisma.ticketStar.create({ data: { userId: user.id, ticketId } });
  }

  refreshTicket(ticket.number);
  return { ok: true as const, starred: !existing };
}

/* --------------------------------------------------------------- forward -- */

const forwardSchema = z.object({
  toUserId: z.string().min(1, note("pickForwardTarget")),
  message: z.string().trim().max(5000).default(""),
});

/**
 * Forwarding stays inside the instance: the recipient is another Tiqo user, so
 * a ticket cannot be handed to an address nobody here can see. There is no mail
 * transport, so the handover is *recorded* — an internal note plus an activity
 * entry — rather than sent.
 */
export async function forwardTicket(_prev: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  const ticketId = String(formData.get("ticketId") ?? "");

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, number: true, title: true, reporterId: true, assigneeId: true },
  });
  if (!ticket) return { errors: { form: t.errors.ticketGone } };
  if (!isStaff(user)) return { errors: { form: t.errors.agentsOnlyForward } };

  const parsed = forwardSchema.safeParse({
    toUserId: formData.get("toUserId"),
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error, t) };

  const { toUserId, message } = parsed.data;

  const recipient = await prisma.user.findFirst({
    where: { id: toUserId, isActive: true },
    select: { id: true, name: true, email: true },
  });
  if (!recipient) return { errors: { toUserId: t.errors.personInactive } };
  if (recipient.id === user.id) {
    return { errors: { toUserId: t.errors.notYourself } };
  }

  await prisma.$transaction([
    prisma.comment.create({
      data: {
        ticketId: ticket.id,
        authorId: user.id,
        isInternal: true,
        body: message
          ? t.ticket.forwardedNote(ticket.number, recipient.name, recipient.email, message)
          : t.ticket.forwardedNoteBare(ticket.number, recipient.name, recipient.email),
      },
    }),
    prisma.activity.create({
      data: {
        ticketId: ticket.id,
        actorId: user.id,
        type: "FORWARDED",
        field: "to",
        newValue: recipient.name,
      },
    }),
  ]);

  await notify({
    userId: recipient.id,
    actorId: user.id,
    ticketId: ticket.id,
    kind: "FORWARDED",
  });

  refreshTicket(ticket.number);
  return {};
}

/* -------------------------------------------------------------- requester -- */

/**
 * Re-points a ticket at the person it is really about. Agents only: the
 * requester decides who can see the ticket, so letting a requester change it
 * would let them hand their own ticket away — or take someone else's.
 */
export async function changeReporter(ticketId: string, userId: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canEditTicket(user)) {
    return { ok: false as const, error: t.errors.agentsOnlyRequester };
  }

  const [ticket, next] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, number: true, reporterId: true, reporter: { select: { name: true } } },
    }),
    prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  if (!ticket) return { ok: false as const, error: t.errors.ticketGone };
  if (!next) return { ok: false as const, error: t.errors.personInactive };
  if (next.id === ticket.reporterId) return { ok: true as const };

  await prisma.$transaction([
    prisma.ticket.update({ where: { id: ticket.id }, data: { reporterId: next.id } }),
    prisma.activity.create({
      data: {
        ticketId: ticket.id,
        actorId: user.id,
        type: "REPORTER_CHANGED",
        field: "reporter",
        oldValue: ticket.reporter.name,
        newValue: next.name,
      },
    }),
  ]);

  refreshTicket(ticket.number);
  return { ok: true as const };
}

/* ------------------------------------------------------- merge suggestions -- */

/**
 * Feeds the merge box. Scoped exactly like the ticket list, so an agent cannot
 * discover tickets they could not otherwise open, and the ticket being merged
 * is excluded so it can never be offered as its own target.
 */
export async function searchMergeTargets(ticketId: string, query: string) {
  const user = await requireUser();
  if (!canEditTicket(user)) return [];

  const trimmed = query.trim();

  const tickets = await prisma.ticket.findMany({
    where: {
      ...ticketVisibilityFilter(user),
      id: { not: ticketId },
      mergedIntoId: null,
      // A bare number matches the ticket number; anything else matches titles.
      ...(trimmed
        ? {
            OR: [
              ...(/^#?\d+$/.test(trimmed)
                ? [{ number: Number.parseInt(trimmed.replace("#", ""), 10) }]
                : []),
              { reference: { contains: trimmed, mode: "insensitive" as const } },
              { title: { contains: trimmed, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      number: true,
      reference: true,
      title: true,
      status: { select: { name: true } },
    },
  });

  return tickets;
}

/* ----------------------------------------------------------------- merge -- */

/** One end of a link, as the trail names it. */
type Named = { id: string; number: number; reference: string };

/**
 * What the merged ticket's links become on the survivor.
 *
 * Re-pointed rather than copied, so the statement keeps its direction: "A
 * blocks B" merged into C has to become "C blocks B" and not the other way
 * round. Two of them cannot survive the move — one whose far end *is* the
 * survivor, which would be a ticket blocking itself, and one the survivor
 * already says, in either direction — and those are dropped rather than left to
 * fail on the unique index halfway through a merge.
 *
 * Both histories get a row, because a link arriving on a ticket is news on the
 * ticket at each end of it.
 */
async function carryLinks(source: Named, target: Named, actorId: string) {
  const [carried, standing] = await Promise.all([
    prisma.ticketLink.findMany({
      where: { OR: [{ sourceId: source.id }, { targetId: source.id }] },
      select: {
        id: true,
        kind: true,
        sourceId: true,
        source: { select: { id: true, number: true, reference: true } },
        target: { select: { id: true, number: true, reference: true } },
      },
    }),
    prisma.ticketLink.findMany({
      where: { OR: [{ sourceId: target.id }, { targetId: target.id }] },
      select: { kind: true, sourceId: true, targetId: true },
    }),
  ]);

  // Both readings of everything the survivor already says, so the mirror of a
  // statement counts as the statement.
  const said = new Set<string>();
  const both = (kind: string, a: string, b: string) => [`${kind}:${a}:${b}`, `${kind}:${b}:${a}`];
  for (const link of standing) {
    for (const key of both(link.kind, link.sourceId, link.targetId)) said.add(key);
  }

  const drop: string[] = [];
  const move: { id: string; data: { sourceId: string } | { targetId: string } }[] = [];
  const trail: {
    ticketId: string;
    actorId: string;
    type: "LINKED";
    field: string;
    oldValue: string;
    newValue: string;
    link: string;
  }[] = [];

  for (const link of carried) {
    const incoming = link.sourceId !== source.id;
    const far = incoming ? link.source : link.target;

    if (far.id === target.id || said.has(both(link.kind, target.id, far.id)[0])) {
      drop.push(link.id);
      continue;
    }
    for (const key of both(link.kind, target.id, far.id)) said.add(key);

    move.push({ id: link.id, data: incoming ? { targetId: target.id } : { sourceId: target.id } });
    trail.push(
      {
        ticketId: target.id,
        actorId,
        type: "LINKED",
        field: incoming ? "in" : "out",
        oldValue: far.reference,
        newValue: link.kind,
        link: `/tickets/${far.number}`,
      },
      {
        ticketId: far.id,
        actorId,
        type: "LINKED",
        field: incoming ? "out" : "in",
        oldValue: target.reference,
        newValue: link.kind,
        link: `/tickets/${target.number}`,
      },
    );
  }

  return { drop, move, trail };
}

/**
 * Merging moves the source conversation onto the target and closes the source,
 * keeping its row so the old number still points at the survivor.
 */
export async function mergeTicket(_prev: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canEditTicket(user)) return { errors: { form: t.errors.agentsOnlyMerge } };

  const sourceId = String(formData.get("ticketId") ?? "");
  const raw = String(formData.get("targetNumber") ?? "")
    .trim()
    .replace("#", "");
  const targetNumber = Number.parseInt(raw, 10);

  if (!raw) return { errors: { targetNumber: t.errors.pickMergeTarget } };
  if (!Number.isSafeInteger(targetNumber)) {
    return { errors: { targetNumber: t.errors.notATicketNumber } };
  }

  const [source, target] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id: sourceId },
      select: { id: true, number: true, reference: true },
    }),
    prisma.ticket.findUnique({
      where: { number: targetNumber },
      select: { id: true, number: true, reference: true },
    }),
  ]);

  if (!source) return { errors: { form: t.errors.ticketGone } };
  if (!target) return { errors: { targetNumber: t.errors.noTicketNumbered(targetNumber) } };
  if (target.id === source.id) {
    return { errors: { targetNumber: t.errors.mergeIntoItself } };
  }

  // Whichever status the desk marked as its closing one. If nobody has marked
  // one, the merged ticket keeps the status it had — the conversation still
  // moves, which is the part that matters.
  const closing = await prisma.status.findFirst({
    where: { isClosing: true },
    select: { id: true },
  });
  const now = new Date();
  const links = await carryLinks(source, target, user.id);

  await prisma.$transaction([
    // Links follow the conversation. A ticket that was blocking something still
    // blocks it after it has been merged away, and a dependency left hanging
    // off a number nobody opens any more is one nobody sees again.
    ...(links.drop.length
      ? [prisma.ticketLink.deleteMany({ where: { id: { in: links.drop } } })]
      : []),
    ...links.move.map((move) =>
      prisma.ticketLink.update({ where: { id: move.id }, data: move.data }),
    ),
    prisma.activity.createMany({ data: links.trail }),
    prisma.comment.updateMany({ where: { ticketId: source.id }, data: { ticketId: target.id } }),
    prisma.ticket.update({
      where: { id: source.id },
      data: {
        ...(closing ? { statusId: closing.id, closedAt: now, resolvedAt: now } : {}),
        mergedIntoId: target.id,
      },
    }),
    prisma.activity.create({
      data: {
        ticketId: source.id,
        actorId: user.id,
        type: "MERGED",
        field: "mergedInto",
        newValue: `#${target.number}`,
      },
    }),
    prisma.activity.create({
      data: {
        ticketId: target.id,
        actorId: user.id,
        type: "MERGED",
        field: "mergedFrom",
        oldValue: `#${source.number}`,
      },
    }),
  ]);

  refreshTicket(source.number);
  refreshTicket(target.number);
  redirect(`/tickets/${target.number}`);
}

/* ---------------------------------------------------------------- delete -- */

/**
 * A hard delete takes the audit trail with it, which is exactly what an audit
 * trail is for — so it is its own permission, given to few.
 */
export async function deleteTicket(ticketId: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!can(user, "ticket.delete")) {
    return { ok: false as const, error: t.errors.noTicketDelete };
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { number: true },
  });
  if (!ticket) return { ok: false as const, error: t.errors.ticketAlreadyGone };

  // The rows cascade with the ticket; the files behind them do not.
  await purgeUploads({ ticketId });

  // Nor does the far end of every link it was part of. The link row itself
  // cascades, but the entry on the other ticket's trail stays — an openable
  // chip pointing at a number that now 404s, which reads as a broken app
  // rather than as a ticket somebody deleted.
  await prisma.activity.deleteMany({
    where: { type: { in: ["LINKED", "UNLINKED"] }, link: `/tickets/${ticket.number}` },
  });

  await prisma.ticket.delete({ where: { id: ticketId } });

  revalidatePath("/tickets");
  revalidatePath("/");
  return { ok: true as const };
}
