import type { Priority } from "@/generated/prisma/enums";
import {
  PRIORITY_META,
  burnedTo,
  hasResponseTarget,
  heatOf,
  isSettled,
  type Clocked,
  type TicketStatus,
} from "@/lib/tickets";
import { getClock, getMessages } from "@/lib/settings";
import { PriorityBars, StatusRing } from "@/components/tickets/glyphs";
import { cn } from "@/lib/utils";

// The pure glyphs live in `glyphs` so client components can import them
// without dragging the server-only settings module along; they are re-exported
// here so the server side keeps one import.
export { PriorityBars, StatusRing };

/** One geometry for every ticket chip, so status, priority and target read as
 *  a set rather than three different components that happen to sit together. */
export const CHIP =
  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 " +
  "text-sm font-medium whitespace-nowrap";

/** Priority is the one categorical encoding, so it always gets its own hue. */
export async function PriorityTag({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const t = await getMessages();
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={cn(CHIP, "font-semibold", className)}
      style={{
        color: meta.color,
        background: `color-mix(in oklab, ${meta.color} 12%, transparent)`,
        borderColor: `color-mix(in oklab, ${meta.color} 28%, transparent)`,
      }}
    >
      <PriorityBars priority={priority} title={t.vocab.priority[priority]} />
      {t.vocab.priority[priority]}
    </span>
  );
}

/**
 * Status as a ring and a word. Not hued as a pill — the ring carries the
 * colour, and it keeps priority the only fill competing for attention.
 */
export async function StatusPill({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  const t = await getMessages();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm whitespace-nowrap",
        status && !isSettled(status) ? "text-text-2" : "text-text-3",
        className,
      )}
    >
      <StatusRing status={status} />
      {/* A ticket whose status was deleted still has to render as something. */}
      {status?.name ?? t.tickets.noStatus}
    </span>
  );
}

/** The ramp the spine burns along: fresh, halfway, close, over. Four stops
 *  rather than a gradient — a colour has to be namable to be readable. */
const HEAT_RAMP: [limit: number, color: string][] = [
  [0.5, "var(--positive)"],
  [0.75, "var(--brand)"],
  [1, "var(--p-high)"],
  [Infinity, "var(--negative)"],
];

/** Close enough that the bar grows a head. */
const NEARLY = 0.85;

function heatColor(heat: number) {
  return HEAT_RAMP.find(([limit]) => heat < limit)![1];
}

/**
 * The heat spine. How much of the ticket's own deadline has burned, as a bar
 * that fills and changes colour as it goes: green while there is room, amber at
 * half, orange near the line, rose past it.
 *
 * It reads the deadline, not the priority. Priority is what set the deadline in
 * the first place for an incident, and it is on the row twice already — the
 * question this bar answers is "how long have I got", which is the one you
 * cannot work out from a colour that never moves.
 *
 * Near the line the bar grows a lit head, because a red bar among red bars is
 * not a signal and a dot that appears is.
 */
export async function HeatSpine({
  ticket,
  className,
}: {
  ticket: Clocked & { dueDate?: Date | null };
  className?: string;
}) {
  const clock = await getClock();
  const settled = isSettled(ticket.status);

  // An incident's deadline comes from its priority; everything else has one
  // only if somebody set a due date. Without either there is nothing to show,
  // and an empty track is more honest than a full bar that means nothing.
  const heat = hasResponseTarget(ticket.type)
    ? heatOf(ticket, clock)
    : ticket.dueDate
      ? burnedTo(ticket.createdAt, ticket.dueDate)
      : null;

  const color = heat === null ? "var(--text-3)" : heatColor(heat);
  const filled = heat === null ? 0 : Math.round(Math.min(1, heat) * 100);
  const lit = heat !== null && heat >= NEARLY && !settled;

  return (
    <span
      className={cn("relative block h-9 w-1 shrink-0 self-center rounded-full", className)}
      style={{ background: `color-mix(in oklab, ${color} 16%, transparent)` }}
      aria-hidden
    >
      <span
        className="animate-grow-y absolute inset-x-0 bottom-0 rounded-full"
        style={{ height: `${filled}%`, background: color, opacity: settled ? 0.3 : 1 }}
      />

      {lit ? (
        <span
          className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full"
          style={{
            bottom: `calc(${filled}% - 3px)`,
            background: color,
            boxShadow: `0 0 7px 2px color-mix(in oklab, ${color} 70%, transparent)`,
          }}
        />
      ) : null}
    </span>
  );
}
