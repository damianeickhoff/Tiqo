import Link from "next/link";
import type { Priority, TicketType } from "@/generated/prisma/enums";
import { shortAge, type TicketStatus } from "@/lib/tickets";
import { getMessages } from "@/lib/settings";
import { HeatSpine, PriorityBars } from "@/components/tickets/indicators";
import { PanelCard } from "@/components/tickets/panel-card";
import { Reference } from "@/components/tickets/ticket-row";

export type OpenTicket = {
  id: string;
  number: number;
  reference: string;
  title: string;
  status: TicketStatus;
  priority: Priority;
  type: TicketType;
  createdAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  pausedMinutes: number;
  pausedSince: Date | null;
};

/**
 * What this person has open right now — the answer to "can I give them another
 * one", which the numbers in the header only hint at.
 *
 * Three rows, hottest first. A longer list belongs in the queue, which is what
 * the link is for; a rail card that grows to twenty rows stops being a summary
 * of the person and becomes a second queue nobody asked for.
 */
export async function AssignedNow({
  tickets,
  total,
  href,
  /// A requester has no queue: what they have open is what they asked for.
  raised = false,
}: {
  tickets: OpenTicket[];
  total: number;
  href: string;
  raised?: boolean;
}) {
  const t = await getMessages();

  return (
    <PanelCard
      title={raised ? t.people.theirRequests : t.people.assignedNow}
      className="h-fit"
      action={
        total > 0 ? (
          <Link
            href={href}
            className="text-brand-deep text-xs font-medium transition-colors hover:underline"
          >
            {t.ticket.allOf(total)}
          </Link>
        ) : null
      }
      bodyClassName="px-3.5 pb-3"
    >
      {tickets.length === 0 ? (
        <p className="text-text-3 py-3 text-base">{t.people.nothingAssigned}</p>
      ) : (
        <ul className="divide-line divide-y">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/tickets/${ticket.number}`}
                className="grid grid-cols-[4px_minmax(0,1fr)] items-stretch gap-3 py-2.5"
              >
                <HeatSpine ticket={ticket} />
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium">{ticket.title}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <Reference reference={ticket.reference} />
                    <PriorityBars priority={ticket.priority} />
                    <span className="text-text-3 tnum ml-auto font-mono text-xs">
                      {shortAge(ticket.createdAt, undefined, t)}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
