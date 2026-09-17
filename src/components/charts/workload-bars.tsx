"use client";

import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { useMessages } from "@/components/shell/instance-context";

/**
 * Who is carrying what. One measure, one hue — the brand ramp — with the
 * overdue portion picked out so a heavy queue and a late queue are different
 * readings.
 */
export function WorkloadBars({
  data,
}: {
  data: {
    id: string | null;
    name: string;
    avatarVariant: number | null;
    open: number;
    overdue: number;
  }[];
}) {
  const t = useMessages();
  const max = Math.max(1, ...data.map((d) => d.open));

  if (data.length === 0) {
    return <p className="text-text-3 text-md px-5 pb-5">{t.dashboard.nothingOpen}</p>;
  }

  return (
    <ul className="space-y-3 px-5 pb-5">
      {data.map((row, i) => {
        const unassigned = row.id === null;
        return (
          <li key={row.id ?? "none"} className="flex items-center gap-3">
            {unassigned ? (
              <span
                aria-hidden
                className="border-line size-[26px] shrink-0 rounded-full border border-dashed"
              />
            ) : (
              <Avatar name={row.name} variant={row.avatarVariant} size={26} />
            )}

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className={`truncate text-base ${unassigned ? "text-text-3 italic" : ""}`}>
                  {unassigned ? t.dashboard.unassigned : row.name}
                </span>
                <span className="flex items-baseline gap-2">
                  {row.overdue > 0 ? (
                    <span className="tnum text-negative text-sm">
                      {t.dashboard.late(row.overdue)}
                    </span>
                  ) : null}
                  <span className="tnum text-base font-semibold">{row.open}</span>
                </span>
              </div>

              <div className="bg-surface-3 relative h-2 overflow-hidden rounded-full">
                <div
                  className="animate-grow-x bg-brand absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${(row.open / max) * 100}%`, ["--i" as string]: i }}
                />
                {row.overdue > 0 ? (
                  <div
                    className="animate-grow-x absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${(row.overdue / max) * 100}%`,
                      background: "var(--negative)",
                      ["--i" as string]: i,
                    }}
                  />
                ) : null}
              </div>
            </div>
          </li>
        );
      })}

      <li className="pt-1">
        <Link href="/tickets?assignee=none" className="text-text-3 hover:text-text text-sm">
          {t.dashboard.seeUnassigned} →
        </Link>
      </li>
    </ul>
  );
}
