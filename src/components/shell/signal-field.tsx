import { cn } from "@/lib/utils";

/**
 * A field of rising bars: the mark's motif at landscape scale.
 *
 * Every bar is a ticket climbing toward the dashed line — its response target
 * — and the ones over it glow. Most are brand amber; a few carry a priority hue
 * so the field reads as a queue rather than a chart. Heights come from a fixed
 * curve, so the two themes and every render agree, and the bars rise on mount
 * with the one stagger the desk keeps (`--i`, honoured by `animate-grow-y`;
 * reduced motion collapses it).
 *
 * No server imports: the sign-in page and the portal both draw it.
 */
export function SignalField({
  bars = 44,
  height = 320,
  target = 0.68,
  className,
  label,
}: {
  bars?: number;
  height?: number | string;
  /// Where the target line sits, as a fraction of the height.
  target?: number;
  className?: string;
  /// The caption on the line. Left out, the line is drawn bare.
  label?: string;
}) {
  const hues = ["var(--p-urgent)", "var(--p-high)", "var(--p-medium)", "var(--p-low)"];

  return (
    <div
      aria-hidden
      className={cn("relative w-full overflow-hidden", className)}
      style={{ height }}
    >
      <div className="absolute inset-0 flex items-end gap-[3px]">
        {Array.from({ length: bars }, (_, i) => {
          const t = bars > 1 ? i / (bars - 1) : 0;
          const wave =
            0.32 +
            0.28 * Math.sin(t * 6.1 + 0.8) +
            0.18 * Math.sin(t * 13.7 + 2.1) +
            0.12 * Math.sin(t * 27 + 0.3);
          const fill = Math.max(0.06, Math.min(0.98, wave));
          const amber = (i * 7) % 11 !== 0;
          const color = amber ? "var(--brand)" : hues[(i * 5) % 4]!;
          const hot = fill > target;

          return (
            <span
              key={i}
              className="animate-grow-y block min-w-[3px] flex-1 rounded-t-[3px]"
              style={{
                height: `${Math.round(fill * 100)}%`,
                background: color,
                opacity: hot ? 1 : 0.28 + fill * 0.5,
                boxShadow: hot ? `0 0 14px 1px ${color}` : undefined,
                ["--i" as string]: i * 0.3,
              }}
            />
          );
        })}
      </div>

      <span
        className="absolute inset-x-0 border-t border-dashed border-current opacity-30"
        style={{ bottom: `${Math.round(target * 100)}%` }}
      />
      {label ? (
        <span
          className="absolute right-0 font-mono text-[11px] tracking-[0.06em] uppercase opacity-60"
          style={{ bottom: `calc(${Math.round(target * 100)}% + 6px)` }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
