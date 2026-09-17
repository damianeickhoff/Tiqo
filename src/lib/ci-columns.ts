import type { CiFieldKind } from "@/generated/prisma/enums";
import type { FieldSpec } from "@/lib/cmdb";

/**
 * Which columns somebody keeps on the register.
 *
 * The choice is kept per type, because what is worth a column differs by kind of
 * thing: a serial number matters on a laptop and means nothing on a licence. So
 * the preference is a map — one ordered list per type, plus one for the view
 * that spans all of them.
 */

/** The view that has no type, and therefore only the columns every asset has. */
export const ALL_TYPES = "*";

/** Columns every asset has, whatever it is. The name is not among them: it is
 *  the row's subject and cannot be switched off. */
export const COMMON_COLUMNS = ["type", "lifecycle", "team", "tickets"] as const;

export type CommonColumn = (typeof COMMON_COLUMNS)[number];

/** What a fresh account sees: what the register showed before anybody could
 *  change it. */
export const DEFAULT_COLUMNS: string[] = ["type", "lifecycle", "tickets"];

const ATTR = "attr:";

export const attrColumn = (key: string) => `${ATTR}${key}`;
export const attrKeyOf = (column: string) =>
  column.startsWith(ATTR) ? column.slice(ATTR.length) : null;

/**
 * Every column this view could offer, in the order they are drawn.
 *
 * The type's own fields come after the common ones and in the order the type
 * defines them, so a register reads down the same way the item page does.
 */
export function availableColumns(fields: FieldSpec[]): string[] {
  return [...COMMON_COLUMNS, ...fields.map((field) => attrColumn(field.key))];
}

/**
 * The attributes of several types, as one list of columns.
 *
 * What the view that spans every type offers. A column is not a promise that
 * every row has the value — a laptop has no expiry date and its cell is simply
 * empty — and that is a far smaller cost than a register that can record a
 * warranty date and will only show it once you have picked a side.
 *
 * Deduped by key, because two types both recording a serial number are one
 * column and not two. The first type to define it names it; which kind it is
 * read as is still decided per row, by the type the row actually has.
 */
export function unionFields(fields: FieldSpec[]): FieldSpec[] {
  const seen = new Set<string>();
  return fields.filter((field) => !seen.has(field.key) && !!seen.add(field.key));
}

/**
 * How wide a column starts out, before anybody drags it.
 *
 * By what the column holds rather than by what it is called: a yes-or-no is a
 * tick and a person is a name, and guessing from the kind gets an attribute
 * nobody has ever seen close enough that the first read is not spent widening
 * things. The name column is the exception — it is the row's subject and gets
 * the room — and everything left over goes to a filler track at the end, so a
 * register of three columns still reaches the edge of the pane.
 */
export const NAME_WIDTH = 300;

const COMMON_WIDTH: Record<CommonColumn, number> = {
  type: 140,
  lifecycle: 130,
  team: 150,
  tickets: 110,
};

const KIND_WIDTH: Record<CiFieldKind, number> = {
  TEXT: 180,
  NUMBER: 110,
  DATE: 140,
  BOOLEAN: 90,
  CHOICE: 150,
  USER: 160,
  ITEM: 170,
};

export function columnWidth(column: string, field?: FieldSpec): number {
  if (field) return KIND_WIDTH[field.kind];
  return COMMON_WIDTH[column as CommonColumn] ?? KIND_WIDTH.TEXT;
}

/**
 * The grid a register's rows and their headings both stand on.
 *
 * A class rather than a component, because the three things that have to agree
 * on it are a client frame and two server tables — and a `"use client"` module
 * cannot hand a string to a server one, so it cannot live with the frame. The
 * track list itself is `--ci-cols`, set by the frame from the widths this
 * reader has dragged.
 */
export const CI_ROW = "grid grid-cols-[var(--ci-cols)] items-center gap-3 px-5 lg:px-6";

/**
 * The stored preference, read defensively.
 *
 * A type deleted since, or an attribute renamed, leaves a column id nothing can
 * draw. Normalised on the way out rather than the way in, because the set of
 * valid ids depends on a type that may have changed since the choice was made.
 */
export function readColumns(
  stored: string | null,
  key: string,
  available: string[],
  /// What this type says a register of it should show, for somebody who has
  /// never opened the column picker. Empty, or the view that spans every type,
  /// falls back to the shared default — which is what the register did before a
  /// type could say anything about it.
  fromType: string[] = [],
): string[] {
  let map: Record<string, unknown> = {};
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        map = parsed as Record<string, unknown>;
      }
    } catch {
      // A column preference is not worth an error page. An unreadable one is a
      // preference nobody set.
    }
  }

  const chosen = map[key];
  if (!Array.isArray(chosen)) {
    const wanted = fromType.length ? fromType : DEFAULT_COLUMNS;
    return wanted.filter((id) => available.includes(id));
  }

  const seen = new Set<string>();
  return chosen.filter(
    (id): id is string =>
      typeof id === "string" && available.includes(id) && !seen.has(id) && !!seen.add(id),
  );
}

/** The preference with one view's list replaced, ready to store. */
export function writeColumns(stored: string | null, key: string, columns: string[]): string {
  let map: Record<string, unknown> = {};
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        map = parsed as Record<string, unknown>;
      }
    } catch {
      map = {};
    }
  }
  return JSON.stringify({ ...map, [key]: columns });
}
