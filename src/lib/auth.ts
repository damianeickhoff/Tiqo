import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
const SESSION_COOKIE = "tiqo_session";
const SESSION_TTL_DAYS = 30;
const BCRYPT_ROUNDS = 12;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarVariant: number;
  /// The picture they uploaded, where they have one.
  avatarImage: string | null;
  /// The language they read the portal in. Null follows the instance.
  locale: string | null;
  /// The role travels with the session rather than being looked up per check:
  /// every page asks something of it, and it changes about once per account.
  roleId: string;
  roleName: string;
  isMaster: boolean;
  permissions: string[];
};

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/// The cookie carries the raw token; the database only ever sees its digest.
function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      tokenHash: digest(token),
      userId,
      expiresAt,
      userAgent: userAgent?.slice(0, 255) ?? null,
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: digest(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

/// Cached for the lifetime of one request, so a page that checks the user in the
/// layout, the page and three components still issues a single query.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: digest(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarVariant: true,
          avatarImage: true,
          locale: true,
          isActive: true,
          role: {
            select: { id: true, name: true, isMaster: true, permissions: true },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    return null;
  }

  const { id, email, name, avatarVariant, avatarImage, locale, role } = session.user;
  return {
    id,
    email,
    name,
    avatarVariant,
    avatarImage,
    locale,
    roleId: role.id,
    roleName: role.name,
    isMaster: role.isMaster,
    permissions: role.permissions,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  // Next renders layouts and pages in parallel, so a page reaches this before
  // the authenticated layout's own redirect resolves. Redirecting here too is
  // what keeps a signed-out request from throwing on the way out.
  if (!user) redirect("/login");
  return user;
}
