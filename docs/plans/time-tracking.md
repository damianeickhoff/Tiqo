# Time tracking

Record how long work took. Tiqo measures elapsed time well — `pausedMinutes`,
`pausedSince`, business hours, `PriorityTarget` — but that is how long a ticket
*sat*, which is a different number from how long somebody *worked*. There is no
answer today to "where did the week go".

Read [conventions.md](conventions.md) first.

## Decisions already made

**Entries are written by hand, in minutes, against a date.** Not a running
timer as the primary mechanism. People forget to start timers and forget to stop
them, and a desk that half-uses a timer produces worse data than one that spends
ten seconds a day typing `45`. A timer is a convenience added in phase 4, and it
writes an ordinary entry when it stops.

**An entry belongs to a ticket, optionally to a step.** Changes are worked in
steps; the step is where the time actually went. Same optional-`stepId` shape
the `Comment` model already uses.

**Everyone logs their own; a permission is needed to log for someone else and
to see the whole desk's numbers.** `time.log.others` and `time.report`. Seeing
your own total needs no permission — it is your week.

**Entries are editable and deletable by their author, always.** A typo'd 480
minutes must be fixable without an admin. Every edit writes a trail entry, which
is what makes that safe.

**No billing, no rates, no invoicing.** Minutes and a note. Rates turn this into
an accounting feature with an audit requirement, and nothing in the ask needs
it.

**Entries are draft-then-Save like every other form.** The list of entries is a
list, so deleting one is immediate.

## Schema

```prisma
/// Work somebody did, as opposed to time a ticket spent waiting — which the
/// ticket already measures for itself and which answers a different question.
model TimeEntry {
  id       String @id @default(cuid())
  ticketId String
  ticket   Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  /// The step it went into, for a change worked in steps. Null for everything
  /// else, exactly as a comment's step is.
  stepId   String?
  step     ChangeStep? @relation(fields: [stepId], references: [id], onDelete: SetNull)

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// Minutes. An integer, because the unit people say out loud is minutes and
  /// storing hours as a float invites 0.30000000000000004 into a timesheet.
  minutes Int
  /// The day the work happened, which is not always the day it was written
  /// down — Friday's work logged on Monday belongs to Friday.
  workedOn DateTime
  note     String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ticketId, workedOn])
  @@index([userId, workedOn])
}
```

Permissions: `time.log.others`, `time.report`, group `tickets`.
`ActivityType.TIME_LOGGED`, `TIME_CHANGED`, `TIME_REMOVED`, with `newValue`
carrying the minutes. Migration name: `time_entries`.

## Phases

### 1 — Log

`src/lib/actions/time.ts`: `logTime`, `updateTimeEntry`, `deleteTimeEntry`.
Validate minutes between 1 and 1440 — a single entry longer than a day is a slip
every time, and rejecting it costs nothing.

Parse the input generously: `90`, `1.5h`, `1h30`, `1:30` all mean ninety
minutes. One small function in `src/lib/tickets.ts` or a new `src/lib/time.ts`,
tested by eye against each form. People type what they say.

Verify: each of those four forms stores 90.

### 2 — On the ticket

A Time card in the ticket rail: total at the top, entries below with person,
date, minutes and note. A Log time control for anyone who can comment; the
person field appears only with `time.log.others` and defaults to the viewer.

On a change, the step page shows its own entries and the ticket's total includes
them.

Verify: two people log against one ticket; both see the same total and can edit
only their own.

### 3 — Mine

`/time` — the viewer's own entries for a week, grouped by day, with a total per
day and per week, and arrows to move between weeks. This is the screen that
makes people log at all, because it is the one that shows them their week back.

Verify: an entry logged against last Friday appears in last week, not this one.

### 4 — A timer

A start/stop control on the ticket page. Running state is per person and per
ticket, held client-side plus one row so it survives a reload — `startedAt` on a
`TimeEntry` with null `minutes`, or a tiny separate table; either is fine as
long as only one timer can run per person. Stopping rounds up to the minute and
writes an ordinary entry, opening the normal form pre-filled so the note can be
added. It must be possible to stop a timer and correct the number before it is
saved.

Verify: start, reload the page, and find the timer still running.

### 5 — Report

Behind `time.report`: totals by person, team, project and ticket type over a
date range, reusing the chart components in `src/components/charts`. One page,
one date range, four tables. Resist making it a report builder.

Verify: the numbers add up to the sum of the entries in the range, checked
against a direct query.

## Out of scope

Rates, billing, invoicing, approval of timesheets, capacity planning, and any
import from a calendar. Estimates on a ticket (planned versus actual) are worth
having and belong in their own plan — they are a property of the work, not a
record of it.
