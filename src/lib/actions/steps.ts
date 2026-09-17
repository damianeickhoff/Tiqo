"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { APPROVER_ROLE_FILTER, canEditTicket } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { blockedBy, isStepSettled } from "@/lib/plan";
import { approvalGate, supersede } from "@/lib/approvals";
import { refreshApprovals } from "@/lib/refresh";
import type { StepStatus } from "@/generated/prisma/enums";
import type { ActivityType } from "@/generated/prisma/enums";

/**
 * The plan on a change: an ordered list of steps, each of which can belong to a
 * different person.
 *
 * Every write here is guarded by `ticket.edit` — a plan is a ticket property
 * like any other — and every one records an activity, because a change that
 * quietly grew two steps is exactly what an audit trail is for.
 */
async function guard(ticketId: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canEditTicket(user)) return { user, t, error: t.errors.noTicketChange };

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, number: true },
  });
  if (!ticket) return { user, t, error: t.errors.ticketGone };

  return { user, t, ticket };
}

/**
 * An event about a step. `stepId` puts it on that step's own conversation and
 * keeps it off the change's timeline, where a plan of twenty steps would drown
 * the thread it is meant to accompany — the toolbar already reports progress.
 * The change's audit trail still lists every one of them.
 *
 * Left null when there is no step to point at any more, as with a removal.
 */
function trail(
  ticketId: string,
  actorId: string,
  type: ActivityType,
  values: { stepId?: string; oldValue?: string; newValue?: string } = {},
) {
  return prisma.activity.create({
    data: { ticketId, actorId, type, field: "step", ...values },
  });
}

export async function addStep(ticketId: string, rawTitle: string, phase?: string | null) {
  const { user, t, ticket, error } = await guard(ticketId);
  if (error || !ticket) return { ok: false as const, error };

  const title = rawTitle.trim().slice(0, 160);
  if (!title) return { ok: false as const, error: t.errors.nameStep };

  // Added to a phase, the step joins the end of that phase and takes its
  // number; added to no phase, it goes to the end of the plan.
  const sibling =
    phase === undefined
      ? null
      : await prisma.changeStep.findFirst({
          where: { ticketId, phase: phase ?? null },
          orderBy: { position: "desc" },
          select: { phaseOrder: true },
        });

  const last = await prisma.changeStep.findFirst({
    where: { ticketId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  // Created first so the activity can point at it: the row is the opening line
  // of the step's own conversation.
  await prisma.$transaction(async (tx) => {
    const step = await tx.changeStep.create({
      data: {
        ticketId,
        title,
        position: (last?.position ?? -1) + 1,
        ...(phase === undefined
          ? {}
          : { phase: phase ?? null, phaseOrder: sibling?.phaseOrder ?? 0 }),
      },
      select: { id: true },
    });
    await tx.activity.create({
      data: {
        ticketId,
        actorId: user.id,
        type: "STEP_ADDED",
        field: "step",
        stepId: step.id,
        newValue: title,
      },
    });
  });

  revalidatePath(`/tickets/${ticket.number}`);
  return { ok: true as const };
}

export async function renameStep(stepId: string, rawTitle: string) {
  const step = await prisma.changeStep.findUnique({
    where: { id: stepId },
    select: { ticketId: true, title: true },
  });
  if (!step) return { ok: false as const, error: undefined };

  const { t, ticket, error } = await guard(step.ticketId);
  if (error || !ticket) return { ok: false as const, error };

  const title = rawTitle.trim().slice(0, 160);
  if (!title) return { ok: false as const, error: t.errors.nameStep };

  await prisma.changeStep.update({ where: { id: stepId }, data: { title } });

  revalidatePath(`/tickets/${ticket.number}`);
  return { ok: true as const };
}

/**
 * Where a step stands. Setting it to a finished state is the one write that
 * also tells someone: the person holding the change hears when a step of it is
 * finished by somebody else.
 */
/**
 * Move a step, and — where the move is "we are stuck" — say why.
 *
 * A blocked step with no reason is a red chip nobody can act on. The reason is
 * asked for at the moment of blocking, kept on the step so every drawing of it
 * can say the same thing, and thrown away the moment the step moves on.
 */
export async function setStepStatus(stepId: string, status: StepStatus, reason = "") {
  const step = await prisma.changeStep.findUnique({
    where: { id: stepId },
    select: {
      ticketId: true,
      title: true,
      status: true,
      phase: true,
      phaseOrder: true,
      blocksPhase: true,
      skipNeedsReason: true,
      dependsOnId: true,
    },
  });
  if (!step) return { ok: false as const, error: undefined };

  const settling = isStepSettled({ status });
  // Blocked is not "started": saying you cannot proceed is exactly what
  // somebody standing behind a gate needs to be able to say.
  const started = status !== "OPEN" && status !== "BLOCKED";

  const { user, t, ticket, error } = await guard(step.ticketId);
  if (error || !ticket) return { ok: false as const, error };

  const why = reason.trim().slice(0, 500);
  if (status === "BLOCKED" && !why)
    return { ok: false as const, error: t.errors.needBlockedReason };
  // Some steps are optional and some are the ones an auditor asks about. Which
  // is which was decided in the plan, so the answer is asked for here.
  if (status === "SKIPPED" && step.skipNeedsReason && !why)
    return { ok: false as const, error: t.errors.needSkipReason };

  // The gate is enforced here, not only drawn in the interface: the checkbox
  // being disabled is a courtesy, this is the rule.
  if (started) {
    const [siblings, approvals] = await Promise.all([
      prisma.changeStep.findMany({
        where: { ticketId: step.ticketId },
        select: {
          id: true,
          phase: true,
          phaseOrder: true,
          status: true,
          blocksPhase: true,
          dependsOnId: true,
        },
      }),
      prisma.approval.findMany({
        where: { ticketId: step.ticketId },
        select: { phase: true, state: true, createdAt: true },
      }),
    ]);
    const block = blockedBy({ id: stepId, ...step }, siblings, approvalGate(approvals));
    if (block) {
      return {
        ok: false as const,
        error:
          block.reason === "approval" || block.reason === "change"
            ? t.errors.approvalPending
            : block.reason === "phase"
              ? t.errors.phaseLocked
              : t.errors.stepBlocked,
      };
    }
  }

  await prisma.$transaction([
    prisma.changeStep.update({
      where: { id: stepId },
      data: {
        status,
        blockedReason: status === "BLOCKED" ? why : null,
        skipReason: status === "SKIPPED" ? why || null : null,
        ...(settling
          ? { doneAt: new Date(), doneById: user.id }
          : { doneAt: null, doneById: null }),
      },
    }),
    trail(step.ticketId, user.id, settling ? "STEP_DONE" : "STEP_REOPENED", {
      stepId,
      newValue: step.title,
    }),
  ]);

  if (settling) {
    const holder = await prisma.ticket.findUnique({
      where: { id: step.ticketId },
      select: { assigneeId: true },
    });
    await notify({
      userId: holder?.assigneeId,
      actorId: user.id,
      ticketId: step.ticketId,
      kind: "COMMENTED",
    });
  }

  revalidatePath(`/tickets/${ticket.number}`);
  return { ok: true as const };
}

/**
 * The block is gone: put the step back to work.
 *
 * Back to "doing" where the plan allows it, and to "to do" where a gate still
 * holds it — asking somebody to clear a block and then pick a state is asking
 * twice for one decision.
 */
export async function solveBlock(stepId: string) {
  const started = await setStepStatus(stepId, "IN_PROGRESS");
  return started.ok ? started : setStepStatus(stepId, "OPEN");
}

export async function setStepDescription(stepId: string, description: string) {
  const step = await prisma.changeStep.findUnique({
    where: { id: stepId },
    select: { ticketId: true },
  });
  if (!step) return { ok: false as const, error: undefined };

  const { ticket, error } = await guard(step.ticketId);
  if (error || !ticket) return { ok: false as const, error };

  await prisma.changeStep.update({
    where: { id: stepId },
    data: { description: description.trim().slice(0, 4000) || null },
  });

  revalidatePath(`/tickets/${ticket.number}/steps/${stepId}`);
  return { ok: true as const };
}

export async function setStepAssignee(stepId: string, assigneeId: string | null) {
  const step = await prisma.changeStep.findUnique({
    where: { id: stepId },
    select: { ticketId: true },
  });
  if (!step) return { ok: false as const, error: undefined };

  const { user, ticket, error } = await guard(step.ticketId);
  if (error || !ticket) return { ok: false as const, error };

  await prisma.changeStep.update({ where: { id: stepId }, data: { assigneeId } });

  // A step handed to someone is work landing on their name, which is the whole
  // point of the notification rule.
  await notify({
    userId: assigneeId,
    actorId: user.id,
    ticketId: step.ticketId,
    kind: "ASSIGNED",
  });

  revalidatePath(`/tickets/${ticket.number}`);
  return { ok: true as const };
}

export async function moveStep(stepId: string, direction: "up" | "down") {
  const step = await prisma.changeStep.findUnique({
    where: { id: stepId },
    select: { ticketId: true },
  });
  if (!step) return { ok: false as const, error: undefined };

  const { ticket, error } = await guard(step.ticketId);
  if (error || !ticket) return { ok: false as const, error };

  const all = await prisma.changeStep.findMany({
    where: { ticketId: step.ticketId },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  const index = all.findIndex((row) => row.id === stepId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= all.length) return { ok: true as const };

  // Positions are rewritten wholesale rather than swapped: two steps added in
  // the same breath can share one, and a swap would leave them sharing it.
  const reordered = [...all];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith]!, reordered[index]!];

  await prisma.$transaction(
    reordered.map((row, position) =>
      prisma.changeStep.update({ where: { id: row.id }, data: { position } }),
    ),
  );

  revalidatePath(`/tickets/${ticket.number}`);
  return { ok: true as const };
}

export async function deleteStep(stepId: string) {
  const step = await prisma.changeStep.findUnique({
    where: { id: stepId },
    select: { ticketId: true, title: true },
  });
  if (!step) return { ok: false as const, error: undefined };

  const { user, ticket, error } = await guard(step.ticketId);
  if (error || !ticket) return { ok: false as const, error };

  await prisma.$transaction([
    prisma.changeStep.delete({ where: { id: stepId } }),
    trail(step.ticketId, user.id, "STEP_REMOVED", { oldValue: step.title }),
  ]);

  revalidatePath(`/tickets/${ticket.number}`);
  return { ok: true as const };
}

/**
 * Lays a template down on a change. Appended rather than replacing: someone who
 * has already written two steps of their own does not lose them, and a plan
 * applied twice by accident is easier to prune than to retype.
 */
export async function applyPlan(ticketId: string, templateId: string) {
  const { user, ticket, error } = await guard(ticketId);
  if (error || !ticket) return { ok: false as const, error };

  const written = await copyPlanOnto(ticketId, templateId, user.id);
  if (written) revalidatePath(`/tickets/${ticket.number}`);
  return { ok: true as const };
}

/**
 * Copies a plan onto a change: phases by name, deadlines from days to dates,
 * default assignees, and the predecessors between the steps.
 *
 * Names rather than references, on purpose. Once applied the steps are the
 * ticket's own — renaming a phase in settings must not rewrite the history of a
 * change already under way.
 *
 * Exported unguarded so ticket creation can use it inside its own transaction;
 * every other caller goes through `applyPlan`.
 */
export async function copyPlanOnto(ticketId: string, templateId: string, actorId: string) {
  const t = await getMessages();
  const template = await prisma.changeTemplate.findUnique({
    where: { id: templateId },
    select: {
      name: true,
      approverId: true,
      defaultAssigneeId: true,
      phases: {
        orderBy: { position: "asc" },
        select: { id: true, name: true, approverId: true },
      },
      steps: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          phaseId: true,
          dueDays: true,
          assigneeId: true,
          teamId: true,
          estimateMinutes: true,
          blocksPhase: true,
          skipNeedsReason: true,
          dependsOnId: true,
        },
      },
    },
  });
  if (!template || template.steps.length === 0) return false;

  const phaseOrder = new Map(template.phases.map((phase, index) => [phase.id, index]));
  const phaseName = new Map(template.phases.map((phase) => [phase.id, phase.name]));

  const last = await prisma.changeStep.findFirst({
    where: { ticketId },
    orderBy: { position: "desc" },
    select: { position: true, phaseOrder: true },
  });
  const fromPosition = (last?.position ?? -1) + 1;
  // Applied onto steps that already exist, the new phases come after them.
  const fromPhase = (last?.phaseOrder ?? -1) + 1;

  const now = Date.now();
  const order = new Map(template.steps.map((step, index) => [step.id, index]));
  const inOrder = [...template.steps].sort(
    (a, b) =>
      (phaseOrder.get(a.phaseId ?? "") ?? 0) - (phaseOrder.get(b.phaseId ?? "") ?? 0) ||
      order.get(a.id)! - order.get(b.id)!,
  );

  // Who the plan has just put a question to, collected inside the transaction
  // and told afterwards: a notification written before the rows are committed
  // is one that can point at a plan that was never laid down.
  const asked: string[] = [];
  /// And who it has taken one back from, for the same reason.
  const unasked: string[] = [];

  await prisma.$transaction(async (tx) => {
    // Created one at a time so each copy's id is known, which is what lets the
    // second pass point a step at the copy of its predecessor.
    const byTemplateStep = new Map<string, string>();

    for (const [index, step] of inOrder.entries()) {
      const copy = await tx.changeStep.create({
        data: {
          ticketId,
          title: step.title,
          description: step.description,
          position: fromPosition + index,
          phase: step.phaseId ? (phaseName.get(step.phaseId) ?? null) : null,
          phaseOrder: fromPhase + (step.phaseId ? (phaseOrder.get(step.phaseId) ?? 0) : 0),
          dueAt: step.dueDays === null ? null : new Date(now + step.dueDays * 86_400_000),
          // The plan's own name first, then the plan's fallback: a step that
          // says who does it says so for a reason, and a default is only there
          // for the ones that do not.
          assigneeId: step.teamId ? null : (step.assigneeId ?? template.defaultAssigneeId),
          teamId: step.teamId,
          estimateMinutes: step.estimateMinutes,
          blocksPhase: step.blocksPhase,
          skipNeedsReason: step.skipNeedsReason,
        },
        select: { id: true },
      });
      byTemplateStep.set(step.id, copy.id);
    }

    for (const step of inOrder) {
      const predecessor = step.dependsOnId && byTemplateStep.get(step.dependsOnId);
      if (!predecessor) continue;
      await tx.changeStep.update({
        where: { id: byTemplateStep.get(step.id)! },
        data: { dependsOnId: predecessor },
      });
    }

    // The sign-offs the plan carries, opened with it rather than left for
    // somebody to remember: one for the change as a whole, one for each phase
    // that has a name on it and steps to hold up. A phase the plan did not
    // actually lay down gets none — a gate on nothing is noise.
    const worked = new Set(inOrder.map((step) => step.phaseId).filter(Boolean));
    const wanted = [
      ...(template.approverId ? [{ phase: null, approverId: template.approverId }] : []),
      ...template.phases
        .filter((phase) => phase.approverId && worked.has(phase.id))
        .map((phase) => ({ phase: phase.name, approverId: phase.approverId! })),
    ];

    // A name on a template is a name from whenever the template was written.
    // Someone who has since been deactivated, or whose role no longer lets them
    // be asked, would be a gate with nobody behind it — so the name is checked
    // against the directory here, exactly as the ask-by-hand path checks it.
    const allowed = new Set(
      (
        await tx.user.findMany({
          where: {
            id: { in: wanted.map((signOff) => signOff.approverId) },
            ...APPROVER_ROLE_FILTER,
          },
          select: { id: true },
        })
      ).map((person) => person.id),
    );

    for (const signOff of wanted) {
      if (!allowed.has(signOff.approverId)) {
        // Said out loud rather than skipped quietly: a plan that has silently
        // stopped asking for a sign-off is a plan nobody knows is weaker.
        await tx.activity.create({
          data: {
            ticketId,
            actorId,
            type: "APPROVAL_CANCELLED",
            field: "approval",
            newValue: signOff.phase,
          },
        });
        continue;
      }

      // Applying a plan onto a change that already carries one supersedes the
      // sign-offs it already had: the second application is the process being
      // run again, and the question it asked the first time is stale.
      unasked.push(...(await supersede(tx, ticketId, signOff.phase, actorId)));

      await tx.approval.create({
        data: {
          ticketId,
          phase: signOff.phase,
          // The gate as a sentence, because nobody typed one. A round that
          // shows only its own label reads as a request somebody started and
          // then abandoned; this at least says where it came from.
          question: signOff.phase
            ? t.approvals.fromPlanPhase(signOff.phase)
            : t.approvals.fromPlanChange,
          approverId: signOff.approverId,
          requestedById: actorId,
        },
      });
      await tx.activity.create({
        data: {
          ticketId,
          actorId,
          type: "APPROVAL_REQUESTED",
          field: "approval",
          newValue: signOff.phase,
        },
      });

      asked.push(signOff.approverId);
    }

    await tx.activity.create({
      data: {
        ticketId,
        actorId,
        type: "PLAN_APPLIED",
        field: "step",
        newValue: template.name,
      },
    });

    // Which plan this change was given, so the designer can say where a plan is
    // in use before somebody edits it. The trail already records the name; this
    // is the pointer back, and the last plan applied wins.
    await tx.ticket.update({ where: { id: ticketId }, data: { templateId } });
  });

  // A Set, because the same person is often the approver of the change and of
  // one of its phases — and being told twice about one plan being applied reads
  // like the plan was applied twice.
  for (const userId of new Set(asked)) {
    await notify({ userId, actorId, ticketId, kind: "APPROVAL_REQUESTED" });
  }
  for (const userId of new Set(unasked.filter((id) => !asked.includes(id)))) {
    await notify({ userId, actorId, ticketId, kind: "APPROVAL_DECIDED" });
  }
  if (asked.length > 0 || unasked.length > 0) refreshApprovals();

  return true;
}

export async function setStepDue(stepId: string, due: string) {
  const step = await prisma.changeStep.findUnique({
    where: { id: stepId },
    select: { ticketId: true },
  });
  if (!step) return { ok: false as const, error: undefined };

  const { ticket, error } = await guard(step.ticketId);
  if (error || !ticket) return { ok: false as const, error };

  await prisma.changeStep.update({
    where: { id: stepId },
    data: { dueAt: due ? new Date(`${due}T17:00:00`) : null },
  });

  revalidatePath(`/tickets/${ticket.number}`);
  return { ok: true as const };
}

/** A step may only wait for one that comes before it, which is what makes a
 *  cycle unrepresentable rather than merely unlikely. */
export async function setStepDependency(stepId: string, dependsOnId: string | null) {
  const step = await prisma.changeStep.findUnique({
    where: { id: stepId },
    select: { ticketId: true, position: true, phaseOrder: true },
  });
  if (!step) return { ok: false as const, error: undefined };

  const { t, ticket, error } = await guard(step.ticketId);
  if (error || !ticket) return { ok: false as const, error };

  if (dependsOnId) {
    const target = await prisma.changeStep.findUnique({
      where: { id: dependsOnId },
      select: { ticketId: true, position: true, phaseOrder: true },
    });
    const earlier =
      target &&
      target.ticketId === step.ticketId &&
      (target.phaseOrder < step.phaseOrder ||
        (target.phaseOrder === step.phaseOrder && target.position < step.position));

    if (!earlier) return { ok: false as const, error: t.errors.stepOrderOnly };
  }

  await prisma.changeStep.update({ where: { id: stepId }, data: { dependsOnId } });

  revalidatePath(`/tickets/${ticket.number}`);
  return { ok: true as const };
}
