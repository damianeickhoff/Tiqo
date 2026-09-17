"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { fieldErrors, teamSchema } from "@/lib/validation";
import type { FormState } from "@/lib/actions/auth";

async function allowed() {
  const user = await requireUser();
  return can(user, "team.manage");
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function createTeam(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getMessages();
  if (!(await allowed())) return { errors: { form: t.errors.noTeams } };

  const parsed = teamSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    color: formData.get("color") || "#febe2e",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error, t) };

  const taken = await prisma.team.findUnique({
    where: { name: parsed.data.name },
    select: { id: true },
  });
  if (taken) return { errors: { name: t.errors.teamNamed } };

  const last = await prisma.team.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.team.create({ data: { ...parsed.data, position: (last?.position ?? 0) + 1 } });
  refresh();
  return {};
}

export async function updateTeam(
  teamId: string,
  values: { name: string; description: string; color: string },
) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noTeams };

  const parsed = teamSchema.safeParse(values);
  if (!parsed.success) return { ok: false as const, error: t.errors.invalidTeam };

  const clash = await prisma.team.findFirst({
    where: { name: parsed.data.name, id: { not: teamId } },
    select: { id: true },
  });
  if (clash) return { ok: false as const, error: t.errors.otherTeamNamed };

  await prisma.team.update({ where: { id: teamId }, data: parsed.data });
  refresh();
  return { ok: true as const };
}

/**
 * Deleting a team leaves its tickets without one rather than refusing: unlike a
 * role, a team is a routing label, and work with nowhere to be is a state the
 * queue already knows how to show.
 */
export async function deleteTeam(teamId: string) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noTeams };

  await prisma.team.delete({ where: { id: teamId } });
  refresh();
  return { ok: true as const };
}

export async function setTeamMember(teamId: string, userId: string, member: boolean) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noTeams };

  await prisma.team.update({
    where: { id: teamId },
    data: { members: member ? { connect: { id: userId } } : { disconnect: { id: userId } } },
  });

  refresh();
  return { ok: true as const };
}
