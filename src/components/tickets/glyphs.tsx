import type { Priority } from "@/generated/prisma/enums";
import { PRIORITY_META, isSettled, type TicketStatus } from "@/lib/tickets";
import { cn } from "@/lib/utils";

/*
 * The two glyphs every list and panel share. Pure drawings with no server
 * imports, so a client component can use them as freely as a server one.
 */

/**
 * Priority as signal bars: one to four lit, in the priority's hue. The same
 * rising bars as the mark, so a row's priority and the logo are one drawing.
 * The unlit bars stay faintly there — a lone bar with nothing beside it reads
 * as a smudge, not as "low".
 */
export function PriorityBars({
  priority,
  className,
  title,
}: {
  priority: Priority;
  className?: string;
  title?: string;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={cn("inline-flex h-3.5 shrink-0 items-end gap-0.5", className)}
      role="img"
      aria-label={title ?? meta.label}
      title={title ?? meta.label}
    >
      {[5, 8, 11, 14].map((height, index) => (
        <span
          key={height}
          className="w-[3px] rounded-[1px]"
          style={{
            height,
            background: meta.color,
            opacity: index < meta.level ? 1 : 0.22,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Status as a ring: empty while new, part-filled while it moves, a tick once it
 * settles. The colour is the status's own, so a desk that names its stages
 * differently still reads the same shapes.
 */
export function StatusRing({
  status,
  title,
  className,
}: {
  status: TicketStatus;
  /// The status by name, for somewhere the ring stands without one written
  /// beside it. A shape that means "still open" only to whoever drew it is
  /// decoration.
  title?: string;
  className?: string;
}) {
  const r = 5;
  const circumference = 2 * Math.PI * r;
  const color = status?.color ?? "var(--text-3)";
  const settled = status ? isSettled(status) : false;

  return (
    <svg
      viewBox="0 0 14 14"
      className={cn("size-3.5 shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      style={{ color }}
    >
      {title ? <title>{title}</title> : null}
      <circle
        cx="7"
        cy="7"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity={settled ? 1 : 0.35}
        strokeDasharray={status ? undefined : "2 2"}
      />
      {settled ? (
        <path
          d="M4.6 7.3 6.6 9.3 9.6 5.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : status ? (
        // Half a ring: in motion, not yet settled. No status at all — a
        // deleted one — leaves only the dashed outline above.
        <circle
          cx="7"
          cy="7"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeDasharray={`${circumference * 0.5} ${circumference}`}
          transform="rotate(-90 7 7)"
        />
      ) : null}
    </svg>
  );
}
