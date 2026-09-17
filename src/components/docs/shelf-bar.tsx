"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ArrowUpDown, LayoutGrid, Rows3 } from "lucide-react";
import { setDocPref } from "@/lib/actions/docs";
import type { DocPrefs } from "@/lib/docs";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type ShelfCounts = { all: number; stale: number; mine: number; archived: number };

const SHOWS = ["all", "stale", "mine", "archived"] as const;
export type ShelfShow = (typeof SHOWS)[number];

const SORTS = ["updated", "title", "review"] as const;
export type ShelfSort = (typeof SORTS)[number];

/**
 * What of the shelf is on screen, and how it is drawn.
 *
 * Four chips rather than a dropdown, because they are the four questions the
 * shelf is asked — everything, what is behind, what is mine, and what was put
 * away — and a chip carries its own count where an option cannot. Everything
 * here is a list-level command and takes effect at once: nothing on this bar
 * describes anything, it only decides what is shown.
 *
 * The filters live in the address so a shelf somebody is looking at can be
 * sent to somebody else. Cards-or-rows does not: it is a preference about
 * reading, not about this shelf, and it follows the account.
 */
export function ShelfBar({
  counts,
  owners,
  view,
}: {
  counts: ShelfCounts;
  owners: { id: string; name: string }[];
  view: DocPrefs["shelf"];
}) {
  const t = useMessages();
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const show = (params.get("show") ?? "all") as ShelfShow;
  const sort = (params.get("sort") ?? "updated") as ShelfSort;
  const owner = params.get("owner") ?? "";

  function setParam(name: string, next: string) {
    const query = new URLSearchParams(params.toString());
    if (next && next !== "all") query.set(name, next);
    else query.delete(name);
    router.push(`?${query.toString()}`, { scroll: false });
  }

  function setView(next: DocPrefs["shelf"]) {
    if (next === view) return;
    startTransition(async () => {
      await setDocPref({ shelf: next });
      router.refresh();
    });
  }

  return (
    <div className="border-line flex flex-wrap items-center gap-2 border-b px-5 py-2.5 lg:px-8">
      <div
        role="group"
        aria-label={t.docs.shown}
        className="bg-surface-2 flex items-center gap-0.5 rounded-full p-0.5"
      >
        {SHOWS.map((option) => (
          <button
            key={option}
            type="button"
            aria-current={show === option}
            onClick={() => setParam("show", option)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow]",
              show === option
                ? "text-text bg-[var(--seg-on)] shadow-[0_1px_2px_rgba(9,9,11,0.1),0_0_0_1px_rgba(9,9,11,0.04)]"
                : "text-text-2 hover:text-text",
            )}
          >
            {t.docs.shelfShow[option]}
            <span
              className={cn(
                "tnum text-xs",
                option === "stale" && counts.stale > 0 ? "text-negative" : "text-text-3",
              )}
            >
              {counts[option]}
            </span>
          </button>
        ))}
      </div>

      <label className="sr-only" htmlFor="shelf-owner">
        {t.docs.owner}
      </label>
      <select
        id="shelf-owner"
        value={owner}
        onChange={(event) => setParam("owner", event.target.value)}
        className={CHIP}
      >
        <option value="">{t.docs.anyOwner}</option>
        {owners.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>

      <span className="text-text-3 ml-auto flex items-center gap-1.5 text-sm">
        <ArrowUpDown size={13} aria-hidden />
        <label className="sr-only" htmlFor="shelf-sort">
          {t.docs.sort}
        </label>
        <select
          id="shelf-sort"
          value={sort}
          onChange={(event) => setParam("sort", event.target.value)}
          className={CHIP}
        >
          {SORTS.map((option) => (
            <option key={option} value={option}>
              {t.docs.shelfSort[option]}
            </option>
          ))}
        </select>
      </span>

      <div
        role="group"
        aria-label={t.docs.shelfView}
        className="bg-surface-2 flex items-center gap-0.5 rounded-full p-0.5"
      >
        {(
          [
            ["cards", LayoutGrid, t.docs.asCards],
            ["list", Rows3, t.docs.asList],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            disabled={pending}
            aria-pressed={view === id}
            title={label}
            aria-label={label}
            onClick={() => setView(id)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full transition-[background-color,color,box-shadow] disabled:opacity-50",
              view === id
                ? "text-text bg-[var(--seg-on)] shadow-[0_1px_2px_rgba(9,9,11,0.1),0_0_0_1px_rgba(9,9,11,0.04)]"
                : "text-text-2 hover:text-text",
            )}
          >
            <Icon size={13} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** A chip-shaped select, as the ticket queue's filters wear. */
const CHIP =
  "select-chevron h-7 cursor-pointer appearance-none rounded-full border border-line bg-surface " +
  "pr-7 pl-2.5 text-sm font-medium text-text-2 shadow-[var(--highlight)] " +
  "transition-[border-color,color] hover:border-line-strong hover:text-text " +
  "focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-[var(--brand-tint)]";
