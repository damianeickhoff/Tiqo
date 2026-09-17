import Link from "next/link";
import { Plus } from "lucide-react";
import type { Priority } from "@/generated/prisma/enums";
import { getMessages } from "@/lib/settings";
import { PriorityBars, StatusRing } from "@/components/tickets/glyphs";
import { Reference } from "@/components/tickets/ticket-row";
import { PanelCard } from "@/components/tickets/panel-card";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

export type CiTicketRow = {
  number: number;
  reference: string;
  title: string;
  priority: Priority;
  status: { name: string; color: string; settles: boolean } | null;
  when: string;
};

/** How many are worth reading before the rest becomes history. A server the
 *  desk has had for three years has hundreds, and a card that renders all of
 *  them is a page that scrolls for a minute. */
const SHOWN = 50;

/**
 * What has been raised against this asset.
 *
 * This is the register's whole reason for existing. "What else is broken on this
 * host" is a question a spreadsheet of serial numbers cannot answer, and it is
 * the question somebody is holding when they arrive on this page — so Open is
 * what the card opens on, and All is there for the other question, which is
 * "has this always been like that".
 *
 * The toggle is a pair of links rather than a piece of state, for the same
 * reason every filter on the register is: it belongs in the address, so it can
 * be sent to somebody and is still true after a reload.
 *
 * Raise carries the asset with it, because the person who has just read three
 * incidents against a switch should not have to find it again in a picker.
 */
export async function CiTickets({
  tickets,
  itemId,
  all,
  canRaise,
}: {
  tickets: CiTicketRow[];
  itemId: string;
  /// Whether the settled ones are showing too.
  all: boolean;
  /// Anybody may raise a ticket — that is not a permission — but only somebody
  /// who may name assets can have one pre-attached.
  canRaise: boolean;
}) {
  const t = await getMessages();

  const open = tickets.filter((ticket) => !ticket.status?.settles);
  const shown = (all ? tickets : open).slice(0, SHOWN);

  return (
    <PanelCard
      title={t.cmdb.tickets}
      action={
        <span className="flex items-center gap-2">
          <span className="bg-surface-2 flex gap-0.5 rounded-full p-0.5">
            <Toggle href={`/cmdb/${itemId}`} on={!all} label={`${t.cmdb.openHeading} ${open.length}`} />
            <Toggle
              href={`/cmdb/${itemId}?tickets=all`}
              on={all}
              label={`${t.cmdb.allTickets} ${tickets.length}`}
            />
          </span>
          {canRaise ? (
            <Link href={`/tickets/new?ci=${itemId}`} className={buttonClass("outline", "sm")}>
              <Plus size={12} strokeWidth={2.5} />
              {t.cmdb.raise}
            </Link>
          ) : null}
        </span>
      }
    >
      {shown.length === 0 ? (
        <p className="text-text-3 px-3.5 py-3 text-base">
          {all ? t.cmdb.noTickets : t.cmdb.noOpenTickets}
        </p>
      ) : (
        <ul className="divide-line divide-y">
          {shown.map((ticket) => (
            <li key={ticket.number}>
              <Link
                href={`/tickets/${ticket.number}`}
                className={cn(
                  "hover:bg-surface-2 flex items-center gap-2.5 px-3.5 py-2 transition-colors",
                  // Settled tickets stay readable but stop competing: they are
                  // history, and the open ones above them are the work.
                  ticket.status?.settles && "opacity-55",
                )}
              >
                <StatusRing status={ticket.status ? { ...ticket.status, id: "" } : null} />
                <Reference reference={ticket.reference} className="hidden shrink-0 sm:block" />
                <span className="min-w-0 flex-1 truncate text-base font-medium">
                  {ticket.title}
                </span>
                <span className="text-text-3 hidden shrink-0 text-sm sm:block">{ticket.when}</span>
                <PriorityBars priority={ticket.priority} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}

function Toggle({ href, on, label }: { href: string; on: boolean; label: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
        on ? "bg-surface text-text shadow-[var(--highlight)]" : "text-text-2 hover:text-text",
      )}
    >
      {label}
    </Link>
  );
}
