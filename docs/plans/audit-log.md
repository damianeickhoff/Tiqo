# Audit log

Record what administrators do. `Activity` is an excellent trail for tickets and
projects and covers nothing else: a role gaining `ticket.delete`, someone being
deactivated, the portal being closed, a status being deleted out from under two
hundred tickets — none of it leaves a mark.

Read [conventions.md](conventions.md) first.

## Decisions already made

**A separate table from `Activity`.** `Activity` hangs off a ticket or a
project, is rendered as prose in a timeline people read constantly, and is
deletable by anyone with `activity.delete`. An audit record is none of those
things: it has no ticket, nobody reads it for pleasure, and **it can never be
deleted by anyone, including the master role.** Sharing a table would mean the
delete action has to grow an exception, which is exactly the sort of exception
that is later removed by someone who does not know why it is there.

**Append-only, enforced in the code with no delete action anywhere.** No
`deleteAuditEntry`, not behind a permission, not for the master role. If
retention becomes a requirement, it arrives as a documented pruning job with a
minimum age — not as a button.

**One row per administrative change, with before and after as JSON.** Text
columns like `Activity.oldValue` work for a single field; a settings save
changes nine at once. Store what changed and nothing that did not — a diff, not
a snapshot — so the row answers "what did they change" rather than "what did the
record look like".

**Never store secrets.** Mail passwords, API tokens, password hashes: record
that the field changed, with both values replaced by a marker. This is a rule,
not a nicety — an audit log that leaks the SMTP password is a worse liability
than no audit log.

**Writing is a helper, not a middleware.** `recordAudit()` called explicitly
from each admin action, like `notify()` already is. A generic interceptor over
Prisma would catch the writes but not the intent, and "Ada changed a row in
Role" is not the sentence anyone needs.

## Schema

```prisma
/// What somebody did to the instance itself, as opposed to what they did to a
/// ticket. Append-only: there is no action anywhere in the codebase that
/// deletes one of these, deliberately, and adding one would defeat the point
/// of having them.
model AuditEntry {
  id String @id @default(cuid())

  /// What was touched and what happened to it, as two plain strings —
  /// "role" / "updated", "user" / "deactivated", "status" / "deleted". Not an
  /// enum: this list grows every time an admin screen is added, and a migration
  /// per new screen is friction that ends with screens that record nothing.
  entity String
  action String
  /// The row it was about, and what it was called at the time. The name is
  /// stored because the row may be gone — "deleted status Triage" has to still
  /// read properly a year later.
  entityId   String?
  entityName String?

  /// What changed, as `{ field: [before, after] }`. Only the fields that
  /// actually changed, and never a secret — a changed password is recorded as
  /// changed, with both sides replaced by a marker.
  changes Json?

  actorId   String?
  actor     User?   @relation(fields: [actorId], references: [id], onDelete: SetNull)
  /// Who they were at the time, kept because the account may be deleted and
  /// because a name is what a reader needs.
  actorName String

  /// Where from. Enough to tell a console session from a scripted one.
  ip        String?
  userAgent String?

  createdAt DateTime @default(now())

  @@index([createdAt])
  @@index([entity, entityId])
  @@index([actorId, createdAt])
}
```

Permission: `audit.view`, group `settings`. Migration name: `audit_log`.

## Phases

### 1 — The helper

`src/lib/audit.ts`, `import "server-only"`:

- `recordAudit({ entity, action, entityId, entityName, changes })` — resolves
  the actor from the session, pulls the IP and user agent from `headers()`,
  writes the row;
- `diff(before, after, { secrets })` — returns only the changed fields, with
  anything named in `secrets` reduced to a marker. This is the function that
  keeps the rule above true, so it belongs here rather than at each call site.

Failure is swallowed and logged, the way `recordReferences` already swallows
its failures: an audit row that did not get written is a gap in a log, an admin
save that failed because of one is somebody's afternoon.

Verify: a scratch call writes a row with the right shape; `diff` on an unchanged
object returns nothing.

### 2 — Cover the admin actions

Add `recordAudit` to every mutating action in `src/lib/actions/admin.ts`,
`roles.ts`, `settings.ts`, `statuses.ts`, `teams.ts`, `portal-admin.ts`,
`change-templates.ts`, and to account creation, deactivation, role changes and
password resets in `src/lib/actions/auth.ts` and `accounts.ts`.

Work through the files one at a time and check each off — the value of this
feature is entirely in its coverage, and a log that is missing the one action
somebody wants is the same as no log.

Two things outside those files that belong here: **sign-in failures** and
**session creation**, in `src/lib/auth.ts`. "Who was logged in when this
happened" is the second question every investigation asks.

Verify: change a role's permissions, rename a status, deactivate a user, sign in
wrongly twice; four rows, each naming the right thing.

### 3 — Read it

`src/app/(app)/settings/audit`, behind `audit.view`. A dense table — time,
actor, entity, action, and the changed fields expandable — with filters on
actor, entity and a date range, and cursor pagination. It will be the largest
table in the instance; do not load it all.

Write the sentence for each `entity`/`action` pair in the dictionaries, falling
back to the raw strings when a pair has no translation yet. A log that goes
blank because somebody added an action without a label is worse than one that
reads slightly roughly.

Verify: a hundred seeded rows page without a visible delay, and every filter
narrows correctly.

### 4 — Where it belongs on the page

A person's own recent administrative actions on their page in
`src/app/(app)/people/[id]`, behind the same permission. The question "what has
this account been doing" is asked about a person far more often than it is asked
about the instance.

Verify: the list shows that person's rows only.

## Out of scope

Export to CSV or syslog, retention and pruning, tamper-evidence such as hash
chaining, alerting on particular actions, and auditing reads. Auditing reads in
particular sounds valuable and is the change that turns a useful log into an
unreadable one.
