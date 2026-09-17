"use client";

import { useEffect, useRef, useState } from "react";
import type { Priority } from "@/generated/prisma/enums";
import { PRIORITY_META, shortSpan } from "@/lib/tickets";
import { useMessages } from "@/components/shell/instance-context";

/**
 * One hero number with a ring behind it, and underneath it the reason for the
 * number: which priorities are keeping their promise and which are not. The
 * ring alone says something is wrong; the rows say where.
 */
export function ComplianceGauge({
  pct,
  withinTarget,
  total,
  byPriority,
  medianResolutionHours,
}: {
  pct: number;
  withinTarget: number;
  total: number;
  byPriority: { priority: Priority; met: number; total: number }[];
  medianResolutionHours: number | null;
}) {
  const messages = useMessages();
  const radius = 62;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  const filled = (pct / 100) * circumference;

  const tone = pct >= 90 ? "var(--positive)" : pct >= 70 ? "var(--brand)" : "var(--negative)";

  // Nothing with a target has been settled yet — say so, but still answer the
  // other question the card is asked: how long does work here actually take?
  if (total === 0) {
    return (
      <div className="px-5 pb-6">
        <p className="text-text-3 text-md">{messages.dashboard.noneMeasured}</p>
        {medianResolutionHours === null ? null : (
          <p className="text-text-2 text-md mt-3">
            {messages.dashboard.typicalResolution(
              shortSpan(medianResolutionHours * 36e5, messages),
            )}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-5 pb-5">
      <div className="relative">
        <svg
          width="160"
          height="160"
          viewBox="0 0 160 160"
          role="img"
          aria-label={messages.dashboard.complianceAria(pct)}
        >
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth={stroke}
          />
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={tone}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            transform="rotate(-90 80 80)"
            className="animate-draw"
            style={{ ["--dash" as string]: circumference }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <CountUp value={pct} className="tnum text-3xl leading-none font-bold" suffix="%" />
          <span className="text-text-3 mt-1 text-sm">{messages.dashboard.onTarget}</span>
        </div>
      </div>

      {/* One sentence, not a template with two bold numbers dropped into it:
          the numbers sit in different places in different languages, and the
          reading everyone actually takes is the percentage above. */}
      <p className="text-text-2 tnum mt-3 text-center text-base">
        {messages.dashboard.compliance(withinTarget, total)}
      </p>

      <ul className="mt-4 w-full space-y-2 pt-4">
        {byPriority.map((row) => {
          const met = Math.round((row.met / row.total) * 100);
          return (
            <li key={row.priority} className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: PRIORITY_META[row.priority].color }}
              />
              <span className="text-text-2 w-16 shrink-0 text-sm">
                {messages.vocab.priority[row.priority]}
              </span>

              <span className="bg-surface-3 relative h-1.5 flex-1 overflow-hidden rounded-full">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${met}%`,
                    background:
                      met >= 90
                        ? "var(--positive)"
                        : met >= 70
                          ? "var(--brand)"
                          : "var(--negative)",
                  }}
                />
              </span>

              <span className="tnum text-text-3 w-14 shrink-0 text-right text-sm">
                {row.met}/{row.total}
              </span>
            </li>
          );
        })}
      </ul>

      {medianResolutionHours === null ? null : (
        <p className="text-text-3 mt-4 w-full pt-3 text-center text-sm">
          {messages.dashboard.typicalResolution(shortSpan(medianResolutionHours * 36e5, messages))}
        </p>
      )}
    </div>
  );
}

/** Counts up once on mount, and only when motion is welcome. */
export function CountUp({
  value,
  className,
  suffix = "",
}: {
  value: number;
  className?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    const skip =
      started.current ||
      value === 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    started.current = true;

    // Every state write goes through a frame callback — setting state straight
    // from the effect body would cascade an extra render on each mount.
    if (skip) {
      const id = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(id);
    }

    const duration = 800;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic — fast then settling, which reads as "landing" on a figure.
      setDisplay(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className={className}>
      {display}
      {suffix}
    </span>
  );
}
