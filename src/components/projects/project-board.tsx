"use client";

import { useState, useTransition } from "react";
import { TicketPeekDialog } from "@/components/ticket-peek";
import { updateTicket } from "@/lib/actions/tickets";
import { PRIORITY_META } from "@/lib/tickets";
import { Avatar } from "@/components/avatar";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";
import type { Priority } from "@/generated/prisma/enums";

export type BoardTicket = {
  id: string;
  number: number;
  reference: string;
  title: string;
  priority: Priority;
  statusId: string | null;
  assignee: { name: string; avatarVariant: number } | null;
  milestone: { title: string } | null;
};

type Column = { id: string; name: string; color: string };

/**
 * The project's work, laid out in the desk's own statuses.
 *
 * Dragging writes through the same `updateTicket` everything else uses, so a
 * card moved here records the same activity, fires the same notification and
 * obeys the same clock rules as a status changed from the ticket page. A board
 * that quietly wrote its own column field would be a second source of truth.
 *
 * The card moves the instant it is dropped and is put back if the server says
 * no. Waiting for a round trip before the card follows the cursor is what makes
 * a board feel broken.
 */
export function ProjectBoard({
  columns,
  tickets,
  canEdit,
}: {
  columns: Column[];
  tickets: BoardTicket[];
  canEdit: boolean;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [moved, setMoved] = useState<Record<string, string | null>>({});
  const [over, setOver] = useState<string | null>(null);
  /// Which ticket is being read without leaving the board.
  const [peeking, setPeeking] = useState<number | null>(null);

  const columnOf = (ticket: BoardTicket) =>
    ticket.id in moved ? moved[ticket.id]! : ticket.statusId;

  function drop(ticketId: string, statusId: string) {
    const ticket = tickets.find((row) => row.id === ticketId);
    if (!ticket) return;

    const from = columnOf(ticket);
    if (from === statusId) return;

    setMoved((current) => ({ ...current, [ticketId]: statusId }));
    startTransition(async () => {
      const result = await updateTicket(ticketId, { statusId });
      if (!result.ok) setMoved((current) => ({ ...current, [ticketId]: from }));
    });
  }

  if (columns.length === 0) {
    return <p className="text-text-3 text-md py-10 text-center">{t.projects.noStatuses}</p>;
  }

  return (
    <>
      {peeking !== null ? (
        <TicketPeekDialog number={peeking} onClose={() => setPeeking(null)} />
      ) : null}

      <div className="flex gap-3 overflow-x-auto pb-3">
        {columns.map((column) => {
          const cards = tickets.filter((ticket) => columnOf(ticket) === column.id);

          return (
            <section
              key={column.id}
              onDragOver={(event) => {
                if (!canEdit) return;
                event.preventDefault();
                setOver(column.id);
              }}
              onDragLeave={() => setOver((current) => (current === column.id ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setOver(null);
                const id = event.dataTransfer.getData("text/plain");
                if (id) drop(id, column.id);
              }}
              className={cn(
                "bg-surface-2 rounded-card flex w-[17rem] shrink-0 flex-col p-2 transition-colors",
                over === column.id && "bg-[var(--brand-tint)]",
              )}
            >
              <header className="flex items-center gap-2 px-2 py-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: column.color }}
                />
                <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{column.name}</h2>
                <span className="tnum text-text-3 text-sm">{cards.length}</span>
              </header>

              <ul className="min-h-[4rem] space-y-2">
                {cards.length === 0 ? (
                  <li className="text-text-3 px-2 py-4 text-center text-sm">
                    {t.projects.emptyColumn}
                  </li>
                ) : (
                  cards.map((ticket) => (
                    <li key={ticket.id}>
                      <button
                        type="button"
                        onClick={() => setPeeking(ticket.number)}
                        draggable={canEdit}
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", ticket.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        className={cn(
                          "card block w-full p-3 text-left transition-shadow",
                          canEdit && "cursor-grab active:cursor-grabbing",
                          pending && "opacity-70",
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ background: PRIORITY_META[ticket.priority].color }}
                          />
                          <span className="text-text-3 font-mono text-xs font-medium">
                            {ticket.reference}
                          </span>
                          {ticket.assignee ? (
                            <span className="ml-auto">
                              <Avatar
                                name={ticket.assignee.name}
                                variant={ticket.assignee.avatarVariant}
                                size={18}
                              />
                            </span>
                          ) : null}
                        </span>

                        <span className="mt-1.5 block text-base leading-snug font-medium">
                          {ticket.title}
                        </span>

                        {ticket.milestone ? (
                          <span className="bg-surface-3 text-text-2 mt-2 inline-block rounded-full px-2 py-0.5 text-xs">
                            {ticket.milestone.title}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
