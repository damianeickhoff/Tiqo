"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BookText, Search, Ticket } from "lucide-react";
import { findByReference, searchEverything, type SearchResults } from "@/lib/actions/search";
import { normaliseReference } from "@/lib/tickets";
import { docHref } from "@/lib/docs";
import { Avatar } from "@/components/avatar";
import { CiGlyph } from "@/components/cmdb/ci-glyph";
import { useMessages } from "@/components/shell/instance-context";
import { VisitGlyph, useVisits } from "@/components/shell/nav-history";
import { recentVisits } from "@/lib/nav-history";
import { cn } from "@/lib/utils";

const EMPTY: SearchResults = { tickets: [], people: [], projects: [], docs: [], assets: [] };

type Row = {
  key: string;
  href: string;
  group: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  /// References and project keys are codes and read as such; a job title is
  /// prose and should not be set in a typewriter face.
  mono?: boolean;
  badge?: { text: string; color?: string };
};

/**
 * The desk's search, as a palette.
 *
 * The bar carries only a trigger; ⌘K (Ctrl+K) or a click opens the palette
 * over the page. It answers while you type — five of each thing you are
 * allowed to see — and Enter still does what it always did: run the full ticket
 * search, so the shortcut in everyone's fingers keeps working.
 */
export function GlobalSearch() {
  const t = useMessages();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const visits = useVisits();
  const recents = useMemo(() => recentVisits(visits), [visits]);

  const rows = useMemo<Row[]>(
    () => [
      ...results.tickets.map((ticket) => ({
        key: `t${ticket.number}`,
        href: `/tickets/${ticket.number}`,
        group: t.nav.tickets,
        icon: <Ticket size={14} className="text-text-3" />,
        label: ticket.title,
        hint: ticket.reference,
        mono: true,
        badge: ticket.status ? { text: ticket.status.name, color: ticket.status.color } : undefined,
      })),
      ...results.people.map((person) => ({
        key: `p${person.id}`,
        href: `/people/${person.id}`,
        group: t.nav.people,
        icon: <Avatar name={person.name} variant={person.avatarVariant} size={20} />,
        label: person.name,
        hint: person.jobTitle ?? undefined,
      })),
      ...results.docs.map((doc) => ({
        key: `d${doc.id}`,
        href: docHref(doc.space.key, doc.slug),
        group: t.docs.title,
        icon: <BookText size={14} className="text-text-3" />,
        label: doc.title,
        hint: doc.space.key,
        mono: true,
        badge: undefined,
      })),
      ...results.assets.map((asset) => ({
        key: `c${asset.id}`,
        href: `/cmdb/${asset.id}`,
        group: t.cmdb.title,
        icon: <CiGlyph icon={asset.type.icon} color={asset.type.color} size={14} />,
        label: asset.name,
        hint: asset.type.name,
        badge: { text: t.cmdb.life[asset.lifecycle] },
      })),
      ...results.projects.map((project) => ({
        key: `j${project.id}`,
        href: `/tickets?project=${project.id}`,
        group: t.nav.projects,
        icon: (
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ background: project.color }}
          />
        ),
        label: project.name,
        hint: project.key,
        mono: true,
      })),
    ],
    [results, t],
  );

  // Fetched from the change handler on a short debounce rather than from an
  // effect: one round trip per pause, not one per keystroke.
  function change(next: string) {
    setQuery(next);
    setActive(-1);

    if (timer.current) clearTimeout(timer.current);

    if (next.trim().length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }

    setLoading(true);
    timer.current = setTimeout(async () => {
      const found = await searchEverything(next);
      // Answers can land out of order; only the newest query's may be shown.
      if (input.current?.value === next) {
        setResults(found);
        setLoading(false);
      }
    }, 180);
  }

  function close() {
    setOpen(false);
    setQuery("");
    setResults(EMPTY);
    setActive(-1);
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  async function submit() {
    const q = query.trim();
    if (active >= 0 && rows[active]) return go(rows[active].href);

    // A pasted reference is an address, not a query: open what it names rather
    // than searching for it. Anything that is not one falls through untouched.
    if (normaliseReference(q)) {
      const number = await findByReference(q);
      if (number !== null) return go(`/tickets/${number}`);
    }

    go(q ? `/tickets?q=${encodeURIComponent(q)}` : "/tickets");
  }

  // ⌘K anywhere on the desk. Registered once; the handler reads nothing that
  // changes, so it never needs re-binding.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focus follows the palette: the field takes it as soon as the panel is in
  // the document, so a keystroke after ⌘K is already a query.
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const searching = query.trim().length >= 2;
  // Read on the client only; the server snapshot keeps hydration honest.
  const isMac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.nav.searchEverything}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="border-line bg-surface text-text-3 hover:border-line-strong hover:text-text-2 rounded-control hidden h-9 w-56 items-center gap-2 border px-2.5 text-left text-base shadow-[var(--highlight)] transition-colors sm:flex lg:w-64"
      >
        <Search size={14} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{t.nav.searchEverything}</span>
        <kbd className="kbd shrink-0">{isMac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      {/* Below sm the bar has no room for a field; the icon opens the same palette. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.nav.searchEverything}
        className="text-text-2 hover:bg-surface-3 hover:text-text rounded-control flex size-9 items-center justify-center transition-colors sm:hidden"
      >
        <Search size={16} />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]"
              role="dialog"
              aria-modal="true"
              aria-label={t.nav.searchEverything}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  close();
                }
              }}
            >
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onClick={close}
                className="animate-fade fixed inset-0 cursor-default bg-[rgba(9,9,11,0.45)] backdrop-blur-[2px]"
              />

              <div className="animate-rise border-line bg-surface rounded-panel relative w-full max-w-xl overflow-hidden border shadow-[var(--shadow-lg)]">
                <form
                  role="search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                  }}
                  className="border-line flex items-center gap-2.5 border-b px-4"
                >
                  <Search size={16} className="text-text-3 shrink-0" />
                  <input
                    ref={input}
                    name="q"
                    value={query}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={searching}
                    aria-controls="global-search-results"
                    aria-activedescendant={active >= 0 ? `global-search-${active}` : undefined}
                    placeholder={t.nav.searchEverything}
                    aria-label={t.nav.searchEverything}
                    onChange={(event) => change(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown" && rows.length > 0) {
                        event.preventDefault();
                        setActive((current) => (current + 1) % rows.length);
                      }
                      if (event.key === "ArrowUp" && rows.length > 0) {
                        event.preventDefault();
                        setActive((current) => (current <= 0 ? rows.length : current) - 1);
                      }
                    }}
                    className="placeholder:text-text-3 text-md h-12 min-w-0 flex-1 bg-transparent outline-none"
                  />
                  <span className="hidden items-center gap-1 sm:flex">
                    <kbd className="kbd">↑↓</kbd>
                    <kbd className="kbd">↵</kbd>
                    <kbd className="kbd">esc</kbd>
                  </span>
                </form>

                {!searching ? (
                  <>
                    {/* The way back, from anywhere. The bar offers one step; with
                        the box empty the palette offers the whole trail. */}
                    {recents.length > 0 ? (
                      <ul className="max-h-[50vh] overflow-y-auto p-1.5">
                        <li>
                          <p className="label px-2.5 pt-2.5 pb-1.5">{t.nav.recentlyViewed}</p>
                        </li>
                        {recents.map((visit) => (
                          <li key={visit.href}>
                            <button
                              type="button"
                              onClick={() => go(visit.href)}
                              className="rounded-control hover:bg-surface-2 flex h-9 w-full items-center gap-2.5 px-2.5 text-left transition-colors"
                            >
                              <span className="flex size-5 shrink-0 items-center justify-center">
                                <VisitGlyph kind={visit.kind} />
                              </span>
                              <span className="min-w-0 flex-1 truncate text-base font-medium">
                                {visit.title}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p
                      className={cn(
                        "text-text-3 px-4 text-center text-base",
                        recents.length > 0 ? "border-line border-t py-3" : "py-5",
                      )}
                    >
                      {t.nav.paletteHint}
                    </p>
                  </>
                ) : rows.length === 0 ? (
                  <p className="text-text-3 px-4 py-6 text-center text-base">
                    {loading ? t.nav.searching : t.nav.nothingFound(query.trim())}
                  </p>
                ) : (
                  <ul
                    id="global-search-results"
                    role="listbox"
                    className="max-h-[50vh] overflow-y-auto p-1.5"
                  >
                    {rows.map((row, index) => (
                      <li key={row.key}>
                        {/* The group name is repeated only when it changes, so the
                            list reads as sections without being built as sections. */}
                        {index === 0 || rows[index - 1]!.group !== row.group ? (
                          <p className="label px-2.5 pt-2.5 pb-1.5">{row.group}</p>
                        ) : null}

                        <button
                          type="button"
                          id={`global-search-${index}`}
                          role="option"
                          aria-selected={index === active}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => go(row.href)}
                          className={cn(
                            "rounded-control flex h-9 w-full items-center gap-2.5 px-2.5 text-left transition-colors",
                            index === active ? "bg-surface-3" : "hover:bg-surface-2",
                          )}
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center">
                            {row.icon}
                          </span>

                          {row.hint ? (
                            <span
                              className={cn(
                                "text-text-3 shrink-0 text-sm",
                                row.mono && "font-mono",
                              )}
                            >
                              {row.hint}
                            </span>
                          ) : null}

                          <span className="min-w-0 flex-1 truncate text-base font-medium">
                            {row.label}
                          </span>

                          {row.badge ? (
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{
                                background: `color-mix(in oklab, ${row.badge.color} 16%, transparent)`,
                                color: `color-mix(in oklab, ${row.badge.color} 70%, var(--text))`,
                              }}
                            >
                              {row.badge.text}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {searching ? (
                  <button
                    type="button"
                    onClick={() => go(`/tickets?q=${encodeURIComponent(query.trim())}`)}
                    className="border-line text-text-2 hover:bg-surface-2 hover:text-text flex w-full items-center gap-2 border-t px-4 py-2.5 text-left text-base font-medium transition-colors"
                  >
                    <Search size={13} />
                    {t.nav.seeAllFor(query.trim())}
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
