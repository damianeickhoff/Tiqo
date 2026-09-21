"use client";

import { useEffect, useRef, useState } from "react";
import { List, X } from "lucide-react";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type Heading = { id: string; text: string; level: number };

/**
 * The page's own shape, floating over the page itself.
 *
 * It was a card on the rail, which put the index of a runbook in the same
 * column as who owns it and what it said last March — three unrelated things
 * competing for one corner, and the only one of them anybody uses *while*
 * reading was the one that scrolled away first. So it lives on the page now,
 * hovering in its top corner and following the words down.
 *
 * Closed it is a single mark in a gutter the article gives up for it, so it
 * covers nothing; pointing at it, tabbing to it or tapping it opens the list,
 * which does lie over the words — briefly, and by having been asked to. At the
 * widths this app is read at the page is as wide as the sheet it sits on, so
 * an index permanently parked on top would be covering the sentence somebody
 * is reading, which is the one thing it is there to help with.
 *
 * Not rendered at all while the page is being written — the editor is a draft
 * of the words, and an index of headings that are being rewritten is worse
 * than none. Hidden under two headings, too: one heading is not a table of
 * contents, it is the page.
 */
export function DocOutline({ headings }: { headings: Heading[] }) {
  const t = useMessages();
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodes = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) return;

    // A band across the top of the reading area rather than the whole
    // viewport: the section somebody is reading is the one whose heading has
    // most recently gone past the top, not whichever of the six on screen
    // happens to be largest.
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) seen.add(entry.target.id);
          else seen.delete(entry.target.id);
        }

        const inBand = headings.find((heading) => seen.has(heading.id));
        if (inBand) {
          setActive(inBand.id);
          return;
        }

        // Nothing in the band means we are in the middle of a section rather
        // than at the start of one: the heading above us is still the answer.
        const above = nodes.filter((node) => node.getBoundingClientRect().top < 120).pop();
        setActive(above?.id ?? null);
      },
      { rootMargin: "-72px 0px -70% 0px", threshold: 0 },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [headings]);

  // Opened by a tap rather than a hover on a touch screen, so it also has to
  // close by tapping past it — a panel over the words with no way out is the
  // one thing worse than a panel over the words.
  useEffect(() => {
    if (!open) return;
    function away(event: PointerEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (headings.length < 2) return null;

  const here = headings.find((heading) => heading.id === active);

  return (
    // A full-height strip down the right of the page with nothing in it, so
    // the sticky button inside has the whole article to stick along. The
    // article reserves the width this strip needs, so the closed state never
    // covers a word; only the list does, and only while it is open.
    //
    // Below the narrow breakpoint there is no room to give away and no
    // pointer to hover with, so it is not drawn at all — on a phone the page
    // is one column and its headings are a scroll away rather than a click.
    <div className="pointer-events-none absolute inset-y-0 right-3 z-30 hidden w-0 sm:block">
      <div
        ref={box}
        className="pointer-events-auto sticky top-4 flex justify-end"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="absolute top-0 right-0">
          {open ? (
            <nav
              aria-label={t.docs.onThisPage}
              className="animate-rise bg-surface rounded-card w-64 overflow-hidden shadow-[var(--shadow-float)]"
            >
              <p className="label border-line flex items-center gap-2 border-b px-3 py-2">
                <List size={12} className="text-text-3 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{t.docs.onThisPage}</span>
                {/* On a touch screen the pointer never leaves, so the panel
                    needs a way out that is not "move the mouse away". */}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t.common.close}
                  className="text-text-3 hover:text-text -mr-1 shrink-0 transition-colors"
                >
                  <X size={13} />
                </button>
              </p>

              <ul className="rail-scroll max-h-[60vh] overflow-y-auto p-1">
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <a
                      href={`#${heading.id}`}
                      aria-current={active === heading.id ? "location" : undefined}
                      onClick={() => {
                        setActive(heading.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "block truncate border-l-2 py-1 pr-2 text-sm transition-colors",
                        heading.level > 2 ? "pl-5" : "pl-2.5",
                        active === heading.id
                          ? "border-brand text-text font-medium"
                          : cn(
                              "hover:text-text border-transparent",
                              heading.level > 2 ? "text-text-3" : "text-text-2",
                            ),
                      )}
                    >
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : (
            // Closed it is a mark, not a panel: one glyph in the gutter the
            // article has already given up, so nothing it could cover is
            // underneath it. What it is *of* — the section under the eye — is
            // the first thing the open list says, and the title carries it for
            // anybody who hovers without clicking.
            <button
              type="button"
              onClick={() => setOpen(true)}
              onFocus={() => setOpen(true)}
              aria-expanded={false}
              aria-label={t.docs.onThisPage}
              title={here ? `${t.docs.onThisPage} · ${here.text}` : t.docs.onThisPage}
              className={cn(
                "bg-surface-2 text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-8 items-center",
                "justify-center shadow-[var(--shadow-sm)] transition-colors",
              )}
            >
              <List size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
