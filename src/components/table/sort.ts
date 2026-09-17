/**
 * Which way a table is ordered, and where a click on a heading leaves it.
 *
 * Its own module with no directive, because both halves need it: a server
 * component works out the address a heading should link to, and a client one
 * works out the same thing in the browser. Every export of a `"use client"`
 * module is a client reference, so a rule living there could only ever be
 * applied on one side — and a toggle that means something different on the
 * server than in the browser is a heading that jumps when you press it.
 */

export type SortDir = "asc" | "desc";

/** Ascending on arrival, then back and forth — the second click on a heading is
 *  always the other way. */
export function nextSort<F extends string>(
  field: F,
  sort: string | undefined,
  dir: SortDir | undefined,
): { sort: F; dir: SortDir } {
  return { sort: field, dir: sort === field && dir === "asc" ? "desc" : "asc" };
}
