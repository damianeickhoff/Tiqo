"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { fieldErrors, loginSchema, registerSchema } from "@/lib/validation";
import { displayName, uniqueUsername } from "@/lib/accounts";
import { getMessages, getSettings } from "@/lib/settings";

export type FormState = { errors?: Record<string, string> } | undefined;

/** A real hash to compare against when the email is unknown, so a failed login
 *  costs the same time whether or not the account exists. Computed once. */
let decoy: Promise<string> | null = null;
function decoyHash() {
  decoy ??= hashPassword("tiqo-timing-equaliser");
  return decoy;
}

/** The master role for the very first account, the default role for everyone
 *  after — and the lowest-ranked role if nobody has marked a default. */
async function landingRoleId(isFirstUser: boolean) {
  if (isFirstUser) {
    const master = await prisma.role.findFirst({
      where: { isMaster: true },
      select: { id: true },
    });
    if (master) return master.id;
  }

  const fallback = await prisma.role.findFirst({
    where: { isDefault: true },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  if (fallback) return fallback.id;

  const lowest = await prisma.role.findFirstOrThrow({
    orderBy: { position: "asc" },
    select: { id: true },
  });
  return lowest.id;
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getMessages();
  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error, t) };

  const { firstName, lastName, email, password } = parsed.data;

  // Bootstrap rule below means the very first account is always allowed; after
  // that, a closed instance refuses regardless of what the form was told.
  const settings = await getSettings();

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { errors: { email: t.errors.emailTaken } };
  }

  // Bootstrap rule: whoever registers first owns the instance. Everyone after
  // that lands in the default role and someone promotes them.
  const isFirstUser = (await prisma.user.count()) === 0;
  if (!settings.selfRegistration && !isFirstUser) {
    return {
      errors: { form: t.errors.signUpsClosed },
    };
  }

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      name: displayName(firstName, lastName),
      username: await uniqueUsername(email),
      email,
      passwordHash: await hashPassword(password),
      roleId: await landingRoleId(isFirstUser),
    },
    select: { id: true },
  });

  await createSession(user.id, (await headers()).get("user-agent"));
  redirect("/");
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getMessages();

  // Only a path within this app, and never one that starts a scheme or a host:
  // a "next" that can point anywhere is an open redirect wearing a helpful hat.
  const raw = String(formData.get("next") ?? "");
  const next = /^\/[a-zA-Z0-9/_-]*$/.test(raw) ? raw : "/";
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error, t) };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true, isActive: true },
  });

  // Same message and roughly the same work either way, so the form cannot be
  // used to find out which addresses have accounts.
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await decoyHash()));

  if (!user || !ok) {
    return { errors: { form: t.errors.signInFailed } };
  }
  if (!user.isActive) {
    return { errors: { form: t.errors.deactivated } };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  await createSession(user.id, (await headers()).get("user-agent"));
  redirect(next);
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
