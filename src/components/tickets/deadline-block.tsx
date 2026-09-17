"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { Priority, TicketType } from "@/generated/prisma/enums";
import { updateTicket } from "@/lib/actions/tickets";
import { addWorkingMinutes } from "@/lib/clock";
import {
  PRIORITY_META,
  deadlineOf,
  hasResponseTarget,
  heatOf,
  hoursToTarget,
  isPastDue,
  isSettled,
  type TicketStatus,
} from "@/lib/tickets";
import { PanelCard } from "@/components/tickets/panel-card";
import { useClock, useDateFormat, useMessages } from "@/components/shell/instance-context";

type BlockTicket = {
  priority: Priority;
  type: TicketType;
  status: TicketStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  pausedMinutes: number;
  pausedSince: Date | null;
  dueDate: Date | null;
};

const DAY: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
};

const SHORT_DAY: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
};

/** The strip is a fortnight: long enough to show a due date coming, short
 *  enough that one segment is still a day and not a smear. */
const STRIP_DAYS = 14;

/** "3h 20m", "2d 4h" — the way a countdown is read aloud. */
function span(hours: number) {
  const total = Math.max(0, Math.round(hours * 60));
  const days = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  if (days > 0) return `${days}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Whole days between now and a date, rounded towards the date. */
function daysUntil(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

/**
 * The clock on a ticket. An incident runs against a response target: this
 * shows how much of it has burned, in the priority's colour, and glows once
 * it is over. A question or a change is committed to by a date instead, edited
 * here rather than in a field further down — this is the only place a
 * deadline is set.
 */
export function DeadlineBlock({
  ticketId,
  ticket,
  canEdit,
}: {
  ticketId: string;
  ticket: BlockTicket;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    ticket.dueDate ? ticket.dueDate.toISOString().slice(0, 10) : "",
  );
  const [pending, startTransition] = useTransition();
  const clock = useClock();
  const t = useMessages();
  const day = useDateFormat(DAY);
  const shortDay = useDateFormat(SHORT_DAY);
  // The desk's own zone, because the target maths run in the desk's hours: a
  // raised time in the reader's zone and a target in the desk's would not add
  // up on screen.
  const time = useDateFormat({
    hour: "2-digit",
    minute: "2-digit",
    timeZone: clock.hours.timeZone,
  });

  const settled = isSettled(ticket.status);
  const timed = hasResponseTarget(ticket.type);
  const { date, derived } = deadlineOf(ticket, clock);
  const overdue = Boolean(date) && !settled && isPastDue(date!);
  const color = PRIORITY_META[ticket.priority].color;

  function save(value: string) {
    startTransition(async () => {
      await updateTicket(ticketId, { dueDate: value === "" ? null : value });
      setEditing(false);
    });
  }

  if (timed) {
    const remaining = hoursToTarget(ticket, clock) ?? 0;
    const heat = Math.min(1, heatOf(ticket, clock));
    const paused = Boolean(ticket.status?.pausesClock) && !settled;
    // Where the promise now falls, not where it fell when the ticket arrived:
    // every minute spent waiting on the requester moves it further out, and a
    // target that ignored that would be one the bar above it disagrees with.
    const target = addWorkingMinutes(new Date(), remaining * 60, clock.hours);
    // Amber while it is parked, rather than the priority's colour. A stopped
    // clock is not urgent — it is somebody else's turn, and that is the one
    // thing about the card worth noticing from across the page.
    const clockColor = paused ? "var(--brand)" : color;

    return (
      <PanelCard
        title={t.ticket.responseTarget}
        action={
          settled ? null : (
            <span
              className="text-xs font-medium"
              style={{ color: paused ? "var(--brand-deep)" : "var(--text-3)" }}
            >
              {paused ? t.ticket.clockPaused : t.ticket.clockRunning}
            </span>
          )
        }
        bodyClassName="px-3.5 pt-3 pb-3.5"
      >
        {/* Settled keeps the sentence it always had: the clock has stopped, so
            there is no countdown to run, only a verdict on how it went. */}
        {settled ? (
          <p className="text-text-2 text-md font-medium">
            {remaining < 0
              ? t.ticket.missedBy(span(-remaining))
              : t.ticket.metWithToSpare(span(remaining))}
          </p>
        ) : (
          <p className="flex items-baseline gap-1.5">
            <span
              className="tnum font-mono text-xl leading-none font-semibold tracking-[-0.02em]"
              style={{ color: clockColor }}
            >
              {span(remaining < 0 ? -remaining : remaining)}
            </span>
            <span className="text-text-2 text-base">
              {remaining < 0 ? t.ticket.overLabel : t.ticket.leftLabel}
            </span>
          </p>
        )}

        <div className="bg-surface-3 mt-2.5 h-1.5 overflow-hidden rounded-full">
          <span
            className="animate-grow-x block h-full rounded-full"
            style={{
              width: `${Math.round(heat * 100)}%`,
              background: settled ? "var(--text-3)" : clockColor,
              boxShadow: overdue && !settled && !paused ? `0 0 8px ${color}` : undefined,
            }}
          />
        </div>

        <p className="text-text-3 mt-2 flex flex-wrap justify-between gap-x-3 text-xs">
          <span>
            {t.ticket.raisedAt(time.format(ticket.createdAt))} · {t.ticket.pausesWhileWaiting}
          </span>
          <span>
            {t.ticket.targetAt(time.format(target))} ·{" "}
            {t.ticket.targetForPriority(
              clock.targets[ticket.priority],
              t.vocab.priority[ticket.priority],
            )}
          </span>
        </p>
      </PanelCard>
    );
  }

  const left = date ? daysUntil(date) : null;
  // Filled up to today: the strip ends on the due date, so what is coloured is
  // the part of the fortnight already spent.
  const filled = left === null ? 0 : Math.max(0, Math.min(STRIP_DAYS, STRIP_DAYS - left));

  return (
    <PanelCard
      title={t.ticket.due}
      action={
        canEdit && !derived && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-brand-deep flex items-center gap-1 text-xs font-medium hover:underline"
          >
            <Pencil size={11} />
            {t.common.edit}
          </button>
        ) : null
      }
      bodyClassName="px-3.5 pt-3 pb-3.5"
    >
      {editing ? (
        <div className="animate-rise flex items-center gap-1.5">
          <input
            type="date"
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={t.ticket.dueDateLabel}
            className="bg-surface focus:border-brand rounded-control h-8 min-w-0 flex-1 border border-transparent px-2 text-base shadow-[var(--highlight)] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => save(draft)}
            disabled={pending}
            aria-label={t.ticket.saveDueDate}
            className="bg-brand rounded-control flex size-8 shrink-0 items-center justify-center text-[var(--brand-ink)] disabled:opacity-50"
          >
            <Check size={14} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(ticket.dueDate ? ticket.dueDate.toISOString().slice(0, 10) : "");
              setEditing(false);
            }}
            aria-label={t.common.cancel}
            className="text-text-3 hover:text-text rounded-control flex size-8 shrink-0 items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <p className="flex items-baseline gap-1.5">
            <span
              className="tnum font-mono text-xl leading-none font-semibold tracking-[-0.02em]"
              style={{ color: overdue ? "var(--negative)" : date ? undefined : "var(--text-3)" }}
            >
              {date ? day.format(date) : t.ticket.noDeadlineSet}
            </span>
            {date && !settled ? (
              <span className="text-text-2 text-base">
                ·{" "}
                {overdue
                  ? t.ticket.overdue
                  : left === 0
                    ? t.ticket.dueToday
                    : t.ticket.daysLeft(left!)}
              </span>
            ) : null}
          </p>

          {date ? (
            <div aria-hidden className="mt-2.5 flex gap-0.5">
              {Array.from({ length: STRIP_DAYS }, (_, index) => (
                <span
                  key={index}
                  className="h-1.5 flex-1 rounded-[2px]"
                  style={{
                    background:
                      index < filled
                        ? overdue
                          ? "var(--negative)"
                          : "var(--brand)"
                        : "var(--surface-3)",
                  }}
                />
              ))}
            </div>
          ) : null}

          <p className="text-text-3 mt-2 text-xs">
            {t.ticket.committedOn(shortDay.format(ticket.createdAt))} ·{" "}
            {t.ticket.noTargetForKind(t.vocab.typePlural[ticket.type])}
          </p>
        </>
      )}
    </PanelCard>
  );
}
