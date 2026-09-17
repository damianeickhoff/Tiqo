"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can, canManageProjects, isStaff } from "@/lib/permissions";
import { findBlockedWord, getMessages } from "@/lib/settings";
import { recordReferences } from "@/lib/record-references";
import { linkBareReferences } from "@/lib/link-references";
import type { FormState } from "@/lib/actions/auth";
import type { ProjectHealth } from "@/generated/prisma/enums";

/**
 * Everything that shapes a project: what it is, how it is going, who is on it,
 * and the dated points it is working towards.
 *
 * All of it answers to `project.manage`. Filing a ticket into a project is a
 * ticket action and lives with the other ticket actions — this file is about
 * the project itself.
 */
async function guard() {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  return { user, t, ok: canManageProjects(user) };
}

function refresh(key?: string) {
  revalidatePath("/projects");
  if (key) revalidatePath(`/projects/${key}`, "layout");
  revalidatePath("/", "layout");
}

type Written = { ok: true } | { ok: false; error: string };

/* ------------------------------------------------------------- the project -- */

export async function updateProject(
  projectId: string,
  patch: {
    name?: string;
    description?: string;
    color?: string;
    health?: ProjectHealth;
    startsOn?: string | null;
    dueOn?: string | null;
    teamId?: string | null;
    leadId?: string | null;
  },
): Promise<Written> {
  const { t, ok } = await guard();
  if (!ok) return { ok: false, error: t.errors.noProjects };

  const name = patch.name?.trim().slice(0, 80);
  if (patch.name !== undefined && !name) return { ok: false, error: t.errors.nameProject };

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(name === undefined ? {} : { name }),
      ...(patch.description === undefined
        ? {}
        : { description: patch.description.trim().slice(0, 2000) || null }),
      ...(patch.color === undefined ? {} : { color: patch.color }),
      ...(patch.health === undefined ? {} : { health: patch.health }),
      ...(patch.startsOn === undefined
        ? {}
        : { startsOn: patch.startsOn ? new Date(patch.startsOn) : null }),
      ...(patch.dueOn === undefined ? {} : { dueOn: patch.dueOn ? new Date(patch.dueOn) : null }),
      ...(patch.teamId === undefined ? {} : { teamId: patch.teamId }),
      ...(patch.leadId === undefined ? {} : { leadId: patch.leadId }),
    },
    select: { key: true },
  });

  refresh(project.key);
  return { ok: true };
}

/** On or off the project. The lead is set separately; this is the roster. */
export async function setProjectMember(
  projectId: string,
  userId: string,
  member: boolean,
): Promise<Written> {
  const { t, ok } = await guard();
  if (!ok) return { ok: false, error: t.errors.noProjects };

  const project = await prisma.project.update({
    where: { id: projectId },
    data: { members: member ? { connect: { id: userId } } : { disconnect: { id: userId } } },
    select: { key: true },
  });

  refresh(project.key);
  return { ok: true };
}

/* ----------------------------------------------------------- the milestones -- */

export async function addMilestone(projectId: string, title: string): Promise<Written> {
  const { t, ok } = await guard();
  if (!ok) return { ok: false, error: t.errors.noProjects };

  const clean = title.trim().slice(0, 120);
  if (!clean) return { ok: false, error: t.errors.nameMilestone };

  const last = await prisma.milestone.findFirst({
    where: { projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { key: true },
  });

  await prisma.milestone.create({
    data: { projectId, title: clean, position: (last?.position ?? -1) + 1 },
  });

  refresh(project?.key);
  return { ok: true };
}

export async function updateMilestone(
  milestoneId: string,
  patch: { title?: string; description?: string; dueOn?: string | null; reached?: boolean },
): Promise<Written> {
  const { t, ok } = await guard();
  if (!ok) return { ok: false, error: t.errors.noProjects };

  const title = patch.title?.trim().slice(0, 120);
  if (patch.title !== undefined && !title) return { ok: false, error: t.errors.nameMilestone };

  const milestone = await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      ...(title === undefined ? {} : { title }),
      ...(patch.description === undefined
        ? {}
        : { description: patch.description.trim().slice(0, 600) || null }),
      ...(patch.dueOn === undefined ? {} : { dueOn: patch.dueOn ? new Date(patch.dueOn) : null }),
      // Reaching one is a declaration, so it carries the moment it was made.
      ...(patch.reached === undefined ? {} : { reachedAt: patch.reached ? new Date() : null }),
    },
    select: { project: { select: { key: true } } },
  });

  refresh(milestone.project.key);
  return { ok: true };
}

export async function deleteMilestone(milestoneId: string): Promise<Written> {
  const { t, ok } = await guard();
  if (!ok) return { ok: false, error: t.errors.noProjects };

  // The tickets filed against it stay; they simply stop being filed against
  // anything. Deleting a date should never delete work.
  const milestone = await prisma.milestone.delete({
    where: { id: milestoneId },
    select: { project: { select: { key: true } } },
  });

  refresh(milestone.project.key);
  return { ok: true };
}

export async function moveMilestone(
  milestoneId: string,
  direction: "up" | "down",
): Promise<Written> {
  const { t, ok } = await guard();
  if (!ok) return { ok: false, error: t.errors.noProjects };

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: { projectId: true, project: { select: { key: true } } },
  });
  if (!milestone) return { ok: false, error: t.errors.generic };

  const all = await prisma.milestone.findMany({
    where: { projectId: milestone.projectId },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  const index = all.findIndex((row) => row.id === milestoneId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= all.length) return { ok: true };

  const reordered = [...all];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith]!, reordered[index]!];

  await prisma.$transaction(
    reordered.map((row, position) =>
      prisma.milestone.update({ where: { id: row.id }, data: { position } }),
    ),
  );

  refresh(milestone.project.key);
  return { ok: true };
}

/** Filing a ticket against a dated point, or taking it off one. */
export async function setTicketMilestone(
  ticketId: string,
  milestoneId: string | null,
): Promise<Written> {
  const { t, ok } = await guard();
  if (!ok) return { ok: false, error: t.errors.noProjects };

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { milestoneId },
    select: { number: true, project: { select: { key: true } } },
  });

  revalidatePath(`/tickets/${ticket.number}`);
  refresh(ticket.project?.key);
  return { ok: true };
}

/* -------------------------------------------------------- the conversation -- */

export async function addProjectComment(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!isStaff(user)) return { errors: { form: t.errors.noProjects } };

  const written = String(formData.get("body") ?? "").trim();
  if (!written) return { errors: { body: t.errors.writeSomething } };
  if (await findBlockedWord(written)) return { errors: { body: t.errors.blocked } };

  const body = await linkBareReferences(written);

  await prisma.projectComment.create({
    data: { projectId, authorId: user.id, body: body.slice(0, 10_000) },
  });

  await recordReferences({ body, actorId: user.id, projectId });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { key: true },
  });
  refresh(project?.key);
  return {};
}

export async function deleteProjectComment(commentId: string): Promise<Written> {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const comment = await prisma.projectComment.findUnique({
    where: { id: commentId },
    select: { authorId: true, project: { select: { key: true } } },
  });
  if (!comment) return { ok: false, error: t.errors.generic };

  // Your own, or anyone's with the permission that moderates conversations.
  if (comment.authorId !== user.id && !can(user, "comment.moderate")) {
    return { ok: false, error: t.errors.noComment };
  }

  await prisma.projectComment.delete({ where: { id: commentId } });
  refresh(comment.project.key);
  return { ok: true };
}

/* --------------------------------------------------------------- deleting -- */

/**
 * Removing the project, not the work in it.
 *
 * Every ticket filed against it survives and simply stops belonging anywhere —
 * which is why archiving exists and should almost always be the answer instead.
 * The count is returned so the caller can say what happened.
 */
/**
 * Keep an eye on a project, or stop.
 *
 * A list-level command, so it lands the moment it is clicked: starring is not
 * a description of the project, it is a note to yourself about it.
 */
export async function toggleProjectStar(projectId: string): Promise<Written> {
  const user = await requireUser();

  const key = { userId_projectId: { userId: user.id, projectId } };
  const existing = await prisma.projectStar.findUnique({ where: key, select: { projectId: true } });

  if (existing) await prisma.projectStar.delete({ where: key });
  else await prisma.projectStar.create({ data: { userId: user.id, projectId } });

  revalidatePath("/projects", "layout");
  return { ok: true };
}

export async function deleteProject(projectId: string): Promise<Written> {
  const { t, ok } = await guard();
  if (!ok) return { ok: false, error: t.errors.noProjects };

  // One transaction, because these two only make sense together. Detaching the
  // work and then failing to delete the project leaves every ticket filed
  // against nothing while the project it belonged to is still there — a
  // half-done delete that looks like nothing happened.
  await prisma.$transaction([
    prisma.ticket.updateMany({
      where: { projectId },
      data: { projectId: null, milestoneId: null },
    }),
    prisma.project.delete({ where: { id: projectId }, select: { id: true } }),
  ]);

  refresh();
  return { ok: true };
}
