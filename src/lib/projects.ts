import type { ProjectHealth } from "@/generated/prisma/enums";

/**
 * What each state of health looks like.
 *
 * The colours are the app's own semantic tokens rather than a new set: "at
 * risk" on a project should be the same amber as "past target" on a ticket, or
 * the two are teaching different things with the same colour.
 */
export const HEALTH_META: Record<ProjectHealth, { color: string; tint: string }> = {
  ON_TRACK: {
    color: "var(--positive)",
    tint: "color-mix(in oklab, var(--positive) 14%, transparent)",
  },
  AT_RISK: { color: "var(--p-high)", tint: "color-mix(in oklab, var(--p-high) 16%, transparent)" },
  OFF_TRACK: {
    color: "var(--negative)",
    tint: "color-mix(in oklab, var(--negative) 14%, transparent)",
  },
  PAUSED: { color: "var(--text-3)", tint: "var(--surface-3)" },
  DELIVERED: { color: "var(--brand-deep)", tint: "var(--brand-tint)" },
};

export const HEALTH_ORDER: ProjectHealth[] = [
  "ON_TRACK",
  "AT_RISK",
  "OFF_TRACK",
  "PAUSED",
  "DELIVERED",
];

/**
 * Whole days between now and a date, negative once it has passed.
 *
 * `Date.now()` lives here rather than in a component body, where React's purity
 * rule rightly objects to it.
 */
export function daysUntil(date: Date) {
  const day = 86_400_000;
  return Math.ceil((date.getTime() - Date.now()) / day);
}

/** Settled out of total, and the percentage that is. Zero tickets is 0%, not
 *  100% — a project nobody has filed anything against is not finished. */
export function progressOf(settled: number, total: number) {
  return { settled, total, pct: total === 0 ? 0 : Math.round((settled / total) * 100) };
}
