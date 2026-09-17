"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, Search } from "lucide-react";
import { searchPortal } from "@/lib/actions/portal";
import type { SearchHit } from "@/lib/portal";
import { PortalIcon } from "@/components/portal/portal-icon";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * The portal's front door.
 *
 * Search first, browse second: people arrive knowing what they want in their
 * own words, and a catalogue is only the fallback for when they do not. Answers
 * and forms are offered together, because "here is the article that fixes it"
 * is a better outcome than "here is the form to ask us to".
 */
export function PortalSearch({
  size = "hero",
  placeholder,
  autoFocus = false,
  initialQuery = "",
}: {
  size?: "hero" | "compact";
  placeholder?: string;
  autoFocus?: boolean;
  initialQuery?: string;
}) {
  const t = useMessages();
  const router = useRouter();

  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(-1);

  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function change(next: string) {
    setQuery(next);
    setOpen(true);
    setActive(-1);

    if (timer.current) clearTimeout(timer.current);

    if (next.trim().length < 2) {
      setHits([]);
      setBusy(false);
      return;
    }

    setBusy(true);
    timer.current = setTimeout(async () => {
      const found = await searchPortal(next);
      // Answers can land out of order; only the newest query's may be shown.
      if (input.current?.value === next) {
        setHits(found);
        setBusy(false);
      }
    }, 180);
  }

  function go(hit: SearchHit) {
    setOpen(false);
    setQuery("");
    input.current?.blur();
    router.push(hit.kind === "form" ? `/portal/f/${hit.slug}` : `/portal/kb/${hit.slug}`);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const hero = size === "hero";

  return (
    <div ref={box} className="relative w-full">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (active >= 0 && hits[active]) return go(hits[active]);
          if (query.trim()) router.push(`/portal/search?q=${encodeURIComponent(query.trim())}`);
        }}
      >
        <Search
          size={hero ? 20 : 16}
          aria-hidden
          className={cn(
            "text-text-3 pointer-events-none absolute top-1/2 -translate-y-1/2",
            hero ? "left-5" : "left-3.5",
          )}
        />

        <input
          ref={input}
          value={query}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && query.trim().length >= 2}
          aria-controls="portal-search-results"
          placeholder={placeholder ?? t.portal.searchPlaceholder}
          aria-label={t.portal.searchPlaceholder}
          onChange={(event) => change(event.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "ArrowDown" && hits.length > 0) {
              event.preventDefault();
              setActive((current) => (current + 1) % hits.length);
            }
            if (event.key === "ArrowUp" && hits.length > 0) {
              event.preventDefault();
              setActive((current) => (current <= 0 ? hits.length : current) - 1);
            }
          }}
          className={cn(
            "border-border bg-surface placeholder:text-text-3 focus:border-brand w-full rounded-full border transition-[border-color,box-shadow] focus:ring-4 focus:ring-[var(--brand-tint)] focus:outline-none",
            hero ? "h-14 pr-5 pl-13 text-lg shadow-[var(--shadow-md)]" : "text-md h-10 pr-4 pl-10",
          )}
        />

        {busy ? (
          <Loader2
            size={16}
            aria-hidden
            className={cn(
              "text-text-3 absolute top-1/2 -translate-y-1/2 animate-spin",
              hero ? "right-5" : "right-3.5",
            )}
          />
        ) : null}
      </form>

      {open && query.trim().length >= 2 ? (
        <div
          id="portal-search-results"
          className="animate-rise border-border bg-surface rounded-panel absolute top-full right-0 left-0 z-40 mt-2 overflow-hidden border shadow-[var(--shadow-float)]"
        >
          {hits.length === 0 ? (
            <p className="text-text-3 px-5 py-6 text-center text-base">
              {busy ? t.portal.searching : t.portal.noResults(query.trim())}
            </p>
          ) : (
            <ul role="listbox" className="max-h-[60vh] overflow-y-auto p-1.5">
              {hits.map((hit, index) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(hit)}
                    className={cn(
                      "rounded-control flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                      index === active ? "bg-[var(--brand-tint)]" : "hover:bg-surface-2",
                    )}
                  >
                    <span
                      aria-hidden
                      className="rounded-control flex size-8 shrink-0 items-center justify-center"
                      style={
                        hit.kind === "form"
                          ? {
                              background: `color-mix(in oklab, ${hit.color} 15%, transparent)`,
                              color: hit.color,
                            }
                          : undefined
                      }
                    >
                      {hit.kind === "form" ? (
                        <PortalIcon name={hit.icon} size={16} />
                      ) : (
                        <BookOpen size={15} className="text-text-3" />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium">{hit.title}</span>
                      <span className="text-text-3 block truncate text-sm">
                        {hit.kind === "article" ? t.portal.answer : t.portal.request}
                        {hit.category ? ` · ${hit.category}` : ""}
                        {hit.summary ? ` · ${hit.summary}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link
            href={`/portal/search?q=${encodeURIComponent(query.trim())}`}
            onClick={() => setOpen(false)}
            className="border-border-soft text-text-2 hover:bg-surface-2 hover:text-text block border-t px-5 py-2.5 text-center text-base font-medium transition-colors"
          >
            {t.portal.seeAllResults}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
