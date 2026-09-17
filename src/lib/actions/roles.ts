"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PERMISSION_KEYS, can } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { fieldErrors, roleSchema } from "@/lib/validation";
import type { FormState } from "@/lib/actions/auth";

async function allowed() {
  const user = await requireUser();
  return can(user, "settings.roles");
}

function refresh() {
  // A permission change alters what every page renders for the people holding
  // that role, so nothing narrower than the whole tree will do.
  revalidatePath("/", "layout");
}

/** Unknown keys are dropped rather than rejected: a role saved before a
 *  permission was renamed should not become unsavable. */
function knownPermissions(values: string[]) {
  return values.filter((value) => (PERMISSION_KEYS as readonly string[]).includes(value));
}

export async function createRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getMessages();
  if (!(await allowed())) return { errors: { form: t.errors.noRoles } };

  const parsed = roleSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error, t) };

  const taken = await prisma.role.findUnique({
    where: { name: parsed.data.name },
    select: { id: true },
  });
  if (taken) return { errors: { name: t.errors.roleNamed } };

  const last = await prisma.role.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.role.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      permissions: knownPermissions(formData.getAll("permissions").map(String)),
      position: (last?.position ?? 0) + 1,
    },
  });

  refresh();
  return {};
}

export async function updateRole(roleId: string, permissions: string[]) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noRoles };

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { isMaster: true },
  });
  if (!role) return { ok: false as const, error: t.errors.roleGone };
  if (role.isMaster) {
    return { ok: false as const, error: t.errors.masterLocked };
  }

  await prisma.role.update({
    where: { id: roleId },
    data: { permissions: knownPermissions(permissions) },
  });

  refresh();
  return { ok: true as const };
}

export async function renameRole(roleId: string, name: string, description: string) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noRoles };

  const parsed = roleSchema.safeParse({ name, description });
  if (!parsed.success) return { ok: false as const, error: t.errors.invalidName };

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { isMaster: true },
  });
  if (!role) return { ok: false as const, error: t.errors.roleGone };
  if (role.isMaster) return { ok: false as const, error: t.errors.masterLocked };

  const clash = await prisma.role.findFirst({
    where: { name: parsed.data.name, id: { not: roleId } },
    select: { id: true },
  });
  if (clash) return { ok: false as const, error: t.errors.otherRoleNamed };

  await prisma.role.update({ where: { id: roleId }, data: parsed.data });
  refresh();
  return { ok: true as const };
}

/** Where new accounts land. Exactly one role holds it, so setting it moves it. */
export async function setDefaultRole(roleId: string) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noRoles };

  await prisma.$transaction([
    prisma.role.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
    prisma.role.update({ where: { id: roleId }, data: { isDefault: true } }),
  ]);

  refresh();
  return { ok: true as const };
}

/**
 * A role with people in it is not deleted: every one of them would need
 * somewhere to go, and picking that somewhere silently is exactly the kind of
 * decision an app should not make on an admin's behalf.
 */
export async function deleteRole(roleId: string) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noRoles };

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { isMaster: true, isDefault: true, _count: { select: { users: true } } },
  });
  if (!role) return { ok: false as const, error: t.errors.roleGone };
  if (role.isMaster) return { ok: false as const, error: t.errors.masterUndeletable };
  if (role.isDefault) {
    return { ok: false as const, error: t.errors.defaultRoleFirst };
  }
  if (role._count.users > 0) {
    return {
      ok: false as const,
      error: t.errors.roleInUse(role._count.users),
    };
  }

  await prisma.role.delete({ where: { id: roleId } });
  refresh();
  return { ok: true as const };
}
