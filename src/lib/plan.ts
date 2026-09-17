import type { StepStatus } from "@/generated/prisma/enums";
import { NO_GATE, type ApprovalGate } from "@/lib/approvals";

/**
 * The gates on a change plan.
 *
 * Three rules, and deliberately only three:
 *
 *   · a phase cannot start while an earlier phase is unfinished,
 *   · a step with a predecessor cannot start until that step is finished, and
 *   · a phase somebody has been asked to approve cannot start until they have.
 *
 * The first two cover "not before X" and "not until the whole of that is over"
 * without becoming a workflow engine. There is no graph to walk: a predecessor
 * may only be an earlier step, so a cycle cannot be expressed.
 *
 * The third is the one gate a person clears rather than the plan — see
 * `approvals` — and it is expressed here rather than beside the plan so that
 * "why can I not start this" has one answer and one place to find it.
 */
export const STEP_STATUSES: StepStatus[] = ["OPEN", "IN_PROGRESS", "BLOCKED", "DONE", "SKIPPED"];

/** Finished, one way or the other. A step nobody is going to do is as settled
 *  as a step that was done — both stop holding up what comes after. */
export function isStepSettled(step: { status: StepStatus }) {
  return step.status === "DONE" || step.status === "SKIPPED";
}

export type Gated = {
  id: string;
  phase: string | null;
  phaseOrder: number;
  status: StepStatus;
  dependsOnId: string | null;
  /// Whether an unfinished step holds its phase's gate shut. A step nobody
  /// waits for — "tell the requester", "tidy the branch" — can be left open
  /// without stopping the next phase.
  blocksPhase: boolean;
};

/// `change` and `approval` are the same gate at two heights: one holds the
/// whole plan, the other holds one phase of it. Told apart because the sentence
/// is different — "this phase has not been approved", on a plan where the change
/// itself is what nobody has approved, sends somebody looking for a phase gate
/// that is not there.
export type Block = {
  reason: "change" | "approval" | "phase" | "dependency";
  blocker: string | null;
};

/** What is stopping this step, if anything. Null means it can be worked now. */
export function blockedBy<T extends Gated>(
  step: T,
  all: T[],
  gate: ApprovalGate = NO_GATE,
): Block | null {
  // The decision first: while a phase is waiting on an answer, or standing
  // refused, nothing else about the step is worth saying. It is also the only
  // one of the three a person clears by doing something other than the work.
  if (gate.whole) return { reason: "change", blocker: null };
  if (step.phase !== null && gate.phases.has(step.phase)) {
    return { reason: "approval", blocker: null };
  }

  if (step.dependsOnId) {
    const predecessor = all.find((other) => other.id === step.dependsOnId);
    if (predecessor && !isStepSettled(predecessor)) {
      return { reason: "dependency", blocker: predecessor.id };
    }
  }

  const earlier = all.find(
    (other) => other.phaseOrder < step.phaseOrder && other.blocksPhase && !isStepSettled(other),
  );
  if (earlier) return { reason: "phase", blocker: earlier.id };

  return null;
}

/** Past its date and not finished. A function rather than an expression at the
 *  point of use, so the clock is read where it belongs and not during render. */
export function isStepOverdue(step: { dueAt: Date | null; status: StepStatus }) {
  return Boolean(!isStepSettled(step) && step.dueAt && step.dueAt.getTime() < Date.now());
}

/** Steps in the order they are worked: by phase, then within it. */
export function planOrder<T extends { phaseOrder: number; position: number }>(steps: T[]) {
  return [...steps].sort((a, b) => a.phaseOrder - b.phaseOrder || a.position - b.position);
}

/// A working day. Eight hours rather than twenty-four, because a plan is
/// written in the time somebody is at their desk — "two days" on a change means
/// two days of work, not forty-eight hours of clock.
const MINUTES_IN_DAY = 8 * 60;

/**
 * Minutes from what somebody typed: `90`, `2h`, `1h30`, `45m`, `2d`.
 *
 * A free box rather than a number of minutes, because nobody thinks in minutes
 * past the first hour. `null` is an empty box — no estimate — and `undefined`
 * is one that could not be read, which the editor refuses rather than silently
 * throwing away.
 */
export function parseEstimate(raw: string): number | null | undefined {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  // A bare number is minutes, which is what the field stores.
  if (/^\d+([.,]\d+)?$/.test(text)) return Math.round(Number(text.replace(",", ".")));

  const parts = text.match(/\d+([.,]\d+)?\s*[dhm]/g);
  if (!parts || parts.join("").replace(/\s/g, "") !== text.replace(/\s/g, "")) return undefined;

  const minutes = parts.reduce((total, part) => {
    const value = Number(part.replace(/[^\d.,]/g, "").replace(",", "."));
    const unit = part.trim().slice(-1);
    return total + value * (unit === "d" ? MINUTES_IN_DAY : unit === "h" ? 60 : 1);
  }, 0);

  return Math.round(minutes) || null;
}

/** The same estimate read back: `45 min`, `2 h`, `1.5 d`. One unit, because a
 *  plan's estimates are guesses and `1 d 2 h 30 min` pretends otherwise. */
export function formatEstimate(minutes: number, units: { d: string; h: string; m: string }) {
  const round = (value: number) => String(Math.round(value * 10) / 10);
  if (minutes < 60) return `${minutes} ${units.m}`;
  if (minutes < MINUTES_IN_DAY) return `${round(minutes / 60)} ${units.h}`;
  return `${round(minutes / MINUTES_IN_DAY)} ${units.d}`;
}

/** How far along a plan is. Skipped steps count as settled — a plan is done
 *  when nothing is left to do, not when everything was ticked. */
export function planProgress(steps: { status: StepStatus }[]) {
  const settled = steps.filter(isStepSettled).length;
  return {
    settled,
    total: steps.length,
    pct: steps.length === 0 ? 0 : Math.round((settled / steps.length) * 100),
  };
}
