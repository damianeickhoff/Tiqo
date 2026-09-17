"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { VolumePoint } from "@/lib/analytics";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * The chart draws at its own size in real pixels rather than in a fixed
 * coordinate space stretched to fit. A viewBox scaled up to a wide card scales
 * everything in it with the geometry — a 2px line arrives as a 3px one and an
 * 11px label as a 16px one — which is what made this read as a blown-up
 * picture of a chart rather than a chart.
 */
const H = 168;
const PAD = { top: 14, right: 10, bottom: 26, left: 34 };
const MIN_W = 320;

const RANGES = [14, 30, 90] as const;

/**
 * Tickets in against tickets out. One y-axis for both: they are the same
 * measure in the same unit, which is the only case where two lines belong on
 * one scale.
 *
 * The band between them is the point of the chart. Its thickness is the day's
 * imbalance and its colour is the direction — it takes the colour of whichever
 * line is on top — so "the queue grew this week" is a thing you see rather than
 * a subtraction you perform.
 *
 * Every range is sent once and sliced here. Ninety points is a few hundred
 * bytes, and a round trip per range change would be slower than the animation
 * it interrupts.
 */
export function VolumeChart({ data }: { data: VolumePoint[] }) {
  const t = useMessages();
  const clipId = useId();
  const [days, setDays] = useState<number>(14);
  const [hover, setHover] = useState<number | null>(null);
  const [W, setW] = useState(720);

  const frame = useRef<HTMLDivElement>(null);

  // Its own width, watched: the card it sits in is fluid, and the point of
  // drawing in pixels is lost the moment the two disagree.
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setW(Math.max(MIN_W, Math.round(entry!.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(() => data.slice(-days), [data, days]);

  const { max, xs, ys, createdPath, resolvedPath, bands, totals } = useMemo(() => {
    const max = Math.max(4, ...points.map((d) => Math.max(d.created, d.resolved)));
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const x = (i: number) =>
      PAD.left + (points.length === 1 ? innerW / 2 : (i * innerW) / (points.length - 1));
    const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

    const line = (key: "created" | "resolved") =>
      curve(points.map((d, i) => ({ x: x(i), y: y(d[key]) })));

    // One shape per day-pair, split at the crossing when the lines swap over,
    // so a band is never half a lie about its own direction.
    const bands: { d: string; growing: boolean }[] = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const gapA = a.created - a.resolved;
      const gapB = b.created - b.resolved;
      const [xa, xb] = [x(i), x(i + 1)];

      const quad = (x1: number, c1: number, r1: number, x2: number, c2: number, r2: number) =>
        `M${x1.toFixed(1)},${y(c1).toFixed(1)} L${x2.toFixed(1)},${y(c2).toFixed(1)} ` +
        `L${x2.toFixed(1)},${y(r2).toFixed(1)} L${x1.toFixed(1)},${y(r1).toFixed(1)} Z`;

      if (gapA === 0 && gapB === 0) continue;

      if (gapA === 0 || gapB === 0 || gapA > 0 === gapB > 0) {
        bands.push({
          d: quad(xa, a.created, a.resolved, xb, b.created, b.resolved),
          growing: (gapA || gapB) > 0,
        });
        continue;
      }

      const cross = gapA / (gapA - gapB);
      const xc = xa + (xb - xa) * cross;
      const vc = a.created + (b.created - a.created) * cross;

      bands.push({ d: quad(xa, a.created, a.resolved, xc, vc, vc), growing: gapA > 0 });
      bands.push({ d: quad(xc, vc, vc, xb, b.created, b.resolved), growing: gapB > 0 });
    }

    return {
      max,
      xs: points.map((_, i) => x(i)),
      ys: {
        created: (i: number) => y(points[i]!.created),
        resolved: (i: number) => y(points[i]!.resolved),
      },
      createdPath: line("created"),
      resolvedPath: line("resolved"),
      bands,
      totals: points.reduce(
        (sum, point) => ({
          created: sum.created + point.created,
          resolved: sum.resolved + point.resolved,
        }),
        { created: 0, resolved: 0 },
      ),
    };
  }, [points, W]);

  const ticks = [0, Math.round(max / 2), max];
  const active = hover === null ? null : points[hover];
  const net = totals.created - totals.resolved;

  return (
    <div ref={frame} className="relative px-2 pb-2">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-3">
        <Key color="var(--series-created)" label={t.dashboard.raised} value={totals.created} />
        <Key color="var(--series-resolved)" label={t.dashboard.resolved} value={totals.resolved} />

        <span
          className={cn(
            "tnum rounded-full px-2 py-0.5 text-sm font-semibold",
            net > 0
              ? "bg-[color-mix(in_oklab,var(--series-created)_16%,transparent)] text-[var(--series-created)]"
              : net < 0
                ? "bg-[color-mix(in_oklab,var(--series-resolved)_16%,transparent)] text-[var(--series-resolved)]"
                : "bg-surface-3 text-text-3",
          )}
        >
          {net > 0
            ? t.dashboard.queueGrew(net)
            : net < 0
              ? t.dashboard.queueShrank(-net)
              : t.dashboard.queueLevel}
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => {
                setDays(range);
                setHover(null);
              }}
              aria-pressed={days === range}
              className={cn(
                "tnum rounded-full px-2 py-1 text-sm font-medium transition-colors",
                days === range
                  ? "text-brand-deep bg-[var(--brand-tint)]"
                  : "text-text-3 hover:bg-surface-3 hover:text-text",
              )}
            >
              {t.dashboard.lastDays(range)}
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block overflow-visible"
        role="img"
        aria-label={t.dashboard.volumeAria(points.length, totals.created, totals.resolved)}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.left} y={PAD.top - 6} width={W - PAD.left - PAD.right} height={H} />
          </clipPath>
        </defs>

        {ticks.map((tick) => {
          const y =
            PAD.top + (H - PAD.top - PAD.bottom) - (tick / max) * (H - PAD.top - PAD.bottom);
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="var(--border-soft)"
                strokeWidth="1"
              />
              <text x={PAD.left - 8} y={y + 3.5} textAnchor="end" className="fill-text-3 text-xs">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Keyed on the range so switching redraws rather than snapping: the
            animation is what makes the new shape legible as a change. */}
        <g key={days}>
          <g className="animate-fade" clipPath={`url(#${clipId})`} style={{ ["--i" as string]: 3 }}>
            {bands.map((band, i) => (
              <path
                key={i}
                d={band.d}
                fill={band.growing ? "var(--series-created)" : "var(--series-resolved)"}
                fillOpacity="0.15"
              />
            ))}
          </g>

          <path
            d={resolvedPath}
            fill="none"
            stroke="var(--series-resolved)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-draw"
            style={{ strokeDasharray: W * 2, ["--dash" as string]: W * 2, ["--i" as string]: 1 }}
          />
          <path
            d={createdPath}
            fill="none"
            stroke="var(--series-created)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-draw"
            style={{ strokeDasharray: W * 2, ["--dash" as string]: W * 2 }}
          />
        </g>

        {hover !== null ? (
          <line
            x1={xs[hover]}
            x2={xs[hover]}
            y1={PAD.top - 4}
            y2={H - PAD.bottom}
            stroke="var(--text-3)"
            strokeWidth="1"
          />
        ) : null}

        {/* Hit areas are far wider than the marks, so the crosshair is easy to catch. */}
        {points.map((point, i) => (
          <rect
            key={point.date}
            x={xs[i]! - (W - PAD.left - PAD.right) / points.length / 2}
            y={0}
            width={(W - PAD.left - PAD.right) / points.length}
            height={H - PAD.bottom}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {hover !== null ? (
          <g>
            <circle
              cx={xs[hover]}
              cy={ys.created(hover)}
              r="4.5"
              fill="var(--series-created)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
            <circle
              cx={xs[hover]}
              cy={ys.resolved(hover)}
              r="4.5"
              fill="var(--series-resolved)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          </g>
        ) : null}

        {points.map((point, i) =>
          i % Math.ceil(points.length / 7) === 0 ? (
            <text
              key={point.date}
              x={xs[i]}
              y={H - 8}
              textAnchor="middle"
              className="fill-text-3 text-xs"
            >
              {point.date.slice(5).replace("-", "/")}
            </text>
          ) : null,
        )}
      </svg>

      {active ? (
        <div
          className="border-line bg-surface rounded-control pointer-events-none absolute top-8 border px-3 py-2 text-base shadow-[var(--shadow-md)]"
          style={{ left: `${xs[hover!]! - 48}px` }}
        >
          <p className="text-text-3 mb-1 font-mono text-xs">{active.date}</p>
          <p className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: "var(--series-created)" }} />
            <span className="tnum font-semibold">{active.created}</span>
            <span className="text-text-2">{t.dashboard.raised.toLowerCase()}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ background: "var(--series-resolved)" }}
            />
            <span className="tnum font-semibold">{active.resolved}</span>
            <span className="text-text-2">{t.dashboard.resolved.toLowerCase()}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A monotone cubic through the points. Straight segments turn sparse daily
 * counts into a hard zigzag; a plain spline overshoots and would draw a day at
 * minus one ticket. This bends without inventing either.
 */
function curve(pts: { x: number; y: number }[]) {
  const at = (i: number) => `${pts[i]!.x.toFixed(1)},${pts[i]!.y.toFixed(1)}`;
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${at(0)}`;

  const slopes = pts.map((_, i) => {
    if (i === 0 || i === pts.length - 1) return 0;
    const left = pts[i]!.y - pts[i - 1]!.y;
    const right = pts[i + 1]!.y - pts[i]!.y;
    // Flat at every turning point: that is what keeps the curve monotone, so it
    // never dips below a day that was already zero.
    return left * right <= 0 ? 0 : (left + right) / 2;
  });

  let d = `M${at(0)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const dx = (b.x - a.x) / 3;
    const c1 = `${(a.x + dx).toFixed(1)},${(a.y + slopes[i]! / 3).toFixed(1)}`;
    const c2 = `${(b.x - dx).toFixed(1)},${(b.y - slopes[i + 1]! / 3).toFixed(1)}`;
    d += ` C${c1} ${c2} ${at(i + 1)}`;
  }
  return d;
}

function Key({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="text-text-2 flex items-center gap-1.5 text-sm">
      <span className="h-0.5 w-3.5 rounded-full" style={{ background: color }} />
      {label}
      <span className="tnum text-text font-semibold">{value}</span>
    </span>
  );
}
