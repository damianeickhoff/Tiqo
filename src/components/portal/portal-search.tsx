"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Loader2, Search } from "lucide-react";
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
 *
 * Two sizes: the hero's, a white pill on the brand field with the go button in
 * it, and the compact one every other page and the header's dialog use.
 */
export function PortalSearch({
  size = "hero",
  placeholder,
  autoFocus = false,
  initialQuery = "",
  onNavigate,
}: {
  size?: "hero" | "compact";
  placeholder?: string;
  autoFocus?: boolean;
  initialQuery?: string;
  /// Called when a result is chosen or the query submitted, so a dialog that
  /// holds the box can close itself.
  onNavigate?: () => void;
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
    onNavigate?.();
    router.push(hit.kind === "form" ? `/portal/f/${hit.slug}` : `/portal/kb/${hit.slug}`);
  }

  function submit() {
    if (active >= 0 && hits[active]) return go(hits[active]);
    if (query.trim()) {
      setOpen(false);
      onNavigate?.();
      router.push(`/portal/search?q=${encodeURIComponent(query.trim())}`);
    }
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
          submit();
        }}
      >
        <Search
          size={hero ? 19 : 15}
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2",
            hero ? "left-[22px] text-[#8e8e99]" : "text-text-3 left-3.5",
          )}
        />

        {/* The hero's box is white whatever the theme — it sits on the brand
            field, not on the page — so its inks are fixed rather than tokens. */}
        <input
          ref={input}
          value={query}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && query.trim().length >= 2}
          aria-controls="portal-search-results"
          placeholder={placeholder ?? t.portal.searchPlaceholder}
          aria-label={placeholder ?? t.portal.searchPlaceholder}
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
            "w-full rounded-full border border-transparent transition-[box-shadow] focus:outline-none",
            hero
              ? "h-[58px] bg-white pr-[64px] pl-[54px] text-[15.5px] text-[#0b0b0d] shadow-[0_8px_24px_-8px_rgba(9,9,11,0.35)] placeholder:text-[#8e8e99] focus:ring-4 focus:ring-[rgba(255,255,255,0.45)]"
              : "bg-surface text-text placeholder:text-text-3 focus:border-brand h-[42px] pr-10 pl-10 text-base shadow-[var(--highlight)] focus:ring-[3px] focus:ring-[var(--brand-tint)]",
          )}
        />

        {hero ? (
          <button
            type="submit"
            aria-label={t.portal.searchButton}
            className="absolute top-1/2 right-2 flex size-[42px] -translate-y-1/2 items-center justify-center rounded-full bg-[#1c1300] text-white transition-colors hover:bg-[#3a2a00]"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
          </button>
        ) : busy ? (
          <Loader2
            size={15}
            aria-hidden
            className="text-text-3 absolute top-1/2 right-3.5 -translate-y-1/2 animate-spin"
          />
        ) : null}
      </form>

      {open && query.trim().length >= 2 ? (
        <div
          id="portal-search-results"
          className="animate-rise bg-surface text-text absolute top-full right-0 left-0 z-40 mt-2 overflow-hidden rounded-[18px] text-left shadow-[var(--shadow-md)]"
        >
          {hits.length === 0 ? (
            <p className="text-text-3 px-5 py-6 text-center text-base">
              {busy ? t.portal.searching : t.portal.noResults(query.trim())}
            </p>
          ) : (
            <ul role="listbox" className="max-h-[60vh] overflow-y-auto">
              {hits.map((hit, index) => (
                <li key={`${hit.kind}-${hit.id}`} className="border-line border-t first:border-t-0">
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(hit)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-[11px] text-left transition-colors",
                      index === active ? "bg-surface-2" : "hover:bg-surface-2",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-[34px] shrink-0 items-center justify-center rounded-full",
                        hit.kind === "form" ? "text-white" : "bg-surface-2 text-text-2",
                      )}
                      style={hit.kind === "form" ? { background: hit.color } : undefined}
                    >
                      {hit.kind === "form" ? (
                        <PortalIcon name={hit.icon} size={16} />
                      ) : (
                        <BookOpen size={15} />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold">{hit.title}</span>
                      <span className="text-text-3 block truncate text-[12.5px]">
                        {hit.kind === "article" ? t.portal.answer : t.portal.request}
                        {hit.category ? ` · ${hit.category}` : ""}
                        {hit.summary ? ` · ${hit.summary}` : ""}
                      </span>
                    </span>
                    {index === active ? <kbd className="kbd">↵</kbd> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link
            href={`/portal/search?q=${encodeURIComponent(query.trim())}`}
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className="border-line text-text-2 hover:bg-surface-2 hover:text-text flex items-center gap-1.5 border-t px-4 py-[11px] text-sm font-semibold transition-colors"
          >
            {t.portal.seeAllResults}
            <ArrowRight size={13} />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
