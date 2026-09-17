"use client";

import { useState } from "react";
import Link from "next/link";
import type { StatusSlice } from "@/lib/analytics";
import { useMessages } from "@/components/shell/instance-context";

/**
 * Workflow stage is ordinal, so it gets a single-hue sequential ramp rather than
 * five unrelated hues — which also keeps the one categorical palette in this
 * dashboard (priority) unambiguous.
 */
const STAGE_VAR = [
  "var(--stage-1)",
  "var(--stage-2)",
  "var(--stage-3)",
  "var(--stage-4)",
  "var(--stage-5)",
];

export function PipelineBar({ data }: { data: StatusSlice[] }) {
  const t = useMessages();
  const [hover, setHover] = useState<string | null>(null);

  // A ticket with no status still has to be named on screen.
  const nameOf = (slice: StatusSlice) => slice.name || t.tickets.noStatus;
  const total = data.reduce((sum, slice) => sum + slice.count, 0);

  if (total === 0) {
    return <p className="text-text-3 text-md px-5 pb-5">{t.dashboard.noTicketsYet}</p>;
  }

  return (
    <div className="@container px-5 pb-5">
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full">
        {data.map((slice, i) =>
          slice.count === 0 ? null : (
            <div
              key={slice.id}
              className="animate-grow-x h-full transition-opacity duration-150"
              style={{
                width: `${(slice.count / total) * 100}%`,
                background: STAGE_VAR[i],
                opacity: hover && hover !== slice.id ? 0.35 : 1,
                ["--i" as string]: i,
              }}
              onMouseEnter={() => setHover(slice.id)}
              onMouseLeave={() => setHover(null)}
              title={`${nameOf(slice)}: ${slice.count}`}
            />
          ),
        )}
      </div>

      {/* Measured against the card, not the window: this sits in a four-up row
          on a wide screen and a two-up row on a narrow one. */}
      <ul className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 @[15rem]:grid-cols-2">
        {data.map((slice, i) => (
          <li key={slice.id}>
            <Link
              href={`/tickets?status=${slice.id}`}
              className="rounded-control flex items-center gap-2 py-0.5 transition-opacity"
              style={{ opacity: hover && hover !== slice.id ? 0.45 : 1 }}
              onMouseEnter={() => setHover(slice.id)}
              onMouseLeave={() => setHover(null)}
            >
              <span
                aria-hidden
                className="rounded-chip size-2.5 shrink-0"
                style={{ background: STAGE_VAR[i] }}
              />
              <span className="text-text-2 truncate text-base">{nameOf(slice)}</span>
              <span className="tnum ml-auto text-base font-semibold">{slice.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
