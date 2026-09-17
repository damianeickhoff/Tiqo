# Approvals — audit

## Actual model (after deviations)
`prisma/schema.prisma:940-976` — `Approval` = one question to one person: `approverId`, `comment`, `decidedAt` on the round; `ApprovalResponse`/`ApprovalRule` dropped by `20260914140000_one_approver_and_cancelling_status`. Re-asking supersedes (`src/lib/actions/approvals.ts:45-50`). `Status.isCancelling` (`schema.prisma:302`) — a refusal moves the ticket there. `ChangeTemplate.approverId` / `ChangeTemplatePhase.approverId` (`schema.prisma:870,893`) copied into Approval rows when a plan is applied (out of scope in plan; shipped). Permissions: `approval.request` + `approval.give` (may be named) `permissions.ts:24-25,127-130`; answering ungated.

## 1. Broken / buggy
B1 `approvals.ts:123-146` — `respondToApproval` read-then-write, no guard → double answers, duplicate activity/mail, approve racing refuse. Fix: `updateMany({ where: { id, state: "PENDING" } })`, bail on count 0.
B2 `approvals.ts:220-245` — `cancelApproval` same TOCTOU; withdrawal can overwrite a committed refusal.
B3 `approvals.ts:158-194` — refusing a *phase* approval cancels the entire change (phase never consulted), skips every step, cancels other rounds.
B4 same block — cancels non-CHANGE tickets too (no `ticket.type === "CHANGE"` check).
B5 `approvals.ts:158,160` — stale `statusId` read before the transaction.
B6 `approvals.ts:169` — refusal stamps `resolvedAt`/`closedAt` on a status deliberately not closing (contradicts migration comment).
B7 `waiting-approvals.tsx:49` → `/tickets/N` but `tickets/[number]/page.tsx:169` 404s unless `ticket.view.all` or reporter; approver has no view right.
B8 `steps.ts:449-470` — template approvers copied raw, no `APPROVER_ROLE_FILTER` check; deactivated approver → unanswerable gate.
B9 `steps.ts:479` — array not Set → duplicate notification when same person on change and phase.
B10 `approvals.ts:45-50,82`, `steps.ts:459-462` — supersede writes no activity, no notification; `cancelApproval` no notification.
B11 `mail.ts:267-272`, `mail-templates.ts:17-25` — no mail for APPROVAL_REQUESTED / APPROVAL_DECIDED.
B12 `portal-approvals.tsx:116-123` — description rendered `whitespace-pre-line` not `<Markdown>`.
B13 `portal/approvals/page.tsx:32` — `take` before the pending/answered split; answered section can disappear.
B14 `approvals.tsx:354,422`, `portal-approvals.tsx:45,60` — one shared error slot for a list.
B15 `plan-board.tsx:110-113, :311` — whole-ticket gate says "This phase has not been approved".

Verified fine: only named approver answers (master included); actor not notified; refusal ends round; gate enforced in `steps.ts:166-189`; activity on grant/refuse in transaction; overdue in one place (`lib/approvals.ts:79-81`); dashboard ordering; portal revalidation; nl complete; cancel permission.

## 2. Plan gaps
- Phase 1: `question` optional in `validation.ts:147-153` though schema insists; template-laid rounds always have null question (`steps.ts:464-468`); `dueAt` no floor.
- Phase 3: `/tickets/N/plan` and `/tickets/N/steps/[stepId]` do not render the approve prompt.
- Phase 5: `approvals` widget not in `DEFAULT_WIDGETS` (`dashboard-widgets.ts:57`); query runs on every dashboard load regardless (`page.tsx:83-95`).

## 3. Overbuilt
- `approvalGate` standing-refusal ledger (`lib/approvals.ts:54-76`) unreachable given B3.
- `isOpen` exported, used once.
- Three queries per portal page load for banner/badge (`portal/(shell)/layout.tsx:69-77`).
- `approval.give` as second permission (plan wanted none); gates only the picker.
- Brand-tint callout inline `style` object ×3 (`approvals.tsx:375-378`, `portal-approvals.tsx:79-82`, `portal-approval-banner.tsx:37-40`).

## 4. Underbuilt
No reminder/nudge on dueAt; no "ask again" after refusal (recovery = manual un-cancel + un-skip); no approver substitution; no desk-wide approvals list (widget `take: 6`); `decidedAt` never shown; no attachments on portal approval card.

## 5. Missing useful features
1. Approval mail with deep link. 2. Due-date reminder sweep. 3. Desk-wide `/approvals` queue. 4. Reassign approver on a standing round (trail both). 5. "Ask again" on a refused round reviving skipped steps. 6. Named approver can read the ticket they gate (or widget routes to portal).

## 6. Design / UI
Good: no literal colours; PanelCard; EmptyState; icons consistent; prompt at top on desk and portal; refusal comment required in UI + action.
Flags:
- **CLAUDE.md violation:** `plan-editor.tsx:123-128, :159-165` save approver on change (`setTemplateApprover`/`setPhaseApprover`); name/description save on blur `:73-77, :88-92` (pre-existing). No dirty state, no saved confirmation.
- Inline style callout ×3.
- Withdraw bare `<button>` (`approvals.tsx:178-190`) vs `Button`; three error shapes (`approvals.tsx:110`, `portal-approvals.tsx:61-66`, `plan-editor.tsx:143-145`); `FormError` exists.
- `decidedAt` never shown.
- Template rounds render bare gate label ("The Deploy phase") as the question (`approvals.tsx:388`).
- Dead strings: `dashboard.approvalsHint`, `portal.approvalAsked`, `approvals.waitingFor`.

## Top 10
1. B1+B2 conditional writes.
2. B11 approval mail templates.
3. B3+B4 scope cancellation (phase null only; CHANGE only).
4. B8 validate template approver in copyPlanOnto.
5. B7 approver can view gated ticket, or widget → portal.
6. Add `approvals` to DEFAULT_WIDGETS.
7. Plan editor save-on-change → draft + Save.
8. B10 trail + notify on supersede and withdrawal.
9. B6+B5 no closedAt on cancelling; re-read inside tx.
10. B12+B15 Markdown on portal card; whole-ticket wording.
Cheap: B9, B13, B14, dead keys, `isOpen`.
