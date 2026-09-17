"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { APPROVER_ROLE_FILTER, can } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import type { Messages } from "@/lib/i18n";
import { fieldErrors, changeTemplateSchema } from "@/lib/validation";
import type { FormState } from "@/lib/actions/auth";

/** Plans are ticket configuration, so they answer to the same permission as
 *  ticket defaults and response targets rather than needing one of their own. */
async function allowed() {
  const user = await requireUser();
  return can(user, "settings.tickets");
}

function refresh() {
  // The list and the designer under it: "layout" so `/settings/plans/<id>`
  // hears about a step somebody has just added to the plan it is showing.
  revalidatePath("/settings/plans", "layout");
  revalidatePath("/tickets", "layout");
}

export async function createTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getMessages();
  if (!(await allowed())) return { errors: { form: t.errors.noSettings } };

  const parsed = changeTemplateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error, t) };

  const taken = await prisma.changeTemplate.findUnique({
    where: { name: parsed.data.name },
    select: { id: true },
  });
  if (taken) return { errors: { name: t.errors.planNamed } };

  const last = await prisma.changeTemplate.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.changeTemplate.create({
    data: { ...parsed.data, position: (last?.position ?? 0) + 1 },
  });

  refresh();
  return {};
}

/**
 * What the plan is called, what it covers, who signs it off and who its steps
 * go to when nobody is named — one decision about one plan, so one action
 * behind one Save. They were three writes before the details became a draft,
 * and a fourth field would have made it four.
 */
export async function updateTemplate(
  templateId: string,
  values: {
    name: string;
    description: string;
    approverId: string | null;
    defaultAssigneeId: string | null;
  },
) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const parsed = changeTemplateSchema.safeParse({
    name: values.name,
    description: values.description,
  });
  if (!parsed.success) return { ok: false as const, error: t.errors.invalidName };

  const clash = await prisma.changeTemplate.findFirst({
    where: { name: parsed.data.name, id: { not: templateId } },
    select: { id: true },
  });
  if (clash) return { ok: false as const, error: t.errors.planNamed };

  const approver = await approverOrProblem(values.approverId, t);
  if (approver.error) return { ok: false as const, error: approver.error };

  await prisma.changeTemplate.update({
    where: { id: templateId },
    data: {
      ...parsed.data,
      approverId: approver.id,
      defaultAssigneeId: values.defaultAssigneeId,
    },
  });

  refresh();
  return { ok: true as const };
}

/**
 * A copy to edit, so a plan that is nearly right for something else does not
 * have to be retyped. Phases and steps come with it, including what each step
 * waits for — pointed at the copies, or the second plan would hold gates on the
 * first one's steps.
 */
export async function duplicateTemplate(templateId: string) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const source = await prisma.changeTemplate.findUnique({
    where: { id: templateId },
    include: {
      phases: { orderBy: { position: "asc" } },
      steps: { orderBy: { position: "asc" } },
    },
  });
  if (!source) return { ok: false as const, error: t.errors.generic };

  // Free after the second try, rather than refusing: duplicating twice is
  // something people do, and a refusal at that point is a dead end.
  const taken = new Set(
    (
      await prisma.changeTemplate.findMany({
        where: { name: { startsWith: source.name } },
        select: { name: true },
      })
    ).map((row) => row.name),
  );
  let name = t.plan.copyOf(source.name);
  for (let attempt = 2; taken.has(name); attempt += 1)
    name = `${t.plan.copyOf(source.name)} ${attempt}`;

  const copy = await prisma.$transaction(async (tx) => {
    const made = await tx.changeTemplate.create({
      data: {
        name,
        description: source.description,
        approverId: source.approverId,
        defaultAssigneeId: source.defaultAssigneeId,
        position: source.position + 1,
      },
      select: { id: true },
    });

    const phases = new Map<string, string>();
    for (const phase of source.phases) {
      const row = await tx.changeTemplatePhase.create({
        data: {
          templateId: made.id,
          name: phase.name,
          position: phase.position,
          approverId: phase.approverId,
        },
        select: { id: true },
      });
      phases.set(phase.id, row.id);
    }

    const steps = new Map<string, string>();
    for (const step of source.steps) {
      const row = await tx.changeTemplateStep.create({
        data: {
          templateId: made.id,
          phaseId: step.phaseId ? (phases.get(step.phaseId) ?? null) : null,
          title: step.title,
          description: step.description,
          position: step.position,
          dueDays: step.dueDays,
          assigneeId: step.assigneeId,
          teamId: step.teamId,
          estimateMinutes: step.estimateMinutes,
          blocksPhase: step.blocksPhase,
          skipNeedsReason: step.skipNeedsReason,
        },
        select: { id: true },
      });
      steps.set(step.id, row.id);
    }

    for (const step of source.steps) {
      const after = step.dependsOnId && steps.get(step.dependsOnId);
      if (!after) continue;
      await tx.changeTemplateStep.update({
        where: { id: steps.get(step.id)! },
        data: { dependsOnId: after },
      });
    }

    return made;
  });

  refresh();
  return { ok: true as const, id: copy.id };
}

/** Deleting a plan leaves every change that used it alone: the steps were
 *  copied onto the ticket, so they are the ticket's own from that moment. */
export async function deleteTemplate(templateId: string) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  await prisma.changeTemplate.delete({ where: { id: templateId } });
  refresh();
  return { ok: true as const };
}

export async function addTemplateStep(templateId: string, rawTitle: string, phaseId?: string) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const title = rawTitle.trim().slice(0, 160);
  if (!title) return { ok: false as const, error: t.errors.nameStep };

  // A step joins the end of its own phase, not the end of the plan: positions
  // run through the phases in order, and a step appended past the last one
  // would read as belonging to whichever phase comes after it.
  const last = await prisma.changeTemplateStep.findFirst({
    where: { templateId, phaseId: phaseId || null },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const after =
    last?.position ??
    (
      await prisma.changeTemplateStep.findFirst({
        where: { templateId },
        orderBy: { position: "desc" },
        select: { position: true },
      })
    )?.position ??
    -1;

  const made = await prisma.$transaction(async (tx) => {
    await tx.changeTemplateStep.updateMany({
      where: { templateId, position: { gt: after } },
      data: { position: { increment: 1 } },
    });
    return tx.changeTemplateStep.create({
      data: { templateId, title, phaseId: phaseId || null, position: after + 1 },
      select: { id: true },
    });
  });

  refresh();
  return { ok: true as const, id: made.id };
}

/**
 * The order of the whole plan, as the table now shows it.
 *
 * Sent whole rather than as "move this one there": a drag can cross a phase
 * boundary, which changes two things about a step at once, and rewriting every
 * position is both cheaper to reason about and the only way to be sure the
 * numbers still run in reading order afterwards.
 */
export async function reorderTemplateSteps(
  templateId: string,
  rows: { id: string; phaseId: string | null }[],
) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const known = await prisma.changeTemplateStep.findMany({
    where: { templateId },
    select: { id: true },
  });
  const ids = new Set(known.map((row) => row.id));
  if (known.length !== rows.length || rows.some((row) => !ids.has(row.id))) {
    return { ok: false as const, error: t.errors.stepGone };
  }

  await prisma.$transaction(
    rows.map((row, position) =>
      prisma.changeTemplateStep.update({
        where: { id: row.id },
        data: { position, phaseId: row.phaseId },
      }),
    ),
  );

  // A step may only wait for one that comes before it. A drag that moves a step
  // in front of what it was waiting for clears the gate rather than refusing
  // the drag: the order on screen is what was meant, the gate was incidental.
  const moved = await prisma.changeTemplateStep.findMany({
    where: { templateId, dependsOnId: { not: null } },
    select: { id: true, position: true, dependsOnId: true },
  });
  const at = new Map(rows.map((row, position) => [row.id, position]));
  const stale = moved.filter((row) => (at.get(row.dependsOnId!) ?? -1) >= row.position);
  if (stale.length > 0) {
    await prisma.changeTemplateStep.updateMany({
      where: { id: { in: stale.map((row) => row.id) } },
      data: { dependsOnId: null },
    });
  }

  refresh();
  return { ok: true as const };
}

/** Everything a step says about itself: what it involves, who does it, what it
 *  waits for, how long it takes and how the plan treats it. One action, because
 *  the inspector is one draft and a round trip per field would be eight. */
export async function updateTemplateStep(
  stepId: string,
  patch: {
    title?: string;
    description?: string;
    dueDays?: number | null;
    assigneeId?: string | null;
    teamId?: string | null;
    estimateMinutes?: number | null;
    blocksPhase?: boolean;
    skipNeedsReason?: boolean;
    dependsOnId?: string | null;
    phaseId?: string | null;
  },
) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const step = await prisma.changeTemplateStep.findUnique({
    where: { id: stepId },
    select: { templateId: true, position: true },
  });
  if (!step) return { ok: false as const, error: t.errors.stepGone };

  if (patch.dependsOnId) {
    const target = await prisma.changeTemplateStep.findUnique({
      where: { id: patch.dependsOnId },
      select: { templateId: true, position: true },
    });
    // Only backwards, which is what makes a cycle unrepresentable.
    if (!target || target.templateId !== step.templateId || target.position >= step.position) {
      return { ok: false as const, error: t.errors.stepOrderOnly };
    }
  }

  const title = patch.title?.trim().slice(0, 160);
  if (patch.title !== undefined && !title) return { ok: false as const, error: t.errors.nameStep };

  await prisma.changeTemplateStep.update({
    where: { id: stepId },
    data: {
      ...(title === undefined ? {} : { title }),
      ...(patch.description === undefined
        ? {}
        : { description: patch.description.trim().slice(0, 4000) || null }),
      ...(patch.dueDays === undefined ? {} : { dueDays: patch.dueDays }),
      // Who does it is one answer, so the two columns are written together: a
      // step owned by a person and by a group is two people each waiting for
      // the other.
      ...(patch.assigneeId === undefined ? {} : { assigneeId: patch.assigneeId }),
      ...(patch.teamId === undefined ? {} : { teamId: patch.assigneeId ? null : patch.teamId }),
      ...(patch.estimateMinutes === undefined ? {} : { estimateMinutes: patch.estimateMinutes }),
      ...(patch.blocksPhase === undefined ? {} : { blocksPhase: patch.blocksPhase }),
      ...(patch.skipNeedsReason === undefined ? {} : { skipNeedsReason: patch.skipNeedsReason }),
      ...(patch.dependsOnId === undefined ? {} : { dependsOnId: patch.dependsOnId }),
      ...(patch.phaseId === undefined ? {} : { phaseId: patch.phaseId }),
    },
  });

  refresh();
  return { ok: true as const };
}

/* ------------------------------------------------------------------ phases -- */

/**
 * Who signs this plan off, standing.
 *
 * Two of them, because a change can need one name on the whole thing and a
 * different one on the phase that actually touches production. Null clears it.
 *
 * The name is checked against `approval.give` here and not only in the picker:
 * a plan is written once and applied for years, and a default that quietly
 * stopped being askable would produce a gate with nobody behind it every time.
 */
async function approverOrProblem(
  userId: string | null,
  t: Messages,
): Promise<{ id: string | null; error?: string }> {
  if (!userId) return { id: null };

  const person = await prisma.user.findFirst({
    where: { id: userId, ...APPROVER_ROLE_FILTER },
    select: { id: true },
  });
  return person ? { id: person.id } : { id: null, error: t.errors.approverNotAllowed };
}

/** What a phase is called and who signs it off — the gate is what a phase is
 *  for, so the two are one draft and one write. */
export async function updatePhase(
  phaseId: string,
  values: { name: string; approverId: string | null },
) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const name = values.name.trim().slice(0, 60);
  if (!name) return { ok: false as const, error: t.errors.namePhase };

  const approver = await approverOrProblem(values.approverId, t);
  if (approver.error) return { ok: false as const, error: approver.error };

  await prisma.changeTemplatePhase.update({
    where: { id: phaseId },
    data: { name, approverId: approver.id },
  });

  refresh();
  return { ok: true as const };
}

export async function addPhase(templateId: string, rawName: string) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const name = rawName.trim().slice(0, 60);
  if (!name) return { ok: false as const, error: t.errors.namePhase };

  const last = await prisma.changeTemplatePhase.findFirst({
    where: { templateId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const made = await prisma.changeTemplatePhase.create({
    data: { templateId, name, position: (last?.position ?? -1) + 1 },
    select: { id: true },
  });

  refresh();
  return { ok: true as const, id: made.id };
}

/** Deleting a phase keeps its steps: they fall out of the phase rather than out
 *  of the plan, which is almost always what was meant. */
export async function deletePhase(phaseId: string) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  await prisma.changeTemplatePhase.delete({ where: { id: phaseId } });
  refresh();
  return { ok: true as const };
}

export async function movePhase(phaseId: string, direction: "up" | "down") {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const phase = await prisma.changeTemplatePhase.findUnique({
    where: { id: phaseId },
    select: { templateId: true },
  });
  if (!phase) return { ok: true as const };

  const all = await prisma.changeTemplatePhase.findMany({
    where: { templateId: phase.templateId },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  const index = all.findIndex((row) => row.id === phaseId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= all.length) return { ok: true as const };

  const reordered = [...all];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith]!, reordered[index]!];

  await prisma.$transaction(
    reordered.map((row, position) =>
      prisma.changeTemplatePhase.update({ where: { id: row.id }, data: { position } }),
    ),
  );

  refresh();
  return { ok: true as const };
}

export async function deleteTemplateStep(stepId: string) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  await prisma.changeTemplateStep.delete({ where: { id: stepId } });
  refresh();
  return { ok: true as const };
}

/**
 * A step one place up or down — the keyboard's version of the drag.
 *
 * Crossing a phase boundary moves the step into that phase rather than jumping
 * over it: the boundary is the only thing between the two rows, so stepping
 * onto it is the move somebody meant.
 */
export async function moveTemplateStep(stepId: string, direction: "up" | "down") {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const step = await prisma.changeTemplateStep.findUnique({
    where: { id: stepId },
    select: { templateId: true, phaseId: true },
  });
  if (!step) return { ok: true as const };

  const all = await prisma.changeTemplateStep.findMany({
    where: { templateId: step.templateId },
    orderBy: { position: "asc" },
    select: { id: true, phaseId: true },
  });

  const index = all.findIndex((row) => row.id === stepId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= all.length) return { ok: true as const };

  const neighbour = all[swapWith]!;
  const rows =
    neighbour.phaseId === step.phaseId
      ? (() => {
          const next = [...all];
          [next[index], next[swapWith]] = [next[swapWith]!, next[index]!];
          return next;
        })()
      : all.map((row) => (row.id === stepId ? { ...row, phaseId: neighbour.phaseId } : row));

  return reorderTemplateSteps(
    step.templateId,
    rows.map((row) => ({ id: row.id, phaseId: row.phaseId })),
  );
}
