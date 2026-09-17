"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { CountUp } from "@/components/charts/compliance-gauge";
import { cn } from "@/lib/utils";

/**
 * A stat tile, not a chart: one number is the reading. The sparkline behind it
 * is shape-only — no axis, no labels — so it suggests direction without
 * pretending to be readable.
 */
export function KpiTile({
  label,
  value,
  href,
  spark,
  delta,
  deltaLabel,
  tone = "neutral",
  index = 0,
}: {
  label: string;
  value: number;
  href: string;
  spark?: number[];
  delta?: number;
  deltaLabel?: string;
  tone?: "neutral" | "brand" | "warn";
  index?: number;
}) {
  const accent =
    tone === "brand" ? "var(--brand)" : tone === "warn" ? "var(--negative)" : "var(--text-3)";

  return (
    <Link
      href={href}
      className="card card-interactive animate-rise relative overflow-hidden p-4"
      style={{ ["--i" as string]: index }}
    >
      {tone !== "neutral" ? (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: accent }}
        />
      ) : null}

      <p className="label">{label}</p>

      <div className="mt-2 flex items-end justify-between gap-3">
        <CountUp value={value} className="tnum text-2xl leading-none font-bold" />
        {spark && spark.length > 1 ? <Sparkline data={spark} color={accent} /> : null}
      </div>

      {delta !== undefined ? (
        <p className="mt-2.5 flex items-center gap-1 text-sm">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
              delta >= 0 ? "bg-positive/12 text-positive" : "bg-negative/12 text-negative",
            )}
          >
            {delta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(delta)}
          </span>
          <span className="text-text-3">{deltaLabel}</span>
        </p>
      ) : null}
    </Link>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 68;
  const h = 26;
  const max = Math.max(1, ...data);
  const step = w / (data.length - 1);
  const path = data
    .map(
      (v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`,
    )
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
        className="animate-draw"
        style={{ strokeDasharray: 300, ["--dash" as string]: 300 }}
      />
    </svg>
  );
}
