/**
 * Working time.
 *
 * With business hours off, elapsed time is wall-clock time and every function
 * here is a subtraction. With them on, a ticket raised at five on Friday is not
 * late by Monday morning: only minutes inside the desk's opening hours count,
 * and a derived deadline is projected forward through those same windows.
 *
 * The zone maths is done with `Intl`, not a library. Two operations are needed —
 * read the wall clock in a zone for an instant, and find the instant for a wall
 * clock time in a zone — and the second is the offset-probe below.
 */
export type BusinessHours = {
  enabled: boolean;
  /** ISO weekdays the desk is open, 1 = Monday. */
  days: number[];
  /** Minutes from midnight, local to `timeZone`. */
  start: number;
  end: number;
  timeZone: string;
};

export const DEFAULT_HOURS: BusinessHours = {
  enabled: false,
  days: [1, 2, 3, 4, 5],
  start: 9 * 60,
  end: 17 * 60,
  timeZone: "Europe/Amsterdam",
};

const MINUTE = 60_000;

type Wall = { year: number; month: number; day: number; weekday: number; minutes: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour12: false,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

const WEEKDAYS: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/** What the wall clock in `timeZone` reads at this instant. */
function wallClock(at: Date, timeZone: string): Wall {
  const parts = formatterFor(timeZone).formatToParts(at);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";

  // Midnight comes back as 24 in some engines; both mean the same minute.
  const hour = Number(value("hour")) % 24;

  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    weekday: WEEKDAYS[value("weekday")] ?? 1,
    minutes: hour * 60 + Number(value("minute")),
  };
}

/**
 * The instant at which the wall clock in `timeZone` reads this local time.
 *
 * Formatting the guess back gives the zone's offset at roughly the right
 * moment; applying it lands within an hour of the answer, and one correction
 * pass settles the case where a DST change falls between the two.
 */
function instantAt(wall: Omit<Wall, "weekday">, timeZone: string): Date {
  const guess = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    Math.floor(wall.minutes / 60),
    wall.minutes % 60,
  );

  const offsetAt = (ts: number) => {
    const local = wallClock(new Date(ts), timeZone);
    const asUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      Math.floor(local.minutes / 60),
      local.minutes % 60,
    );
    return asUtc - ts;
  };

  let ts = guess - offsetAt(guess);
  ts = guess - offsetAt(ts);
  return new Date(ts);
}

/** The open window on the calendar day `at` falls in, or null if it is closed. */
function windowOn(at: Date, hours: BusinessHours) {
  const wall = wallClock(at, hours.timeZone);
  if (!hours.days.includes(wall.weekday)) return null;

  const day = { year: wall.year, month: wall.month, day: wall.day };
  return {
    open: instantAt({ ...day, minutes: hours.start }, hours.timeZone),
    close: instantAt({ ...day, minutes: hours.end }, hours.timeZone),
  };
}

/**
 * Midnight at the start of the following local day.
 *
 * The step is taken from noon rather than from the cursor itself: adding 24
 * hours to a time near midnight can land back on the same date when the clocks
 * change, and noon is far enough from either edge that it never does.
 */
function nextDay(at: Date, hours: BusinessHours) {
  const wall = wallClock(at, hours.timeZone);
  const noon = instantAt({ ...wall, minutes: 12 * 60 }, hours.timeZone);
  const tomorrow = wallClock(new Date(noon.getTime() + 24 * 60 * MINUTE), hours.timeZone);

  return instantAt(
    { year: tomorrow.year, month: tomorrow.month, day: tomorrow.day, minutes: 0 },
    hours.timeZone,
  );
}

/** A week of closed days is a misconfiguration, not a reason to hang. */
const MAX_DAYS = 400;

export function workingMinutesBetween(from: Date, to: Date, hours: BusinessHours) {
  if (to <= from) return 0;
  if (!hours.enabled || hours.days.length === 0 || hours.end <= hours.start) {
    return (to.getTime() - from.getTime()) / MINUTE;
  }

  let total = 0;
  let cursor = from;

  for (let guard = 0; guard < MAX_DAYS && cursor < to; guard += 1) {
    const window = windowOn(cursor, hours);
    if (window) {
      const start = Math.max(window.open.getTime(), cursor.getTime());
      const end = Math.min(window.close.getTime(), to.getTime());
      if (end > start) total += (end - start) / MINUTE;
    }
    cursor = nextDay(cursor, hours);
  }

  return total;
}

/** The instant `minutes` of working time after `from`. */
export function addWorkingMinutes(from: Date, minutes: number, hours: BusinessHours) {
  if (!hours.enabled || hours.days.length === 0 || hours.end <= hours.start) {
    return new Date(from.getTime() + minutes * MINUTE);
  }

  let remaining = minutes;
  let cursor = from;

  for (let guard = 0; guard < MAX_DAYS; guard += 1) {
    const window = windowOn(cursor, hours);
    if (window) {
      const start = Math.max(window.open.getTime(), cursor.getTime());
      const available = (window.close.getTime() - start) / MINUTE;

      if (available > 0) {
        if (remaining <= available) return new Date(start + remaining * MINUTE);
        remaining -= available;
      }
    }
    cursor = nextDay(cursor, hours);
  }

  // Only reachable if the desk is open for so little that the target cannot be
  // met inside a year; the raw deadline is a better answer than none.
  return new Date(from.getTime() + minutes * MINUTE);
}

/**
 * The desk's hours as people read them: whether it is open at this instant,
 * and the days and times it keeps. `open` is null when hours are switched off,
 * so a caller can say nothing rather than something untrue.
 */
/**
 * Short weekday names, indexed 1–7 so an ISO weekday reads straight out.
 *
 * Built from the locale rather than a table of English abbreviations: a Dutch
 * desk should see "wo", not "Wed". Index 0 is unused and empty.
 */
export function DAY_NAMES(locale: string) {
  const format = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  // 2024-01-01 was a Monday, so day n is n-1 days after it.
  return [
    "",
    ...Array.from({ length: 7 }, (_, i) => format.format(new Date(Date.UTC(2024, 0, 1 + i)))),
  ];
}

/** "08:30" — minutes from midnight written as a wall-clock time. */
export function clockTime(minutes: number) {
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  return `${hour}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Minutes until today's window closes, or null when it is not open right now.
 *
 * For the places that want to say "nearly done for the day" rather than only
 * "open" or "closed" — the answer changes what is worth writing to somebody.
 */
export function minutesLeftToday(hours: BusinessHours, at: Date = new Date()) {
  if (!hours.enabled) return null;
  const window = windowOn(at, hours);
  if (!window || at < window.open || at >= window.close) return null;
  return Math.round((window.close.getTime() - at.getTime()) / MINUTE);
}

export function describeHours(hours: BusinessHours, at: Date = new Date()) {
  if (!hours.enabled) return { open: null as boolean | null, days: "", range: "" };

  const names = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const days = [...hours.days].sort((a, b) => a - b);
  const contiguous = days.every((day, i) => i === 0 || day === days[i - 1]! + 1);
  const label =
    days.length === 0
      ? ""
      : contiguous && days.length > 1
        ? `${names[days[0]!]}–${names[days[days.length - 1]!]}`
        : days.map((day) => names[day]).join(", ");
  return {
    open: workingMinutesBetween(at, new Date(at.getTime() + MINUTE), hours) > 0,
    days: label,
    range: `${clockTime(hours.start)}–${clockTime(hours.end)}`,
  };
}
