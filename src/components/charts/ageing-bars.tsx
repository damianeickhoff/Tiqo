"use client";

import type { AgeBucketKey } from "@/lib/analytics";
import { useMessages } from "@/components/shell/instance-context";

type Bucket = { key: AgeBucketKey; count: number; breached: number };

/**
 * How long the open work has been waiting, oldest at the bottom.
 *
 * One hue, stepped light to dark with age, because this is a magnitude on an
 * ordered scale and not five unrelated things — the ramp is the reading, and
 * the eye lands on the dark end without being told to.
 */
export function AgeingBars({ data }: { data: Bucket[] }) {
  const t = useMessages();

  const max = Math.max(1, ...data.map((bucket) => bucket.count));
  const total = data.reduce((sum, bucket) => sum + bucket.count, 0);

  if (total === 0) {
    return <p className="text-text-3 text-md px-5 pb-5">{t.dashboard.nothingOpen}</p>;
  }

  return (
    <ul className="space-y-3 px-5 pb-5">
      {data.map((bucket, i) => (
        <li key={bucket.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-text-2 text-base">{t.dashboard.ageBuckets[bucket.key]}</span>
            <span className="flex items-baseline gap-2">
              {bucket.breached > 0 ? (
                <span className="tnum text-negative text-sm font-medium">
                  {t.dashboard.late(bucket.breached)}
                </span>
              ) : null}
              <span className="tnum text-md font-semibold">{bucket.count}</span>
            </span>
          </div>

          <div className="bg-surface-3 relative h-2.5 overflow-hidden rounded-full">
            <div
              className="animate-grow-x absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${(bucket.count / max) * 100}%`,
                // Older is stronger. Stepped against transparency rather than
                // against the surface: mixing with a surface colour inverts the
                // ramp in dark mode, where "less brand" means "closer to black".
                background: `color-mix(in oklab, var(--brand) ${34 + i * 16}%, transparent)`,
                ["--i" as string]: i,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
