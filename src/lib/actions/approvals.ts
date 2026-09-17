"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { APPROVER_ROLE_FILTER, can, canEditTicket, canViewTicket } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { refreshApprovals, refreshTicket } from "@/lib/refresh";
import { approvalSchema, fieldErrors } from "@/lib/validation";
import { supersede } from "@/lib/approvals";

/**
 * A decision the work is waiting on.
 *
 * Two permissions and one deliberate gap. `approval.request` says who may ask;
 * `approval.give` says who may be *named* — which is what keeps a request off
 * somebody who has nowhere to answer it. Answering itself is gated by neither:
 * having been asked is what lets you answer, so a permission trimmed after the
 * fact can never strand a question already addressed to you by name.
 *
 * Every write here leaves a row in the trail, because a change that quietly
 * stopped needing somebody's permission is exactly what an audit trail is for.
 */

/** Enough of a request to decide what it has become and who to tell. */
const ROUND = {
  id: true,
  phase: true,
  state: true,
  approverId: true,
  requestedById: true,
  ticket: {
    select: {
      id: true,
      number: true,
      type: true,
      statusId: true,
      assigneeId: true,
      reporterId: true,
    },
  },
} as const;

export async function requestApproval(ticketId: string, input: unknown) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const parsed = approvalSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, number: true, reporterId: true, assigneeId: true },
  });
  if (!ticket) return { ok: false as const, errors: { form: t.errors.ticketGone } };

  if (!can(user, "approval.request") || !canViewTicket(user, ticket)) {
    return { ok: false as const, errors: { form: t.errors.noApprovalRequest } };
  }

  const { phase, question, dueAt, approverId } = parsed.data;

  // Checked against the directory rather than trusted from the form. A request
  // addressed to somebody who cannot answer it — deactivated, or never meant to
  // be asked — leaves a gate with nobody behind it.
  const approver = await prisma.user.findFirst({
    where: { id: approverId, ...APPROVER_ROLE_FILTER },
    select: { id: true },
  });
  if (!approver) {
    return { ok: false as const, errors: { approverId: t.errors.approverNotAllowed } };
  }

  const unasked = await prisma.$transaction(async (tx) => {
    const was = await supersede(tx, ticket.id, phase, user.id);
    await tx.approval.create({
      data: { ticketId: ticket.id, phase, question, dueAt, approverId, requestedById: user.id },
    });
    await tx.activity.create({
      data: {
        ticketId: ticket.id,
        actorId: user.id,
        type: "APPROVAL_REQUESTED",
        field: "approval",
        newValue: phase,
      },
    });

    return was;
  });

  // `notify` drops the actor, so somebody who asks themselves for approval —
  // which is allowed, and is how a one-person sign-off gets recorded — is not
  // told about their own request.
  await notify({
    userId: approver.id,
    actorId: user.id,
    ticketId: ticket.id,
    kind: "APPROVAL_REQUESTED",
  });

  // And whoever was holding the old question hears that it is no longer theirs
  // — unless they are the one now being asked, who has just been told.
  for (const userId of new Set(unasked.filter((id) => id !== approver.id))) {
    await notify({ userId, actorId: user.id, ticketId: ticket.id, kind: "APPROVAL_DECIDED" });
  }

  refreshApprovals();
  refreshTicket(ticket.number);
  return { ok: true as const };
}

/**
 * The answer.
 *
 * A refusal carries a sentence, and what it reaches depends on what was asked.
 * A gate on a phase holds that phase and nothing else — the rest of the plan was
 * never the question. A gate on the change as a whole is the question of whether
 * the change happens at all, so a "no" there cancels it: work somebody said no
 * to is not work waiting to be asked about differently, and leaving it open on
 * the board is how a refusal quietly becomes a delay. Reviving it means moving
 * the ticket out of Cancelled by hand, which is a decision somebody owns.
 *
 * On anything that is not a change the refusal only records itself. There is no
 * plan to hold and nothing to cancel; somebody asked a question and got an
 * answer, and cancelling an incident because a decision about it went the other
 * way would be the feature deciding what the desk meant.
 */
export async function respondToApproval(approvalId: string, approved: boolean, comment = "") {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const approval = await prisma.approval.findUnique({ where: { id: approvalId }, select: ROUND });
  if (!approval) return { ok: false as const, error: t.errors.approvalGone };
  if (approval.state !== "PENDING") return { ok: false as const, error: t.errors.approvalClosed };
  if (approval.approverId !== user.id) return { ok: false as const, error: t.errors.notAnApprover };

  const why = comment.trim().slice(0, 1000);
  if (!approved && !why) return { ok: false as const, error: t.errors.needRefusalReason };

  // Only a "no" to the change as a whole ends the change. A phase gate holds
  // its phase and leaves the rest of the plan alone, and a ticket that is not a
  // change has no plan to end.
  const endsTheChange = !approved && approval.phase === null && approval.ticket.type === "CHANGE";

  // Where a refused change goes, if the desk keeps a status for it. Without one
  // the refusal still stands and still holds the gate — it simply has nowhere
  // to move the ticket to, which is better than inventing a status.
  const cancelling = endsTheChange
    ? await prisma.status.findFirst({
        where: { isCancelling: true },
        select: { id: true, name: true },
      })
    : null;

  const now = new Date();

  const answered = await prisma.$transaction(async (tx) => {
    // The state is the claim. Two answers racing — or one person double-clicking
    // — both read PENDING a moment ago, and without this both would write a
    // decision, a trail row and a mail. The second one changes nothing.
    const claimed = await tx.approval.updateMany({
      where: { id: approvalId, state: "PENDING" },
      data: { state: approved ? "APPROVED" : "REJECTED", comment: why || null, decidedAt: now },
    });
    if (claimed.count === 0) return false;

    await tx.activity.create({
      data: {
        ticketId: approval.ticket.id,
        actorId: user.id,
        type: approved ? "APPROVAL_GRANTED" : "APPROVAL_REFUSED",
        field: "approval",
        newValue: approval.phase,
      },
    });

    if (!cancelling) return true;

    // Read here rather than from the row loaded before the transaction: the
    // ticket may have moved while the approver was typing their reason, and
    // recording a move away from a status it is no longer in is a trail entry
    // that never happened.
    const ticket = await tx.ticket.findUnique({
      where: { id: approval.ticket.id },
      select: { statusId: true, status: { select: { name: true } } },
    });
    if (!ticket || ticket.statusId === cancelling.id) return true;

    await tx.ticket.update({
      where: { id: approval.ticket.id },
      // `resolvedAt` because the ticket has come off the queue; no `closedAt`,
      // because the cancelling status is deliberately not the closing one — a
      // change that was refused never ran, and a desk that cannot tell that
      // apart from one that ran and finished cannot report on either.
      data: { statusId: cancelling.id, resolvedAt: now },
    });
    await tx.activity.create({
      data: {
        ticketId: approval.ticket.id,
        actorId: user.id,
        type: "STATUS_CHANGED",
        field: "status",
        oldValue: ticket.status?.name ?? null,
        newValue: cancelling.name,
      },
    });

    // Everything still to do stops being still to do. A cancelled change whose
    // steps still read "Open" is one somebody picks up next week by accident.
    await tx.changeStep.updateMany({
      where: { ticketId: approval.ticket.id, status: { notIn: ["DONE", "SKIPPED"] } },
      data: { status: "SKIPPED", blockedReason: null, doneAt: now, doneById: user.id },
    });

    // And nobody else is chased for a decision about work that is not going to
    // happen. Their question was about this change, and this change is over.
    await tx.approval.updateMany({
      where: { ticketId: approval.ticket.id, state: "PENDING" },
      data: { state: "CANCELLED", decidedAt: now },
    });

    return true;
  });

  // Somebody else got there first. Nothing was written, so there is nothing to
  // tell anybody about.
  if (!answered) return { ok: false as const, error: t.errors.approvalClosed };

  // Both the person who asked and whoever is holding the change: a cancellation
  // changes what the assignee does next, and they are often not the asker.
  for (const userId of new Set([approval.requestedById, approval.ticket.assigneeId])) {
    await notify({
      userId,
      actorId: user.id,
      ticketId: approval.ticket.id,
      kind: "APPROVAL_DECIDED",
    });
  }

  refreshApprovals();
  refreshTicket(approval.ticket.number);
  return { ok: true as const };
}

/**
 * Withdrawing the question. For whoever asked it and for anyone who may change
 * the ticket — the gate holds up their work, so they can take it down.
 *
 * Only while it is still open: a granted or refused request is the record of a
 * decision that was actually made, and that is not something to tidy away.
 */
export async function cancelApproval(approvalId: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const approval = await prisma.approval.findUnique({ where: { id: approvalId }, select: ROUND });
  if (!approval) return { ok: false as const, error: t.errors.approvalGone };
  if (approval.state !== "PENDING") return { ok: false as const, error: t.errors.approvalClosed };

  if (approval.requestedById !== user.id && !canEditTicket(user)) {
    return { ok: false as const, error: t.errors.noApprovalCancel };
  }

  const withdrawn = await prisma.$transaction(async (tx) => {
    // The same claim the answer makes, for the same reason: withdrawing a
    // question somebody has just answered would overwrite their decision with
    // "nobody ever answered this".
    const claimed = await tx.approval.updateMany({
      where: { id: approvalId, state: "PENDING" },
      data: { state: "CANCELLED", decidedAt: new Date() },
    });
    if (claimed.count === 0) return false;

    await tx.activity.create({
      data: {
        ticketId: approval.ticket.id,
        actorId: user.id,
        type: "APPROVAL_CANCELLED",
        field: "approval",
        newValue: approval.phase,
      },
    });

    return true;
  });

  if (!withdrawn) return { ok: false as const, error: t.errors.approvalClosed };

  // The question was in somebody's list a moment ago. Being un-asked is news.
  await notify({
    userId: approval.approverId,
    actorId: user.id,
    ticketId: approval.ticket.id,
    kind: "APPROVAL_DECIDED",
  });

  refreshApprovals();
  refreshTicket(approval.ticket.number);
  return { ok: true as const };
}

/**
 * Asking again after a refusal.
 *
 * A refused round is the record of a decision, so it is never edited: this
 * writes a new one, with the old question and the same gate already filled in
 * because the second asking is nearly always the first one plus whatever was
 * objected to.
 *
 * The revival is the other half, and only for the refusal that cancelled a
 * change: a "no" to the whole ticket cancelled it, skipped everything still to
 * do and stood down the other approvers, and asking again with all of that left
 * as it is asks somebody to approve work the board says is over. A phase gate
 * cancelled nothing, so there is nothing to put back.
 *
 * Where the ticket goes back to is read out of the trail — the entry the
 * cancellation itself wrote — rather than guessed at. A desk that has since
 * renamed or deleted that status gets the starting one instead, which is wrong
 * in a way somebody can see and fix, unlike a ticket left in Cancelled.
 */
export async function askAgain(approvalId: string, input: unknown) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const parsed = approvalSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: fieldErrors(parsed.error, t) };

  const refused = await prisma.approval.findUnique({
    where: { id: approvalId },
    select: {
      id: true,
      phase: true,
      state: true,
      decidedAt: true,
      ticket: {
        select: { id: true, number: true, type: true, reporterId: true, assigneeId: true },
      },
    },
  });
  if (!refused) return { ok: false as const, errors: { form: t.errors.approvalGone } };
  if (refused.state !== "REJECTED") {
    return { ok: false as const, errors: { form: t.errors.approvalClosed } };
  }
  if (!can(user, "approval.request") || !canViewTicket(user, refused.ticket)) {
    return { ok: false as const, errors: { form: t.errors.noApprovalRequest } };
  }

  if (refused.phase === null && refused.ticket.type === "CHANGE") {
    await revive(refused.ticket.id, refused.decidedAt, user.id);
  }

  return requestApproval(refused.ticket.id, input);
}

/** Out of Cancelled, and everything that refusal skipped back where it was. */
async function revive(ticketId: string, refusedAt: Date | null, actorId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { statusId: true, status: { select: { name: true, isCancelling: true } } },
  });
  if (!ticket?.status?.isCancelling) return;

  // What it was in before the refusal moved it, by name, from the entry the
  // refusal wrote.
  const moved = await prisma.activity.findFirst({
    where: { ticketId, type: "STATUS_CHANGED", newValue: ticket.status.name },
    orderBy: { createdAt: "desc" },
    select: { oldValue: true },
  });

  const back =
    (moved?.oldValue
      ? await prisma.status.findFirst({
          where: { name: moved.oldValue },
          select: { id: true, name: true },
        })
      : null) ??
    (await prisma.status.findFirst({
      where: { isDefault: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }));
  if (!back || back.id === ticket.statusId) return;

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticketId },
      // `resolvedAt` comes off with the status: the change is waiting again,
      // and a ticket that reports as resolved while somebody is being asked
      // about it is a report nobody can use.
      data: { statusId: back.id, resolvedAt: null },
    });
    await tx.activity.create({
      data: {
        ticketId,
        actorId,
        type: "STATUS_CHANGED",
        field: "status",
        oldValue: ticket.status!.name,
        newValue: back.name,
      },
    });

    // Only what that refusal skipped, by the moment it did it. A step somebody
    // skipped on purpose last week is a decision of theirs, not wreckage.
    const skipped = await tx.changeStep.findMany({
      where: { ticketId, status: "SKIPPED", ...(refusedAt ? { doneAt: { gte: refusedAt } } : {}) },
      select: { id: true, title: true },
    });
    if (skipped.length === 0) return;

    await tx.changeStep.updateMany({
      where: { id: { in: skipped.map((step) => step.id) } },
      data: { status: "OPEN", doneAt: null, doneById: null },
    });
    // One entry per step rather than a count, because that is what the trail
    // renders and what somebody scanning it is looking for by name.
    await tx.activity.createMany({
      data: skipped.map((step) => ({
        ticketId,
        actorId,
        type: "STEP_REOPENED" as const,
        stepId: step.id,
        newValue: step.title,
      })),
    });
  });
}
