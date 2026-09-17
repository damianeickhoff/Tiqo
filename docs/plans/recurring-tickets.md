# Recurring tickets

Raise a ticket on a schedule: the monthly backup check, the quarterly firewall
review, the certificate that expires every year. Today standing work is
remembered by a person or not at all.

Read [conventions.md](conventions.md) first.

## Decisions already made

**A schedule is a template, not a copy of a ticket.** It holds the fields a new
ticket needs — title, description, type, priority, project, team, assignee,
labels, change plan — and stamps them out. Cloning a past ticket would drag its
conversation, its trail and its status along with it.

**Cron-shaped rules, chosen from a small menu.** Daily, weekly on chosen days,
monthly on a day number, monthly on the *n*th weekday, yearly. Not a cron string
in a text box: a desk should not need to know what `0 9 * * 1-5` means, and the
five shapes above cover what desks actually schedule. Store the parts, compute
the next occurrence.

**A day-31 monthly rule fires on the last day of shorter months.** The
alternative is skipping February, which is exactly when the check matters.
Decide this once, here, and write it in a comment where the next occurrence is
computed.

**Only one open ticket per schedule at a time, by default.** A weekly check
nobody closes for two months should not produce eight identical tickets. A
`catchUp` flag turns that off for schedules where each occurrence is genuinely
separate work.

**Firing is polled, not scheduled in-process.** Same mechanism as
[email.md](email.md): a route handler at `/api/schedules/run`, guarded by a
token, called by cron. If email lands first, share its poll route rather than
adding a second one — a deployment with two things to call is a deployment where
one of them is forgotten.

**Schedules are edited as drafts.** The whole form is a draft with a Save.
Enabling, disabling, running now and deleting are list-level commands and are
immediate.

## Schema

```prisma
enum RecurrenceKind {
  DAILY
  WEEKLY
  MONTHLY_DAY
  MONTHLY_WEEKDAY
  YEARLY
}

/// A ticket the desk raises on a rhythm. The fields are a template rather than
/// a past ticket to copy: a copy would bring a conversation and a history with
/// it, and neither belongs to the next occurrence.
model TicketSchedule {
  id       String  @id @default(cuid())
  name     String
  isActive Boolean @default(true)

  /// What gets raised.
  title       String
  description String     @default("")
  type        TicketType @default(QUESTION)
  priority    Priority   @default(MEDIUM)
  projectId   String?
  project     Project?   @relation(fields: [projectId], references: [id], onDelete: SetNull)
  teamId      String?
  team        Team?      @relation(fields: [teamId], references: [id], onDelete: SetNull)
  assigneeId  String?
  assignee    User?      @relation("ScheduleAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  /// Who the ticket is raised *about*. Required, the same way a ticket's
  /// reporter is — usually the desk's own service account.
  reporterId  String
  reporter    User       @relation("ScheduleReporter", fields: [reporterId], references: [id])
  labels      Label[]    @relation("ScheduleLabels")
  /// The change plan laid down on each occurrence, for a scheduled change.
  planId      String?
  plan        ChangeTemplate? @relation(fields: [planId], references: [id], onDelete: SetNull)

  /// When it fires.
  kind      RecurrenceKind
  /// ISO weekdays for WEEKLY and MONTHLY_WEEKDAY, 1 = Monday.
  weekdays  Int[]          @default([])
  /// Day of month for MONTHLY_DAY (1–31; a 31 falls back to the last day of a
  /// shorter month, because skipping February is when the check matters most).
  dayOfMonth Int?
  /// Which weekday of the month for MONTHLY_WEEKDAY: 1 is the first, -1 the
  /// last.
  weekOfMonth Int?
  /// Month for YEARLY, 1 = January.
  month       Int?
  /// Minutes from midnight in the instance time zone.
  timeOfDay   Int            @default(540)

  /// Due date on the raised ticket, as days after it is raised. Null leaves it
  /// unset.
  dueInDays Int?

  /// Don't raise the next one while the last is still open. Off for schedules
  /// where each occurrence is genuinely separate work.
  catchUp Boolean @default(false)

  /// Computed on save and after every firing, so the list can be ordered by
  /// what happens next and the runner needs one indexed query.
  nextRunAt DateTime?
  lastRunAt DateTime?

  tickets   Ticket[]
  createdAt DateTime @default(now())

  @@index([isActive, nextRunAt])
}
```

Add `scheduleId` to `Ticket` (nullable, `onDelete: SetNull`) so an occurrence
knows where it came from and the schedule can show its history.

Permission: `schedule.manage`, group `settings`. Migration name: `schedules`.

## Phases

### 1 — Recurrence arithmetic

`src/lib/recurrence.ts`: `nextOccurrence(schedule, after)`, pure, using
`date-fns` and the instance time zone from `src/lib/settings.ts`. Every rule
shape, plus the day-31 fallback and daylight-saving transitions.

This is the only genuinely fiddly part of the plan, it has no dependencies, and
it is the one piece worth writing a scratch script for: run every rule across a
two-year span and read the dates. Do that before building anything else.

Verify: a monthly-on-31 schedule fires 31 Jan, 28 Feb, 31 Mar; a weekly one
crossing the March clock change stays at the same local time.

### 2 — Manage

`src/app/(app)/settings/schedules` — list with next run, and an editor that
reuses the new-ticket form's fields. The editor shows the next three
occurrences in plain language as the rule is changed; a schedule whose rule
cannot be read back is a schedule that fires at the wrong time for a year.

Verify: each rule shape round-trips, and the preview matches what phase 1
computes.

### 3 — Fire

`runSchedules()` in `src/lib/actions/schedules.ts`: every active schedule whose
`nextRunAt` has passed raises a ticket through the existing creation path —
reference allocation, default status, plan application, notifications — then
recomputes `nextRunAt`. Respect `catchUp`: without it, skip while an unsettled
ticket from this schedule exists, and still advance `nextRunAt` so it does not
fire the moment that one closes.

A **Run now** button on each schedule, which does the same for one, and is how
this gets tested without waiting a month.

Verify: run now twice with `catchUp` off produces one ticket; close it and run
again to get the second.

### 4 — The route

`src/app/api/schedules/run/route.ts`, bearer token in `SCHEDULE_RUN_TOKEN`, or
folded into the mail poll route if that exists. README section on calling it.
A firing that fails must not stop the others: catch per schedule, record the
error, continue.

Verify: with one schedule pointed at a deleted project, the others still fire.

## Out of scope

Holiday calendars and "skip when the desk is closed" (business hours already
exist and could feed this later), schedules that raise a ticket a fixed time
*before* a date such as a certificate expiry — that wants the CMDB — and
schedules on the portal.
