"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { peekTicket, type TicketPeek } from "@/lib/actions/peek";
import { Modal } from "@/components/modal";
import { Markdown } from "@/components/markdown";
import { Avatar } from "@/components/avatar";
import { buttonClass } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

/**
 * A ticket, without leaving the project.
 *
 * Reading one ticket should not cost the place you were standing. This shows
 * enough to answer "what is this and where is it up to" — and hands over to the
 * ticket's own page for anything that needs doing, rather than trying to be a
 * second copy of it that slowly falls behind.
 */
export function TicketPeekDialog({ number, onClose }: { number: number; onClose: () => void }) {
  const t = useMessages();
  const [ticket, setTicket] = useState<TicketPeek | null>(null);
  /// Told apart from "still loading": a reference can point at a ticket this
  /// person is not allowed to read, and a dialog that spins forever is a worse
  /// answer than one that says so.
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    peekTicket(number).then((row) => {
      if (!live) return;
      setTicket(row);
      setMissing(row === null);
    });
    return () => {
      live = false;
    };
  }, [number]);

  return (
    <Modal
      title={ticket?.title ?? t.projects.quickLook}
      description={ticket?.reference}
      onClose={onClose}
    >
      {missing ? (
        <p className="text-text-3 py-8 text-center text-base">{t.common.noMatches}</p>
      ) : !ticket ? (
        <p className="text-text-3 py-8 text-center text-base">{t.common.saving}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {ticket.status ? (
              <span
                className="rounded-full px-2.5 py-1 text-sm font-medium"
                style={{
                  background: `color-mix(in oklab, ${ticket.status.color} 16%, transparent)`,
                  color: `color-mix(in oklab, ${ticket.status.color} 70%, var(--text))`,
                }}
              >
                {ticket.status.name}
              </span>
            ) : null}

            <span className="bg-surface-3 text-text-2 rounded-full px-2.5 py-1 text-sm">
              {t.vocab.priority[ticket.priority]}
            </span>

            {ticket.assignee ? (
              <span className="text-text-2 ml-auto inline-flex items-center gap-1.5 text-base">
                <Avatar
                  name={ticket.assignee.name}
                  variant={ticket.assignee.avatarVariant}
                  size={20}
                />
                {ticket.assignee.name}
              </span>
            ) : null}
          </div>

          {ticket.description ? (
            <Markdown
              text={ticket.description}
              className="text-md max-h-[40vh] overflow-y-auto leading-relaxed"
            />
          ) : (
            <p className="text-text-3 text-base">{t.ticket.noDescription}</p>
          )}

          <div className="border-border-soft flex items-center justify-between gap-3 border-t pt-4">
            <span className="text-text-3 text-sm">{t.portal.replyCount(ticket.comments)}</span>
            <Link
              href={`/tickets/${ticket.number}`}
              className={buttonClass("primary", "md")}
              onClick={onClose}
            >
              {t.projects.openFull}
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}
