/**
 * Where this tab has been.
 *
 * Every page reached from inside another one — a ticket named on a document, an
 * asset named on a ticket — used to be a dead end: the way out was the rail, and
 * the rail does not know which document you came from. So the shell keeps a
 * trail of its own and offers the top of it as a Back control.
 *
 * It lives in `sessionStorage` rather than a cookie or the database because the
 * trail belongs to the tab: two tabs on two different tickets should each go
 * back to their own page, and neither should still be offering that route
 * tomorrow morning.
 */
export type VisitKind = "ticket" | "document" | "asset" | "project" | "person" | "page";

export type Visit = { href: string; title: string; kind: VisitKind };

const KEY = "tiqo:nav-history";

/// Long enough that the trail is never the reason a route is gone, short
/// enough that the whole thing is one small string in session storage.
const LIMIT = 50;

/// `useSyncExternalStore` compares snapshots by identity, so the server one has
/// to be the same array every time or React re-renders forever.
const NONE: Visit[] = [];

let stack: Visit[] | null = null;
const listeners = new Set<() => void>();

function isVisit(value: unknown): value is Visit {
  const visit = value as Visit | null;
  return (
    !!visit && typeof visit.href === "string" && typeof visit.title === "string" && !!visit.kind
  );
}

function load(): Visit[] {
  if (stack) return stack;

  let restored: Visit[] = NONE;
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) restored = parsed.filter(isVisit).slice(-LIMIT);
  } catch {
    // Private windows refuse storage and a half-written value refuses to parse.
    // Neither is worth an error: an empty trail only costs the Back control.
  }

  stack = restored;
  return stack;
}

function commit(next: Visit[]) {
  stack = next.length > LIMIT ? next.slice(-LIMIT) : next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack));
  } catch {
    // See above: the in-memory trail still works for the life of the page.
  }
  for (const listener of listeners) listener();
}

const KINDS: [RegExp, VisitKind][] = [
  [/^\/tickets\/\d+/, "ticket"],
  [/^\/docs\/[^/]+\/[^/]+/, "document"],
  [/^\/cmdb\/(?!labels)[^/]+/, "asset"],
  [/^\/projects\/[^/]+/, "project"],
  [/^\/people\/[^/]+/, "person"],
];

/** What kind of thing a path names, for the glyph beside its title. */
export function kindOf(path: string): VisitKind {
  for (const [pattern, kind] of KINDS) if (pattern.test(path)) return kind;
  return "page";
}

function pathOf(href: string) {
  return href.split("?")[0] ?? href;
}

/**
 * Record arriving at `href`. A query-only change — a filter, a tab — is the
 * same page wearing a different address, so it replaces the top of the trail
 * instead of pushing; otherwise every keystroke in a filter box would be a
 * place you had been.
 */
export function recordVisit(href: string) {
  const current = load();
  const top = current[current.length - 1];

  if (top?.href === href) return;

  const direction = noteNavigation(href);

  // The browser's own Back button is the same journey as ours, so it takes the
  // same step: the trail pops rather than growing a return leg nobody took.
  if (direction === "back" && previousVisit(current)?.href === href) {
    commit(current.slice(0, -1));
    return;
  }

  if (top && pathOf(top.href) === pathOf(href)) {
    commit([...current.slice(0, -1), { ...top, href }]);
    return;
  }

  commit([...current, { href, title: "", kind: kindOf(pathOf(href)) }]);
}

/**
 * The page's name, once it has one. On a client navigation the route renders
 * before its metadata resolves, so the recorder watches the head and calls this
 * when the title lands rather than reading a title that is still the last page's.
 */
export function setVisitTitle(href: string, title: string) {
  const current = load();
  const top = current[current.length - 1];
  if (!top || top.href !== href || !title || top.title === title) return;
  commit([...current.slice(0, -1), { ...top, title }]);
}

/** Where the Back control goes, or null when this tab has been nowhere else. */
export function previousVisit(from: Visit[] = load()): Visit | null {
  return from.length >= 2 ? (from[from.length - 2] ?? null) : null;
}

/**
 * Take the trail back one step: the page you are on and the one you are going
 * to both leave, because arriving puts the latter back on top. Going back twice
 * therefore walks the trail rather than bouncing between two pages.
 */
export function popVisit(): Visit | null {
  const current = load();
  const previous = previousVisit(current);
  if (!previous) return null;
  commit(current.slice(0, -2));
  return previous;
}

/** The last distinct places this tab has been, newest first, for the palette. */
export function recentVisits(from: Visit[], limit = 8): Visit[] {
  const out: Visit[] = [];
  const seen = new Set<string>();

  for (let index = from.length - 2; index >= 0 && out.length < limit; index -= 1) {
    const visit = from[index]!;
    if (!visit.title || seen.has(visit.href)) continue;
    seen.add(visit.href);
    out.push(visit);
  }

  return out;
}

export function subscribeVisits(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVisits() {
  return load();
}

/** The server has been nowhere. */
export function getServerVisits(): Visit[] {
  return NONE;
}

/* ------------------------------------------------------- the browser's own -- */

/**
 * A second, smaller trail: the addresses of this tab's browser entries and
 * where in them we are standing. It exists for one question — is the page the
 * Back control wants the one the browser's own Back button would give us? When
 * it is, we use `router.back()` and leave the browser's history as it was;
 * when it is not, we push, and the browser's Back button keeps meaning what it
 * always meant. Guessing wrong in either direction is what makes an in-app back
 * control fight the browser.
 *
 * Position is inferred from the address rather than from `popstate`, which does
 * not say which way it went.
 */
let trail: string[] = [];
let cursor = -1;

function noteNavigation(href: string): "back" | "forward" | "push" {
  if (cursor > 0 && trail[cursor - 1] === href) {
    cursor -= 1;
    return "back";
  }
  if (trail[cursor + 1] === href) {
    cursor += 1;
    return "forward";
  }

  trail = [...trail.slice(0, cursor + 1), href];
  cursor = trail.length - 1;
  return "push";
}

/** Whether `href` is the entry the browser's Back button would land on. */
export function isBrowserBack(href: string) {
  return cursor > 0 && trail[cursor - 1] === href;
}
