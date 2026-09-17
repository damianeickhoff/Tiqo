"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * Three states and a search box. A requester's own list never needs more.
 *
 * The counts sit on the segments rather than beside them: "Open 2" answers in
 * one glance the question the tab is for, and a person with nothing open should
 * be able to see that without pressing anything.
 */
export function RequestFilters({
  q,
  show,
  counts,
}: {
  q: string;
  show: string;
  counts: { all: number; open: number; settled: number };
}) {
  const t = useMessages();
  const router = useRouter();

  const tabs = [
    { key: "all", label: t.portal.filterAll, count: counts.all },
    { key: "open", label: t.portal.filterOpen, count: counts.open },
    { key: "settled", label: t.portal.filterSettled, count: counts.settled },
  ];

  function go(next: { show?: string; q?: string }) {
    const query = new URLSearchParams();
    const state = { show, q, ...next };
    if (state.show && state.show !== "all") query.set("show", state.show);
    if (state.q) query.set("q", state.q);
    router.push(`/portal/requests${query.size ? `?${query}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="bg-surface-2 flex items-center gap-0.5 rounded-full p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={show === tab.key}
            onClick={() => go({ show: tab.key })}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base font-medium transition-colors",
              show === tab.key
                ? "bg-surface text-text shadow-[var(--shadow-sm)]"
                : "text-text-2 hover:text-text",
            )}
          >
            {tab.label}
            <span className="tnum text-text-3 font-mono text-xs">{tab.count}</span>
          </button>
        ))}
      </div>

      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem("q") as HTMLInputElement;
          go({ q: input.value.trim() });
        }}
      >
        <Search
          size={15}
          aria-hidden
          className="text-text-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <input
          name="q"
          defaultValue={q}
          placeholder={t.portal.searchRequests}
          aria-label={t.portal.searchRequests}
          className="border-line bg-surface placeholder:text-text-3 focus:border-brand h-9 w-56 rounded-full border pr-3 pl-9 text-base transition-[border-color,box-shadow] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none"
        />
      </form>
    </div>
  );
}
