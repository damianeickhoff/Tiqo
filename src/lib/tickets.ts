import type { Priority, TicketType } from "@/generated/prisma/enums";
import { en, type Messages } from "@/lib/i18n";
import {
  DEFAULT_HOURS,
  addWorkingMinutes,
  workingMinutesBetween,
  type BusinessHours,
} from "@/lib/clock";

export const PRIORITY_ORDER: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

/**
 * A status as everything outside the settings screen needs it: a name and a
 * colour to draw, and the one flag the app reads behaviour from.
 *
 * Null is a real value. Deleting a status leaves the tickets that held it
 * without one rather than moving them somewhere nobody chose.
 */
export type TicketStatus = {
  id: string;
  name: string;
  color: string;
  settles: boolean;
  pausesClock?: boolean;
} | null;

/**
 * `targetHours` is how long a ticket of this priority is allowed to sit before
 * it counts as overdue. It drives the heat spine on every row, which is the one
 * mark that lets an agent compare an urgent ticket from this morning against a
 * low-priority one from three weeks ago.
 */
export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; level: 1 | 2 | 3 | 4 }
> = {
  URGENT: { label: "Urgent", color: "var(--p-urgent)", level: 4 },
  HIGH: { label: "High", color: "var(--p-high)", level: 3 },
  MEDIUM: { label: "Medium", color: "var(--p-medium)", level: 2 },
  LOW: { label: "Low", color: "var(--p-low)", level: 1 },
};

/** How long each priority may sit before it is overdue. Editable in Settings —
 *  these are only the hours a fresh instance starts with. */
export type PriorityTargets = Record<Priority, number>;

export const DEFAULT_TARGETS: PriorityTargets = {
  URGENT: 4,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 168,
};

/**
 * The orders the queue can be read in — one per column that means something to
 * sort by, named after the column rather than after the field behind it.
 *
 * Here rather than beside the query because two files have to agree on them:
 * the page turns one into an `orderBy`, and the header strip turns the same one
 * into a link. A name in only one of the two is a heading that does nothing.
 */
export const QUEUE_SORTS = [
  "reference",
  "subject",
  "status",
  "priority",
  "requester",
  "assignee",
  "replies",
  "created",
  "due",
  "left",
] as const;

export type QueueSort = (typeof QUEUE_SORTS)[number];

/** Urgent first: the order the work should be done in, and so the one a queue
 *  nobody has sorted is in. */
export const DEFAULT_SORT: QueueSort = "priority";
export const DEFAULT_DIR = "desc";

export const TYPE_ORDER: TicketType[] = ["QUESTION", "INCIDENT", "CHANGE"];

export const TYPE_META: Record<TicketType, { label: string; hint: string }> = {
  QUESTION: { label: "Question", hint: "Someone needs an answer" },
  INCIDENT: { label: "Incident", hint: "Something is broken" },
  CHANGE: { label: "Change", hint: "Something needs changing" },
};

/**
 * Only incidents run against the clock. A question or a change is committed to
 * by a due date if anyone wants one — priority still says how much it matters,
 * it just no longer implies a deadline.
 */
export function hasResponseTarget(type: TicketType) {
  return type === "INCIDENT";
}

/** The reference prefix for each kind of work. */
export const TYPE_PREFIX: Record<TicketType, string> = {
  INCIDENT: "INC",
  QUESTION: "QST",
  CHANGE: "CHG",
};

/** `INC-2709 0001` — type, the year and month it was filed, then that bucket's
 *  own sequence. The bucket key is what the counter row is named. */
export function referenceBucket(type: TicketType, at: Date) {
  const period = `${String(at.getFullYear() % 100).padStart(2, "0")}${String(
    at.getMonth() + 1,
  ).padStart(2, "0")}`;
  return { key: `ticket:${TYPE_PREFIX[type]}:${period}`, prefix: TYPE_PREFIX[type], period };
}

/**
 * A reference someone has pasted, put back into the one shape the column holds.
 *
 * People paste what they were sent, which is rarely what was stored: a stray
 * space, a lower-case prefix, a hyphen where the space should be. Anything that
 * is not a reference comes back as nothing, and the search stays a search.
 */
const REFERENCE = new RegExp(
  `^\\s*(${Object.values(TYPE_PREFIX).join("|")})[-\\s]?(\\d{4})[-\\s]?(\\d{4})\\s*$`,
  "i",
);

export function normaliseReference(text: string) {
  const found = REFERENCE.exec(text);
  return found ? `${found[1]!.toUpperCase()}-${found[2]} ${found[3]}` : null;
}

export function formatReference(type: TicketType, at: Date, sequence: number) {
  const { prefix, period } = referenceBucket(type, at);
  return `${prefix}-${period} ${String(sequence).padStart(4, "0")}`;
}

/** A ticket with no status is not settled: the work is still there. */
export function isSettled(status: TicketStatus) {
  return status?.settles ?? false;
}

export type Clocked = {
  priority: Priority;
  type: TicketType;
  status: TicketStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  /// Working minutes already banked in statuses that stop the clock, and when
  /// the current pause began if it is paused now. Optional so the many places
  /// that only need a colour and a name do not all have to select them.
  pausedMinutes?: number;
  pausedSince?: Date | null;
};

/**
 * Everything the clock needs: what each priority promises, and when the desk is
 * open. Passed as one object because no caller ever has a use for only half.
 */
export type Clock = { targets: PriorityTargets; hours: BusinessHours };

export const DEFAULT_CLOCK: Clock = { targets: DEFAULT_TARGETS, hours: DEFAULT_HOURS };

/** Hours the ticket has been alive, frozen once it is settled — and counting
 *  only opening hours when the desk keeps them. */
function elapsedHours(ticket: Clocked, clock: Clock) {
  const settledAt = ticket.closedAt ?? ticket.resolvedAt;
  const until = isSettled(ticket.status) && settledAt ? settledAt : new Date();
  const lived = workingMinutesBetween(ticket.createdAt, until, clock.hours);

  // Time spent waiting on the person who raised it is not time the desk was
  // slow. What has already been banked, plus whatever the current pause has
  // run to so far — which is why a paused ticket's bar stops moving on screen
  // rather than only at the moment it is unparked.
  const paused =
    (ticket.pausedMinutes ?? 0) +
    (ticket.pausedSince ? workingMinutesBetween(ticket.pausedSince, until, clock.hours) : 0);

  return Math.max(0, lived - paused) / 60;
}

/** Whether the response clock is standing still on this ticket right now. */
export function isPaused(ticket: { status: TicketStatus }) {
  return Boolean(ticket.status?.pausesClock);
}

/**
 * The paused-clock bookkeeping for one status change.
 *
 * Banked in working minutes at the moment of the change rather than as two
 * timestamps to subtract later: the desk's opening hours can be edited, and a
 * pause should be measured against the hours that were in force while it ran.
 */
export function pauseFields(
  from: { pausesClock: boolean } | null,
  to: { pausesClock: boolean } | null,
  ticket: { pausedMinutes: number; pausedSince: Date | null },
  hours: BusinessHours,
  now = new Date(),
) {
  const was = from?.pausesClock ?? false;
  const is = to?.pausesClock ?? false;

  if (was === is) return {};

  if (is) return { pausedSince: now };

  return {
    pausedSince: null,
    pausedMinutes:
      ticket.pausedMinutes +
      Math.round(ticket.pausedSince ? workingMinutesBetween(ticket.pausedSince, now, hours) : 0),
  };
}

/** Hours remaining against the response target; negative once it is over.
 *  Null when the ticket's type has no target at all. */
export function hoursToTarget(ticket: Clocked, clock: Clock) {
  if (!hasResponseTarget(ticket.type)) return null;
  return clock.targets[ticket.priority] - elapsedHours(ticket, clock);
}

/** 0 → just arrived, 1 → at or past its response target. 0 when untimed. */
export function heatOf(ticket: Clocked, clock: Clock) {
  if (!hasResponseTarget(ticket.type)) return 0;
  return Math.min(1, Math.max(0, elapsedHours(ticket, clock) / clock.targets[ticket.priority]));
}

/**
 * The one deadline a ticket has, whatever kind it is. An incident's is derived
 * from its priority; everything else uses the due date someone set. Both the
 * header and the settings panel read this, so they cannot disagree — which they
 * did when one showed the derived target and the other showed a null due date.
 */
export function deadlineOf(ticket: Clocked & { dueDate: Date | null }, clock: Clock) {
  if (hasResponseTarget(ticket.type)) {
    return {
      // Projected through the opening hours, so a Friday-evening incident is
      // due on Monday morning rather than over the weekend.
      date: addWorkingMinutes(ticket.createdAt, clock.targets[ticket.priority] * 60, clock.hours),
      derived: true as const,
    };
  }

  return { date: ticket.dueDate, derived: false as const };
}

/**
 * The deadline a ticket raised right now would be given, for the kinds that
 * derive one. The new-ticket form shows this instead of an editable due date:
 * an incident's deadline is a promise the priority already made, and letting
 * someone type a different one there only creates a number the ticket page
 * would then ignore.
 *
 * `new Date()` lives here for the same reason `isPastDue` does.
 */
export function projectedDeadline(priority: Priority, clock: Clock) {
  return addWorkingMinutes(new Date(), clock.targets[priority] * 60, clock.hours);
}

/** Whether a due date has passed. Here rather than in a component body, where
 *  React's purity rule rightly objects to `Date.now()`. */
export function isPastDue(dueDate: Date) {
  return dueDate.getTime() < Date.now();
}

export function isOverdue(ticket: Clocked, clock: Clock) {
  return !isSettled(ticket.status) && hasResponseTarget(ticket.type) && heatOf(ticket, clock) >= 1;
}

/** `Date.now()` lives here rather than in a component body, where React's
 *  purity rule rightly objects to it. */
export function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

const UNITS: [limit: number, ms: number, name: keyof Messages["vocab"]["age"]][] = [
  [60, 1000, "sec"],
  [60, 60_000, "min"],
  [24, 3_600_000, "hr"],
  [7, 86_400_000, "day"],
  [4.35, 604_800_000, "wk"],
  [Infinity, 2_629_800_000, "mo"],
];

/**
 * Compact age used throughout the queue: "4 min", "18 hr", "3 wk".
 *
 * The unit words come from the dictionary, and the plural with them: English
 * adds an s, Dutch does not for most of these, and neither rule belongs here.
 */
export function shortAge(from: Date, to: Date = new Date(), t: Messages = en as Messages) {
  return shortSpan(to.getTime() - from.getTime(), t);
}

/** The same, for a duration that was never two dates — a median, a target. */
export function shortSpan(milliseconds: number, t: Messages = en as Messages) {
  const diff = Math.max(0, milliseconds);
  for (const [limit, ms, name] of UNITS) {
    const value = diff / ms;
    if (value < limit) {
      const rounded = Math.floor(value);
      const [one, many] = t.vocab.age[name];
      return `${rounded} ${rounded === 1 ? one : many}`;
    }
  }
  return t.vocab.aWhile;
}

/**
 * How far a moment is from now, in either direction.
 *
 * `Date.now()` lives here rather than in a component body, where React's purity
 * rule rightly objects to it — and the caller says which side of now it is on,
 * because "in 3 hr" and "3 hr over" are different sentences about one number.
 */
export function spanFromNow(at: Date, t: Messages = en as Messages) {
  return shortSpan(Math.abs(at.getTime() - Date.now()), t);
}

/**
 * How much of the run from `from` to `due` has already gone: 0 at the start, 1
 * on the deadline, past 1 after it.
 *
 * `Date.now()` lives here rather than in a component body, where React's purity
 * rule rightly objects to it.
 */
export function burnedTo(from: Date, due: Date) {
  const span = due.getTime() - from.getTime();
  if (span <= 0) return 1;
  return (Date.now() - from.getTime()) / span;
}
