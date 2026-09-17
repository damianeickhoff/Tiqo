/**
 * The views somebody keeps on the register.
 *
 * A view is a name and a query string — nothing more. Storing the filters as
 * fields would mean teaching this file about every filter the register grows,
 * and a view saved last month would stop working the day one of them changed
 * shape; a URL keeps working or fails visibly, which is the honest half.
 *
 * Three come with the app and are not stored at all: they are questions every
 * desk asks, and one somebody has to save first is one nobody has.
 */

/** A view somebody kept: what they called it, and what it was showing. */
export type CiView = { name: string; query: string };

/** The three the register ships with, in the order the sidebar lists them. */
export const BUILT_IN_VIEWS = ["expiring", "open", "retired"] as const;

export type BuiltInView = (typeof BUILT_IN_VIEWS)[number];

export const isBuiltInView = (value: string | undefined): value is BuiltInView =>
  !!value && (BUILT_IN_VIEWS as readonly string[]).includes(value);

/** How far ahead "expiring" looks. A month is the notice period a desk can
 *  actually act in — a year of warnings is a list nobody reads. */
export const EXPIRY_DAYS = 30;

/// A ceiling on the list, so a preference that is one row of one account cannot
/// grow without bound. Twenty saved views is already more than a sidebar shows.
const LIMIT = 20;

const MAX_NAME = 40;

/**
 * The stored preference, read defensively.
 *
 * The column is JSON somebody could have written anything into, and a register
 * that will not load because a view is malformed is worse than a view that
 * quietly is not there.
 */
export function readViews(stored: unknown): CiView[] {
  if (!Array.isArray(stored)) return [];

  const views: CiView[] = [];
  for (const row of stored) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const { name, query } = row as Record<string, unknown>;
    if (typeof name !== "string" || typeof query !== "string") continue;
    const trimmed = name.trim().slice(0, MAX_NAME);
    if (!trimmed || views.some((view) => view.name === trimmed)) continue;
    views.push({ name: trimmed, query });
  }
  return views.slice(0, LIMIT);
}

/** The list with one view saved. Saving a name that is already there replaces
 *  it, because "Save current view" under a name you already use is how somebody
 *  corrects one. */
export function withView(views: CiView[], name: string, query: string): CiView[] {
  const trimmed = name.trim().slice(0, MAX_NAME);
  const kept = views.filter((view) => view.name !== trimmed);
  return [...kept, { name: trimmed, query }].slice(-LIMIT);
}

export function withoutView(views: CiView[], name: string): CiView[] {
  return views.filter((view) => view.name !== name.trim());
}

/** A day, as the register stores one: `readAttribute` only ever hands back the
 *  shape the date input writes, and a horizon compared against it has to match. */
export function isoDay(when: Date): string {
  return when.toISOString().slice(0, 10);
}
