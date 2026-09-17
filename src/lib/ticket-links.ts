import type { TicketLinkKind } from "@/generated/prisma/enums";

/**
 * The trail entry a link writes, from one end of it.
 *
 * Out of `src/lib/actions/ticket-links.ts` because a `"use server"` module may
 * only export async functions, and a ticket raised as somebody's child writes
 * the same pair of entries while it is being created — from `actions/tickets.ts`,
 * which cannot import a server action to do it.
 *
 * Both ends carry the forward verb and differ only in which of the two tickets
 * is "this": `field` says which, and `oldValue` carries the far reference so the
 * entry can be made openable without a second query to find out what it is
 * called.
 */
export function linkEntry(
  type: "LINKED" | "UNLINKED",
  kind: TicketLinkKind,
  {
    on,
    far,
    incoming,
  }: {
    on: { id: string };
    far: { number: number; reference: string };
    incoming: boolean;
  },
  actorId: string,
) {
  return {
    ticketId: on.id,
    actorId,
    type,
    field: incoming ? "in" : "out",
    oldValue: far.reference,
    newValue: kind,
    link: `/tickets/${far.number}`,
  };
}
