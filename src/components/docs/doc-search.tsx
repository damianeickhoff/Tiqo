"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Search, X } from "lucide-react";
import { findDocs } from "@/lib/actions/docs";
import { docHref } from "@/lib/docs";
import { useMessages } from "@/components/shell/instance-context";

type Hit = Awaited<ReturnType<typeof findDocs>>[number];

/**
 * One box over everything that has been written down.
 *
 * The widest thing on the page, because it is the thing people arrive with:
 * somebody standing on the documentation is nearly always looking for one page
 * they half remember, and the shelves are for the other times. The body is
 * searched as well as the title — people look for the error message, not for
 * the name it was filed under.
 *
 * `/` puts the caret here from anywhere on the page, which is the shortcut
 * every search box in this app answers to.
 */
export function DocSearch({ children }: { children: React.ReactNode }) {
  const t = useMessages();
  const box = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      // Somebody typing a slash into a field means a slash.
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      box.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Asked for after a pause rather than on every keystroke: the body of every
  // page is being scanned, and a query per letter is the same search eight
  // times with the first seven thrown away.
  useEffect(() => {
    const needle = query.trim();
    const timer = setTimeout(() => {
      if (needle.length < 2) {
        setHits(null);
        return;
      }
      startTransition(async () => setHits(await findDocs(needle)));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search
          size={15}
          aria-hidden
          className="text-text-3 pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
        />
        <input
          ref={box}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === "Escape" && setQuery("")}
          placeholder={t.docs.searchDocs}
          aria-label={t.docs.searchDocs}
          className="border-line bg-surface placeholder:text-text-3 focus:border-brand hover:border-line-strong rounded-card text-md h-11 w-full border pr-24 pl-10 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none"
        />
        <span className="absolute top-1/2 right-3.5 flex -translate-y-1/2 items-center gap-2">
          {pending ? <Loader2 size={14} className="text-text-3 animate-spin" /> : null}
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t.docs.clearSearch}
              className="text-text-3 hover:text-text transition-colors"
            >
              <X size={14} />
            </button>
          ) : (
            <kbd className="border-line text-text-3 rounded-control border px-1.5 py-0.5 font-mono text-xs">
              /
            </kbd>
          )}
        </span>
      </div>

      {/* The shelves stay where they are until there is something to put in
          front of them: a page that empties itself while somebody types has
          nothing to go back to when they give up on the word they chose. */}
      {hits === null ? (
        children
      ) : hits.length === 0 ? (
        <p className="border-line text-text-3 rounded-card border border-dashed px-4 py-8 text-center text-base">
          {t.docs.noMatches}
        </p>
      ) : (
        <ul className="border-line divide-line rounded-card divide-y overflow-hidden border">
          {hits.map((hit) => (
            <li key={hit.id}>
              <Link
                href={docHref(hit.space.key, hit.slug)}
                className="hover:bg-surface-2 flex items-start gap-2.5 px-4 py-2.5 transition-colors"
              >
                <span
                  aria-hidden
                  className="mt-1.5 size-2 shrink-0 rounded-full"
                  style={{ background: hit.space.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium">{hit.title}</span>
                  {hit.summary ? (
                    <span className="text-text-3 block truncate text-sm">{hit.summary}</span>
                  ) : null}
                </span>
                <span className="text-text-3 shrink-0 font-mono text-xs">{hit.space.key}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
