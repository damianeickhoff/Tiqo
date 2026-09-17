"use client";

import { useEffect, useState } from "react";
import { PanelCard } from "@/components/tickets/panel-card";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type Heading = { id: string; text: string; level: number };

/**
 * The page's own shape, on the rail.
 *
 * A runbook is read under pressure and the step somebody needs is rarely the
 * first one, so the headings are an index rather than a row of words above the
 * article: nested the way the page is, sticky while the words scroll past, and
 * marking the section being read. It was a strip over the body, which said the
 * same thing but read as a paragraph of links and lost its place the moment
 * anybody scrolled.
 *
 * Hidden under two headings. One heading is not a table of contents, it is the
 * page, and an index with a single entry is furniture.
 */
export function DocOutline({ headings }: { headings: Heading[] }) {
  const t = useMessages();
  const [active, setActive] = useState<string | null>(null);

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

  if (headings.length < 2) return null;

  return (
    // Sticky rather than scrolling with the rail: the point of an index is
    // that it is there at the bottom of the page as well as the top.
    <PanelCard title={t.docs.onThisPage} className="sticky top-3">
      <nav aria-label={t.docs.onThisPage} className="rail-scroll max-h-[60vh] overflow-y-auto p-1">
        <ul>
          {headings.map((heading) => (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                aria-current={active === heading.id ? "location" : undefined}
                onClick={() => setActive(heading.id)}
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
    </PanelCard>
  );
}
