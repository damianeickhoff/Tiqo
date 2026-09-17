import type { ApprovalState } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The rules of a request for approval.
 *
 * One person is asked, and their answer is the answer. A decision somebody has
 * to be accountable for is one person's to make; a request split across three
 * names is three people each assuming one of the others will deal with it.
 * Asking somebody else means asking again, and the request that was standing is
 * withdrawn rather than left open beside the new one.
 *
 * A refusal is the end of the change, not of the request: the work does not sit
 * there waiting to be asked differently, it is cancelled. Reviving it is a
 * deliberate act by somebody who can change the ticket.
 */

/**
 * One question per gate at a time.
 *
 * Asking somebody else is allowed, and is how an approver gets changed — but
 * the request that was standing does not survive it. Two open requests on one
 * phase is two people each waiting to see whether the other answers, and a gate
 * that needs both of them to open.
 *
 * Returns who was asked, because being un-asked is news: somebody with the
 * question in their list should not have to open it to find out it is no longer
 * theirs. The trail says it too — a gate that stopped needing a decision is
 * exactly what a trail is for. Here rather than beside the action that calls it,
 * because applying a plan supersedes rounds as well and the two must not drift.
 */
export async function supersede(
  tx: Prisma.TransactionClient,
  ticketId: string,
  phase: string | null,
  actorId: string,
) {
  const standing = await tx.approval.findMany({
    where: { ticketId, phase, state: "PENDING" },
    select: { id: true, approverId: true },
  });
  if (!standing.length) return [];

  await tx.approval.updateMany({
    where: { id: { in: standing.map((round) => round.id) } },
    data: { state: "CANCELLED", decidedAt: new Date() },
  });
  await tx.activity.create({
    data: { ticketId, actorId, type: "APPROVAL_CANCELLED", field: "approval", newValue: phase },
  });

  return standing.map((round) => round.approverId).filter((id): id is string => Boolean(id));
}

/**
 * Which parts of a plan an unanswered decision is holding.
 *
 * `whole` is an approval asked of the ticket rather than of a phase: nothing in
 * the plan may be worked until it is granted. `phases` are held by name,
 * matching `ChangeStep.phase`, which is how a step already carries the phase it
 * belongs to.
 */
export type ApprovalGate = {
  whole: boolean;
  phases: ReadonlySet<string>;
};

export const NO_GATE: ApprovalGate = { whole: false, phases: new Set() };

/**
 * What is held, given every round ever asked of this ticket.
 *
 * Two rules, because a refusal has to stop the work *and* be recoverable from:
 *
 *   · anything still waiting holds its phase — nobody has finished answering;
 *   · a refusal holds its phase until a later round on the same phase says
 *     otherwise.
 *
 * A refused round left standing is what makes "no" mean something. Reading only
 * the standing one is what makes "open a new round once the objection has been
 * dealt with" mean something too: without it the first refusal would lock the
 * phase for the life of the ticket, whatever anybody decided afterwards.
 *
 * Cancelled rounds are questions nobody ended up answering, so they say nothing
 * either way.
 */
export function approvalGate(
  approvals: { phase: string | null; state: ApprovalState; createdAt: Date }[],
): ApprovalGate {
  const standing = new Map<string | null, { at: number; state: ApprovalState }>();
  const waiting = new Set<string | null>();

  for (const approval of approvals) {
    if (approval.state === "CANCELLED") continue;
    if (approval.state === "PENDING") waiting.add(approval.phase);

    const last = standing.get(approval.phase);
    const at = approval.createdAt.getTime();
    if (!last || at > last.at) standing.set(approval.phase, { at, state: approval.state });
  }

  const held = new Set<string | null>(waiting);
  for (const [phase, last] of standing) if (last.state === "REJECTED") held.add(phase);

  return {
    whole: held.has(null),
    phases: new Set([...held].filter((phase): phase is string => phase !== null)),
  };
}

/** Past its date and still waiting. The widget leads with these. */
export function isApprovalOverdue(approval: { dueAt: Date | null; state: ApprovalState }) {
  return Boolean(
    approval.state === "PENDING" && approval.dueAt && approval.dueAt.getTime() < Date.now(),
  );
}
