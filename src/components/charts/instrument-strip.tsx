"use client";

import Link from "next/link";
import { CountUp } from "@/components/charts/compliance-gauge";
import { cn } from "@/lib/utils";

export type Readout = {
  label: string;
  value: number;
  href: string;
  /// "warn" only when a number above zero is a problem — past target, or
  /// nobody's name on it. "brand" is the one figure the desk is about.
  tone?: "neutral" | "brand" | "warn";
  /// A short daily series to draw beside the figure, oldest first. Only given
  /// where the desk actually has one — a made-up line is worse than none.
  series?: number[];
  /// Marks the figure that moves as the queue moves.
  live?: boolean;
};

/**
 * The instrument strip: the four counts an operator reads before doing
 * anything, in one bar rather than four cards. Hairlines divide the readouts;
 * the numbers are the only large type on the page.
 */
export function InstrumentStrip({ readouts }: { readouts: Readout[] }) {
  return (
    <div className="card grid grid-cols-2 overflow-hidden lg:grid-cols-4">
      {readouts.map((readout, index) => (
        <Cell key={readout.label} {...readout} index={index} />
      ))}
    </div>
  );
}

function Cell({
  label,
  value,
  href,
  tone = "neutral",
  series,
  live,
  index,
}: Readout & { index: number }) {
  const alarmed = tone === "warn" && value > 0;
  const color = alarmed ? "var(--p-high)" : tone === "brand" ? "var(--brand)" : "var(--text-3)";

  return (
    <Link
      href={href}
      className={cn(
        "border-line hover:bg-surface-2 flex items-center justify-between gap-3 px-4 py-3.5 transition-[background-color] duration-100 lg:px-5 lg:py-4",
        // Hairlines between cells, whichever way the grid wraps: a top rule
        // on the second row at two columns, a left rule from the second cell
        // at four.
        index >= 2 && "border-t lg:border-t-0",
        index % 2 === 1 && "border-l",
        index >= 1 && "lg:border-l",
      )}
    >
      <span className="min-w-0">
        <span className="label flex items-center gap-2">
          <span className="truncate">{label}</span>
          {live ? (
            <span
              aria-hidden
              className="bg-brand size-1.5 shrink-0 rounded-full"
              style={{ boxShadow: "0 0 0 3px var(--brand-tint)" }}
            />
          ) : null}
        </span>
        <CountUp
          value={value}
          className={cn(
            "tnum mt-2 block text-2xl leading-none font-semibold tracking-[-0.03em]",
            alarmed && "text-p-high",
          )}
        />
      </span>

      {series && series.length > 1 ? <Sparkline points={series} color={color} /> : null}
    </Link>
  );
}

/** A hairline of recent history, no axes: the shape is the message. */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 96;
  const h = 28;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const coords = points.map((value, i) => [
    (i / (points.length - 1)) * w,
    h - 2 - ((value - min) / span) * (h - 4),
  ]);
  const path = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1]!;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
      className="hidden shrink-0 sm:block"
    >
      <polyline
        points={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="animate-draw"
        style={{ ["--dash" as string]: w * 2, strokeDasharray: w * 2 }}
      />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill={color} />
    </svg>
  );
}
