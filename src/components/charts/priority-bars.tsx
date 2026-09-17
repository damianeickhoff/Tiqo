"use client";

import Link from "next/link";
import type { PrioritySlice } from "@/lib/analytics";
import { PRIORITY_META } from "@/lib/tickets";
import { usePriorityTargets, useMessages } from "@/components/shell/instance-context";

/**
 * Open tickets by priority, with the portion already past its response target
 * drawn as a solid inset. Every bar is direct-labelled, which is the secondary
 * encoding the amber step needs against a light surface.
 */
export function PriorityBars({ data }: { data: PrioritySlice[] }) {
  const targets = usePriorityTargets();
  const t = useMessages();
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <ul className="space-y-3.5 px-5 pb-5">
      {data.map((slice, i) => {
        const meta = PRIORITY_META[slice.priority];
        return (
          <li key={slice.priority}>
            <Link href={`/tickets?priority=${slice.priority}`} className="group block">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-base">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: meta.color }}
                  />
                  <span className="text-text-2 group-hover:text-text">
                    {t.vocab.priority[slice.priority]}
                  </span>
                  <span className="text-text-3 text-sm">{targets[slice.priority]}h</span>
                </span>
                <span className="flex items-baseline gap-2">
                  {slice.breached > 0 ? (
                    <span className="tnum text-negative text-sm font-medium">
                      {t.dashboard.late(slice.breached)}
                    </span>
                  ) : null}
                  <span className="tnum text-md font-semibold">{slice.count}</span>
                </span>
              </div>

              <div className="bg-surface-3 relative h-2.5 overflow-hidden rounded-full">
                <div
                  className="animate-grow-x absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${(slice.count / max) * 100}%`,
                    background: `color-mix(in oklab, ${meta.color} 32%, transparent)`,
                    ["--i" as string]: i,
                  }}
                />
                {slice.breached > 0 ? (
                  <div
                    className="animate-grow-x absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${(slice.breached / max) * 100}%`,
                      background: meta.color,
                      ["--i" as string]: i,
                    }}
                  />
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
