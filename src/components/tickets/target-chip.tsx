import { CalendarClock } from "lucide-react";
import type { Priority, TicketType } from "@/generated/prisma/enums";
import {
  PRIORITY_META,
  type TicketStatus,
  hasResponseTarget,
  heatOf,
  hoursToTarget,
  isPastDue,
  isSettled,
} from "@/lib/tickets";
import { CHIP } from "@/components/tickets/indicators";
import { dateLocaleOf, getClock, getMessages, getSettings } from "@/lib/settings";

type ChipTicket = {
  priority: Priority;
  type: TicketType;
  status: TicketStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  dueDate: Date | null;
};

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

/**
 * Incidents run against a response target and get a dial. Questions and changes
 * have no clock, so they show a due date if one was set — and nothing at all if
 * not, rather than a countdown that means nothing.
 */
export async function TargetChip({ ticket }: { ticket: ChipTicket }) {
  if (!hasResponseTarget(ticket.type)) {
    return ticket.dueDate ? (
      <DueChip dueDate={ticket.dueDate} settled={isSettled(ticket.status)} />
    ) : null;
  }

  const [clock, t] = await Promise.all([getClock(), getMessages()]);
  const meta = PRIORITY_META[ticket.priority];
  const settled = isSettled(ticket.status);
  const remainingHours = hoursToTarget(ticket, clock) ?? 0;
  const over = remainingHours < 0;

  const label = settled
    ? over
      ? t.ticket.missedBy(humanise(-remainingHours))
      : t.ticket.metWithToSpare(humanise(remainingHours))
    : over
      ? t.ticket.overTarget(humanise(-remainingHours))
      : t.ticket.leftToTarget(humanise(remainingHours));

  const tone = settled ? "var(--text-3)" : over ? meta.color : "var(--text-2)";
  const ringColor = settled ? "var(--border)" : meta.color;
  const degrees = Math.round(Math.min(1, heatOf(ticket, clock)) * 360);

  return (
    <span
      className={`${CHIP} border-border bg-surface-2 pl-1.5`}
      title={`${clock.targets[ticket.priority]}h response target for ${meta.label.toLowerCase()} incidents`}
    >
      <span
        aria-hidden
        className="grid size-[15px] place-items-center rounded-full"
        style={{
          background: `conic-gradient(${ringColor} ${degrees}deg, var(--surface-3) ${degrees}deg)`,
        }}
      >
        <span className="bg-surface-2 size-[9px] rounded-full" />
      </span>
      <span style={{ color: tone }}>{label}</span>
    </span>
  );
}

async function DueChip({ dueDate, settled }: { dueDate: Date; settled: boolean }) {
  const [settings, t] = await Promise.all([getSettings(), getMessages()]);
  const dayFormat = new Intl.DateTimeFormat(dateLocaleOf(settings), DAY);
  const overdue = !settled && isPastDue(dueDate);

  return (
    <span
      className={`${CHIP} border-border bg-surface-2`}
      style={overdue ? { color: "var(--negative)", borderColor: "var(--negative)" } : undefined}
      title={t.ticket.due}
    >
      <CalendarClock size={13} className={overdue ? "" : "text-text-3"} />
      <span className={overdue ? "" : "text-text-2"}>
        {overdue ? `${t.ticket.overdue} ` : `${t.ticket.due} `}
        {dayFormat.format(dueDate)}
      </span>
    </span>
  );
}

/** Coarse on purpose — "2d" is the reading, "2d 3h 12m" is noise. */
function humanise(hours: number) {
  const total = Math.max(0, hours);
  if (total < 1) return `${Math.max(1, Math.round(total * 60))}m`;
  if (total < 48) return `${Math.round(total)}h`;
  return `${Math.round(total / 24)}d`;
}
