"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, List } from "lucide-react";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type Heading = { id: string; text: string; level: number };

/**
 * The page's own shape, on the toolbar with everything else you can do here.
 *
 * It was a card on the rail, which put the index of a runbook in the same
 * column as who owns it and what it said last March — three unrelated things
 * competing for one corner, and the only one of them anybody uses *while*
 * reading was the one that scrolled away first. Then it hovered loose in the
 * page's corner, which fixed the scrolling and left a control floating an inch
 * below the row of controls it belongs to.
 *
 * So it is a plain button on the title's own line, at the right of the page
 * and under the toolbar's last control — beside the thing it is an index of,
 * rather than up among the controls that act on the page as a whole.
 * Pointing at it, tabbing to it or tapping it drops the list below.
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
  // close by tapping past it — a panel with no way out is worse than no panel.
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
    <div
      ref={box}
      // Nudged up by the two pixels that centre a 32px control on the first
      // line of a 22px title, so it sits *on* the line rather than beside it.
      className="relative -mt-0.5 shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* The toolbar's own skin, so it reads as a control rather than as a
          mark somebody left on the page. What it is *of* — the section under
          the eye — is the first thing the open list says, and the title
          carries it for anybody who hovers without clicking. */}
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        onFocus={() => setOpen(true)}
        aria-expanded={open}
        title={here ? `${t.docs.onThisPage} · ${here.text}` : t.docs.onThisPage}
        className={cn(
          "rounded-control flex h-8 items-center gap-1.5 border px-2.5 text-sm font-medium",
          "whitespace-nowrap transition-colors",
          open
            ? "text-text border-transparent bg-[var(--surface-3)]"
            : "bg-surface text-text-2 hover:text-text border-transparent shadow-[var(--highlight)]",
        )}
      >
        <List size={13} aria-hidden />
        {t.docs.onThisPage}
        <ChevronDown size={12} className="text-text-3" aria-hidden />
      </button>

      {open ? (
        <nav
          aria-label={t.docs.onThisPage}
          // Dropped from the button rather than floated over the page: the
          // list is a menu belonging to a control now, and it opens where
          // every other menu in this row opens.
          className="animate-rise bg-surface rounded-card absolute top-full right-0 z-40 mt-1 w-64 overflow-hidden shadow-[var(--shadow-float)]"
        >
          {/* No heading on the list: the button it hangs from is one, an inch
              above it, and `aria-label` says the same thing to anybody who
              cannot see that. */}
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
      ) : null}
    </div>
  );
}
