# Approvals

Let a ticket wait on a decision from named people, and record what they decided.
Tiqo has change tickets with phased plans and templates
(`ChangeStep`, `ChangeTemplate`), but nothing gates them: any operator can work
any step at any time. A change process without an approval step is a checklist.

Read [conventions.md](conventions.md) first.

## Decisions already made

**An approval is asked of people, and each answers for themselves.** One row per
approver, not one row with a list of names. "Who has not answered yet" is the
question the feature exists to answer, and a JSON array of names cannot be
queried, notified, or shown as a face.

**Two quorum rules: everyone, or any one of them.** `ALL` and `ANY`. Percentage
thresholds and weighted approvers are a workflow engine; this is a gate.

**A refusal ends the round.** The moment one approver declines under `ALL`, the
request is `REJECTED` and the remaining approvers are not chased. Somebody can
open a new round after the objection is dealt with — which is the honest record
of what happened, unlike a request that lingers half-answered.

**Approvals hang off a ticket, optionally at a phase.** With no phase, the whole
ticket waits. With a phase, the existing gate in the plan board is extended: a
phase whose approval is not granted cannot be started, for the same reason a
later phase cannot start while an earlier one is unfinished. Reuse that
mechanism rather than adding a second, parallel notion of "blocked".

**A comment is mandatory on a refusal, optional on an approval.** "No" without a
reason produces a second request identical to the first.

**Approving is a list-level command.** One click, immediate, with a confirm on
the refusal because it carries a comment.

## Schema

```prisma
enum ApprovalState {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum ApprovalRule {
  ALL
  ANY
}

/// A decision the work is waiting on. Not a step: a step is something somebody
/// does, and this is something somebody permits — plans express the first and
/// were never meant to express the second.
model Approval {
  id       String        @id @default(cuid())
  ticketId String
  ticket   Ticket        @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  /// The plan phase this gates, by name, matching `ChangeStep.phase`. Null
  /// gates the ticket as a whole.
  phase    String?
  rule     ApprovalRule  @default(ALL)
  state    ApprovalState @default(PENDING)
  /// What is being asked, in the requester's words. A name and a due date are
  /// not enough for somebody to answer with.
  question String?
  dueAt    DateTime?

  requestedById String?
  requestedBy   User?    @relation("ApprovalRequester", fields: [requestedById], references: [id], onDelete: SetNull)
  createdAt     DateTime @default(now())
  decidedAt     DateTime?

  responses ApprovalResponse[]

  @@index([ticketId, state])
}

/// One person's answer. The row exists from the moment they are asked, with a
/// null decision — that is what makes "still waiting on Ada" answerable.
model ApprovalResponse {
  id         String   @id @default(cuid())
  approvalId String
  approval   Approval @relation(fields: [approvalId], references: [id], onDelete: Cascade)
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// Null until they answer. True is a yes.
  approved Boolean?
  /// Required on a refusal. "No" with no reason produces the same request again.
  comment  String?
  decidedAt DateTime?

  @@unique([approvalId, userId])
  @@index([userId, decidedAt])
}
```

Add `NotificationKind.APPROVAL_REQUESTED` and `APPROVAL_DECIDED`, and
`ActivityType.APPROVAL_REQUESTED`, `APPROVAL_GRANTED`, `APPROVAL_REFUSED`,
`APPROVAL_CANCELLED`. Permission: `approval.request`, group `tickets`. Anyone
named on a request may answer it — being asked *is* the permission, and a
separate key for it would let an admin accidentally remove somebody's ability to
answer a question addressed to them.

Migration name: `approvals`.

## Phases

### 1 — Ask

`src/lib/actions/approvals.ts`: `requestApproval` (ticket, optional phase, rule,
question, due date, approvers) creating the `Approval` and one `PENDING`
response per approver, writing the trail and notifying each of them.
`cancelApproval` for the requester and `ticket.edit` holders.

Verify: a request to three people produces three notifications and no fourth to
the requester.

### 2 — Answer

`respondToApproval(approvalId, approved, comment)`, only for a named approver
with an unanswered row. After writing, re-evaluate: `ALL` grants when every
response is a yes; `ANY` grants on the first; either rejects on the first no.
On a decision, stamp `decidedAt` and notify the requester.

Verify: under `ALL`, two yeses leave it pending and the third grants it; one no
at any point rejects it and the remaining approvers stop being chased.

### 3 — On the ticket

An Approvals card in the ticket rail: the question, the rule, and a face per
approver with their state — waiting, yes, no — and their comment. For a viewer
who is an approver with an unanswered row, Approve and Refuse buttons at the
top of the ticket, not buried in the rail. Being asked is the most important
thing on the page for that person.

Verify: the same ticket read by an approver and by a bystander; only one of
them is offered the buttons.

### 4 — The gate

In `src/components/tickets/plan-board.tsx` and the step actions
(`src/lib/actions/steps.ts`), a phase with a `PENDING` or `REJECTED` approval
cannot have its steps started or completed. Show why on the phase, in the same
vocabulary the existing phase gate uses.

Verify: a step in a gated phase cannot be marked done, and can the moment the
approval is granted.

### 5 — Waiting on me

A dashboard widget in `src/lib/dashboard-widgets.ts` listing approvals waiting
on the viewer, overdue ones first. Without this the feature depends on people
reading notifications, and it will be blamed for being slow.

Verify: two pending requests appear for the approver and neither for anyone else.

## Out of scope

Approval by email reply (revisit after [email.md](email.md)), delegation and
out-of-office substitutes, approval templates attached to change templates,
and any automatic approver derived from a CI's owner or a project's lead. The
last one is tempting and belongs after [cmdb.md](cmdb.md).
