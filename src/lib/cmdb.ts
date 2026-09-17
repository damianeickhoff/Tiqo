import type { CiFieldKind, CiLifecycle, CiRelationKind } from "@/generated/prisma/enums";

/**
 * The register's shared vocabulary: what a type can record, what an asset's life
 * looks like, and what two assets can say about each other.
 *
 * Pure on purpose — no Prisma, no settings — because the same lists order a
 * dropdown on the client and validate a write on the server, and two copies of
 * "these are the field kinds" is how they come to disagree.
 */

export const CI_FIELD_KINDS = [
  "TEXT",
  "NUMBER",
  "DATE",
  "BOOLEAN",
  "CHOICE",
  "USER",
  "ITEM",
] as const satisfies readonly CiFieldKind[];

/** Life runs in this order, and the register lists it in this order. */
export const CI_LIFECYCLES = [
  "PLANNED",
  "IN_SERVICE",
  "MAINTENANCE",
  "RETIRED",
] as const satisfies readonly CiLifecycle[];

export const CI_RELATION_KINDS = [
  "DEPENDS_ON",
  "CONNECTS_TO",
  "RUNS_ON",
  "PART_OF",
] as const satisfies readonly CiRelationKind[];

/** Enough of a field to read or write a value against it. */
export type FieldSpec = {
  key: string;
  label: string;
  kind: CiFieldKind;
  required: boolean;
  options: string[];
  /// Whether this date is one that runs out. Only ever true of a DATE, and the
  /// whole of what tells "Warranty until" from "Purchased".
  isExpiry: boolean;
};

/** What is stored under one key. Anything else is a value nobody wrote. */
export type AttributeValue = string | number | boolean | null;

/**
 * One attribute, read back out of the JSON blob.
 *
 * Defensive because the blob is not the schema: a field's kind can change after
 * values have been written under it, and an item saved as a laptop and later
 * re-typed keeps whatever it had. A value of the wrong shape reads as unset
 * rather than crashing the page that shows it.
 */
export function readAttribute(field: FieldSpec, attributes: unknown): AttributeValue {
  if (typeof attributes !== "object" || attributes === null) return null;
  const raw = (attributes as Record<string, unknown>)[field.key];
  if (raw === undefined || raw === null || raw === "") return null;

  switch (field.kind) {
    case "NUMBER":
      return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    case "BOOLEAN":
      return typeof raw === "boolean" ? raw : null;
    default:
      return typeof raw === "string" ? raw : null;
  }
}

/** Every attribute of an item, in the order its type defines them. */
export function readAttributes(fields: FieldSpec[], attributes: unknown) {
  return fields.map((field) => ({ field, value: readAttribute(field, attributes) }));
}

/**
 * A draft's answers, checked against the type that owns them.
 *
 * Returns the object to store and whatever was wrong with it, keyed the way the
 * form renders errors. Unknown keys are dropped rather than kept: an attribute
 * no field claims is one nothing will ever show again, and keeping it would let
 * a renamed field quietly leave its old value behind forever.
 */
export type AttributeProblem = "required" | "number" | "choice" | "date" | "missing";

/// A date as the browser's date input writes one, which is the only shape this
/// app ever stores. Anything else is a string nobody can sort, filter or count
/// days until — which is the whole of what a DATE attribute is for.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseAttributes(fields: FieldSpec[], raw: unknown) {
  const input = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const values: Record<string, AttributeValue> = {};
  const errors: Record<string, AttributeProblem> = {};
  /// The ids this draft points at, for whoever can ask the database whether
  /// they are real. Collected here rather than checked here, because this file
  /// is the half of the register that runs on the client too.
  const references: { kind: "USER" | "ITEM"; key: string; id: string }[] = [];

  for (const field of fields) {
    const given = input[field.key];
    const empty = given === undefined || given === null || given === "";

    if (empty) {
      if (field.required) errors[field.key] = "required";
      continue;
    }

    switch (field.kind) {
      case "NUMBER": {
        const parsed = typeof given === "number" ? given : Number(given);
        if (!Number.isFinite(parsed)) {
          errors[field.key] = "number";
          continue;
        }
        values[field.key] = parsed;
        break;
      }
      case "BOOLEAN":
        values[field.key] = given === true || given === "true";
        break;
      case "CHOICE": {
        const choice = String(given);
        // Checked against the type's own list rather than trusted from the
        // form: a choice that is not on it is a value no filter will ever
        // match, which is worse than a refusal.
        if (!field.options.includes(choice)) {
          errors[field.key] = "choice";
          continue;
        }
        values[field.key] = choice;
        break;
      }
      case "DATE": {
        const date = String(given).trim();
        if (!ISO_DATE.test(date) || Number.isNaN(Date.parse(date))) {
          errors[field.key] = "date";
          continue;
        }
        values[field.key] = date;
        break;
      }
      case "USER":
      case "ITEM": {
        const id = String(given).trim();
        references.push({ kind: field.kind, key: field.key, id });
        values[field.key] = id;
        break;
      }
      default:
        values[field.key] = String(given);
    }
  }

  return { values, errors, references };
}

/**
 * A key somebody can type, from a label they already wrote.
 *
 * Offered rather than forced: the key is what an import matches columns on, so
 * it has to be stable when the label is reworded, which means somebody has to be
 * able to keep it.
 */
export function keyFromLabel(label: string) {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
}

/** The dates a type says run out: what "expiring soon" means for this kind of
 *  thing, and what the item page draws its bar against. */
export function expiryFields(fields: FieldSpec[]): FieldSpec[] {
  return fields.filter((field) => field.kind === "DATE" && field.isExpiry);
}

/**
 * How long this asset has left, and since when.
 *
 * The end is the first expiry date somebody filled in. The start is the first
 * ordinary date before it — "Purchased", on a type that records one — because a
 * bar needs two ends and "how much of the cover is used up" is the question the
 * bar is answering. With no start there is still an end, and the bar is drawn
 * from the day the thing was written down rather than not at all.
 */
export type Lifespan = {
  from: { label: string; value: string } | null;
  to: { label: string; value: string };
};

export function lifespanOf(fields: FieldSpec[], attributes: unknown): Lifespan | null {
  const dated = (field: FieldSpec) => {
    const value = readAttribute(field, attributes);
    return typeof value === "string" && ISO_DATE.test(value) ? value : null;
  };

  const end = expiryFields(fields).map((field) => [field, dated(field)] as const);
  const to = end.find(([, value]) => value !== null);
  if (!to) return null;

  const start = fields
    .filter((field) => field.kind === "DATE" && !field.isExpiry)
    .map((field) => [field, dated(field)] as const)
    .find(([, value]) => value !== null && value < to[1]!);

  return {
    from: start ? { label: start[0].label, value: start[1]! } : null,
    to: { label: to[0].label, value: to[1]! },
  };
}

/** Whole days from today to a stored date, negative once it is past. Counted in
 *  days rather than milliseconds so "today" is today all day. */
export function daysUntil(iso: string, now = new Date()): number {
  const then = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(then)) return 0;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((then - today) / 86_400_000);
}
