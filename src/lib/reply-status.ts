import "server-only";

import { prisma } from "@/lib/prisma";
import { getClock } from "@/lib/settings";
import { pauseFields } from "@/lib/tickets";
import type { ActivityType } from "@/generated/prisma/enums";

/**
 * What answering does to a ticket that was waiting for the answer.
 *
 * A desk parks a ticket on the person who raised it and stops the clock. The
 * moment they write back, that parking is over — and leaving the ticket sitting
 * in "waiting on user" means the clock stays stopped on work that is now the
 * desk's again, and nobody sees it come back.
 *
 * Which status it moves to is the desk's own business: each status carries the
 * one it hands over to, so nothing here knows any status by name.
 *
 * Returns the activity to record, or null when there was nothing to do.
 */
export async function moveOnRequesterReply(ticket: {
  id: string;
  reporterId: string;
  statusId: string | null;
  pausedMinutes: number;
  pausedSince: Date | null;
}) {
  const status = ticket.statusId
    ? await prisma.status.findUnique({
        where: { id: ticket.statusId },
        select: {
          name: true,
          pausesClock: true,
          onReplyStatus: { select: { id: true, name: true, pausesClock: true } },
        },
      })
    : null;

  const next = status?.onReplyStatus;
  if (!next) return null;

  const clock = await getClock();

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      statusId: next.id,
      ...pauseFields(status, next, ticket, clock.hours),
    },
  });

  return {
    type: "STATUS_CHANGED" as ActivityType,
    field: "status",
    oldValue: status?.name ?? null,
    newValue: next.name,
  };
}
