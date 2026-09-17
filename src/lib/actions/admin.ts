"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  canChangeRole,
  canCreatePeople,
  canDeactivate,
  canManageProjects,
  profileAccess,
} from "@/lib/permissions";
import {
  contactSchema,
  fieldErrors,
  labelSchema,
  newUserSchema,
  profileSchema,
  projectSchema,
} from "@/lib/validation";
import { displayName, uniqueUsername } from "@/lib/accounts";
import { hashPassword } from "@/lib/auth";
import { getMessages } from "@/lib/settings";
import { CONTENT_LOCALES } from "@/lib/i18n";
import { AVATAR_COUNT } from "@/components/avatar";
import type { FormState } from "@/lib/actions/auth";

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canManageProjects(user)) return { errors: { form: t.errors.noProjects } };

  const parsed = projectSchema.safeParse({
    key: formData.get("key"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    color: formData.get("color") || "#6366f1",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error, t) };

  const taken = await prisma.project.findUnique({
    where: { key: parsed.data.key },
    select: { id: true },
  });
  if (taken) return { errors: { key: t.errors.keyTaken(parsed.data.key) } };

  await prisma.project.create({ data: parsed.data });
  revalidatePath("/projects");
  return {};
}

export async function setProjectArchived(projectId: string, isArchived: boolean) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canManageProjects(user)) return { ok: false as const, error: t.errors.noProjectChange };

  await prisma.project.update({ where: { id: projectId }, data: { isArchived } });
  revalidatePath("/projects");
  return { ok: true as const };
}

export async function createLabel(_prev: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canManageProjects(user)) return { errors: { form: t.errors.noLabels } };

  const parsed = labelSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || "#febe2e",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error, t) };

  const exists = await prisma.label.findUnique({
    where: { name: parsed.data.name },
    select: { id: true },
  });
  if (exists) return { errors: { name: t.errors.tagExists } };

  await prisma.label.create({ data: parsed.data });
  revalidatePath("/tickets");
  return {};
}

export async function deleteLabel(labelId: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canManageProjects(user)) return { ok: false as const, error: t.errors.noProjectChange };

  await prisma.label.delete({ where: { id: labelId } });
  revalidatePath("/projects");
  return { ok: true as const };
}

/** Anyone may change their own face; nobody may change someone else's. */
export async function setAvatarVariant(variant: number) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);
  if (!Number.isInteger(variant) || variant < 0 || variant >= AVATAR_COUNT) {
    return { ok: false as const, error: t.errors.notAnAvatar };
  }

  await prisma.user.update({ where: { id: user.id }, data: { avatarVariant: variant } });

  // Faces appear all over the app, so nothing narrower than the whole tree
  // would refresh them.
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Adds an account. Operators do the adding in practice — someone phones the
 * desk and has to exist before their ticket can — so it is its own permission
 * rather than an admin's alone. Handing out the master role is not: that stays
 * with the masters, the same rule that governs every other write against one.
 */
export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const [actor, t] = await Promise.all([requireUser(), getMessages()]);
  if (!canCreatePeople(actor)) return { errors: { form: t.errors.noAccounts } };

  const parsed = newUserSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    company: formData.get("company"),
    department: formData.get("department"),
    jobTitle: formData.get("jobTitle"),
    roleId: formData.get("roleId"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error, t) };

  const { password, roleId, ...profile } = parsed.data;

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, isMaster: true },
  });
  if (!role) return { errors: { roleId: t.errors.pickRole } };
  if (role.isMaster && !actor.isMaster) {
    return { errors: { roleId: t.errors.notMaster } };
  }

  const taken = await prisma.user.findUnique({
    where: { email: profile.email },
    select: { id: true },
  });
  if (taken) return { errors: { email: t.errors.emailTaken } };

  await prisma.user.create({
    data: {
      ...profile,
      roleId,
      name: displayName(profile.firstName, profile.lastName),
      username: await uniqueUsername(profile.email),
      passwordHash: await hashPassword(password),
    },
  });

  revalidatePath("/people");
  return {};
}

/**
 * Saves someone's profile. The viewer's access decides which half of the form
 * is even read: an operator maintaining a colleague sends everything, a person
 * editing themselves sends their contact details and nothing else — so a
 * hand-made request cannot smuggle a name or a handle past the form.
 */
export async function updateProfile(
  userId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const [actor, t] = await Promise.all([requireUser(), getMessages()]);

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: { select: { isMaster: true } } },
  });
  if (!target) return { errors: { form: t.errors.accountGone } };

  const access = profileAccess(actor, { id: target.id, isMaster: target.role.isMaster });
  if (access === "none") {
    return { errors: { form: t.errors.noProfile } };
  }

  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    username: formData.get("username"),
    phone: formData.get("phone"),
    company: formData.get("company"),
    department: formData.get("department"),
    jobTitle: formData.get("jobTitle"),
  };

  if (access === "contact") {
    const parsed = contactSchema.safeParse(raw);
    if (!parsed.success) return { errors: fieldErrors(parsed.error, t) };

    if (await emailTaken(userId, parsed.data.email)) {
      return { errors: { email: t.errors.otherEmailTaken } };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { ...parsed.data, locale: readLocale(formData) },
    });
    revalidatePath("/", "layout");
    return {};
  }

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error, t) };
  const profile = parsed.data;

  const clash = await prisma.user.findFirst({
    where: {
      id: { not: userId },
      OR: [{ email: profile.email }, { username: profile.username }],
    },
    select: { email: true },
  });
  if (clash) {
    return clash.email === profile.email
      ? { errors: { email: t.errors.otherEmailTaken } }
      : { errors: { username: t.errors.usernameTaken } };
  }

  await prisma.user.update({
    where: { id: userId },
    // The display name is stored rather than derived on read, so it has to be
    // rewritten whenever either half of it moves.
    data: {
      ...profile,
      ...workingHours(formData),
      locale: readLocale(formData),
      name: displayName(profile.firstName, profile.lastName),
    },
  });

  // A name or an avatar shows up all over the app, so nothing narrower than the
  // whole tree would refresh it.
  revalidatePath("/", "layout");
  return {};
}

/**
 * Which language this person reads the portal in.
 *
 * Nothing means "whatever the desk is set to", which is what almost everyone
 * gets and what nobody has to choose. Anything the instance does not offer is
 * treated as nothing rather than stored — an unknown code would simply never
 * match a translation.
 */
function readLocale(formData: FormData) {
  const value = String(formData.get("locale") ?? "");
  return CONTENT_LOCALES.some((option) => option.code === value) ? value : null;
}

/**
 * When this person is at work, out of the form.
 *
 * Read straight from the fields rather than through the profile schema: the
 * schema is shared with account creation, where nobody is asked this, and three
 * numbers with obvious bounds do not need a validator of their own. No days
 * ticked means "I have not said", and the desk own hours stand in.
 */
function workingHours(formData: FormData) {
  const minute = (name: string, fallback: number) => {
    const value = Number(formData.get(name));
    return Number.isSafeInteger(value) && value >= 0 && value < 24 * 60 ? value : fallback;
  };
  return {
    workDays: [
      ...new Set(
        formData
          .getAll("workDays")
          .map(Number)
          .filter((day) => Number.isSafeInteger(day) && day >= 1 && day <= 7),
      ),
    ].sort((a, b) => a - b),
    workStart: minute("workStart", 540),
    workEnd: minute("workEnd", 1020),
  };
}

async function emailTaken(userId: string, email: string) {
  const clash = await prisma.user.findFirst({
    where: { id: { not: userId }, email },
    select: { id: true },
  });
  return clash !== null;
}

/**
 * The three things you can do to somebody else's account, all governed by the
 * same shape: you need the permission, the target is not you, and a master
 * admin is only touched by another master admin.
 *
 * Doing it to yourself is refused rather than guarded case by case. It is the
 * rule that stops the last admin demoting themselves and locking the instance,
 * and "you cannot change your own role" is a sentence people accept, where
 * "promote another admin first" is one they have to think about.
 */
async function loadTarget(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: { select: { isMaster: true } } },
  });
}

export async function setUserRole(userId: string, roleId: string) {
  const [actor, t] = await Promise.all([requireUser(), getMessages()]);
  const target = await loadTarget(userId);
  if (!target) return { ok: false as const, error: t.errors.accountGone };

  if (!canChangeRole(actor, { id: target.id, isMaster: target.role.isMaster })) {
    return {
      ok: false as const,
      error: actor.id === target.id ? t.errors.ownRole : t.errors.othersRole,
    };
  }

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, isMaster: true },
  });
  if (!role) return { ok: false as const, error: t.errors.roleGone };

  // Handing out the master role is itself a master's decision: otherwise
  // `people.role` alone would be a route to everything.
  if (role.isMaster && !actor.isMaster) {
    return { ok: false as const, error: t.errors.notMaster };
  }

  await prisma.user.update({ where: { id: userId }, data: { roleId } });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function setUserActive(userId: string, isActive: boolean) {
  const [actor, t] = await Promise.all([requireUser(), getMessages()]);
  const target = await loadTarget(userId);
  if (!target) return { ok: false as const, error: t.errors.accountGone };

  if (!canDeactivate(actor, { id: target.id, isMaster: target.role.isMaster })) {
    return {
      ok: false as const,
      error: actor.id === target.id ? t.errors.ownDeactivate : t.errors.othersDeactivate,
    };
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { isActive } }),
    // Deactivating has to end their live sessions, or the account stays usable
    // until every existing cookie expires.
    ...(isActive ? [] : [prisma.session.deleteMany({ where: { userId } })]),
  ]);

  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Deleting is refused whenever the account has left a trace: their tickets and
 * messages would go with them, and a conversation with a hole in it is worse
 * than a row marked inactive. Deactivation is the answer for everyone else.
 */
export async function deleteUser(userId: string) {
  const [actor, t] = await Promise.all([requireUser(), getMessages()]);
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: { select: { isMaster: true } },
      _count: { select: { reportedTickets: true, comments: true, assignedTickets: true } },
    },
  });
  if (!target) return { ok: false as const, error: t.errors.accountGone };

  if (!canDeactivate(actor, { id: target.id, isMaster: target.role.isMaster })) {
    return {
      ok: false as const,
      error: actor.id === target.id ? t.errors.ownDelete : t.errors.othersDelete,
    };
  }

  const traces =
    target._count.reportedTickets + target._count.comments + target._count.assignedTickets;
  if (traces > 0) {
    return {
      ok: false as const,
      error: t.errors.hasHistory,
    };
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
