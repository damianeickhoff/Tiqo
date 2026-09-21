"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/** A view somebody kept: what they called it, and what it was showing. */
export type SavedView = { name: string; query: string };

/**
 * Where the kept views live, one key per page.
 *
 * The browser, for now: the register keeps its views on the account, and the
 * pages that store them here have no column to put them in yet — a migration is
 * a decision of its own. The shape is the register's, so moving them to the
 * account later is a change of store and not of meaning.
 */
export const QUEUE_VIEWS_STORE = "tiqo.queue.views";
export const PROJECT_VIEWS_STORE = "tiqo.projects.views";

const LIMIT = 20;
export const MAX_VIEW_NAME = 40;

const NONE: SavedView[] = [];

/**
 * What is stored, read defensively.
 *
 * It is text somebody could have written anything into, and a page that will
 * not draw because a kept view is malformed is worse than a view that quietly
 * is not there.
 */
function parse(raw: string): SavedView[] {
  try {
    const rows = JSON.parse(raw) as unknown;
    if (!Array.isArray(rows)) return NONE;
    const views: SavedView[] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const { name, query } = row as Record<string, unknown>;
      if (typeof name !== "string" || typeof query !== "string") continue;
      const trimmed = name.trim().slice(0, MAX_VIEW_NAME);
      if (!trimmed || views.some((view) => view.name === trimmed)) continue;
      views.push({ name: trimmed, query });
    }
    return views.slice(0, LIMIT);
  } catch {
    return NONE;
  }
}

/** The last text read per store and what it parsed to, so a snapshot is the
 *  same list until the text itself changes — a new array every render would be
 *  a render every render. */
const cache = new Map<string, { raw: string; views: SavedView[] }>();
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab of the same page keeps the same views.
  window.addEventListener("storage", announce);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", announce);
  };
}

function read(store: string): SavedView[] {
  let raw = "";
  try {
    raw = window.localStorage.getItem(store) ?? "";
  } catch {
    return NONE;
  }
  const seen = cache.get(store);
  if (seen && seen.raw === raw) return seen.views;
  const views = parse(raw);
  cache.set(store, { raw, views });
  return views;
}

/** The server has no browser storage, so it draws no kept views — and the
 *  first client render agrees with the HTML it replaces. */
const empty = () => NONE;

function write(store: string, views: SavedView[]) {
  try {
    window.localStorage.setItem(store, JSON.stringify(views));
  } catch {
    /* A browser that will not keep them is not a page that cannot be read. */
  }
  cache.delete(store);
  announce();
}

/**
 * The views this browser has kept for one page, and the two things that can be
 * done to them.
 *
 * Saving under a name already in the list replaces it, because "Save current
 * view" under a name you already use is how somebody corrects one.
 */
export function useSavedViews(store: string) {
  const snapshot = useCallback(() => read(store), [store]);
  const views = useSyncExternalStore(subscribe, snapshot, empty);

  const save = useCallback(
    (name: string, query: string) => {
      const wanted = name.trim().slice(0, MAX_VIEW_NAME);
      if (!wanted) return;
      const kept = read(store).filter((view) => view.name !== wanted);
      write(store, [...kept, { name: wanted, query }].slice(-LIMIT));
    },
    [store],
  );

  const forget = useCallback(
    (name: string) => {
      write(
        store,
        read(store).filter((view) => view.name !== name),
      );
    },
    [store],
  );

  return useMemo(() => ({ views, save, forget }), [views, save, forget]);
}
