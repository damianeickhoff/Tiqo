"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { NOTICE_LIMIT, type Notice } from "@/lib/notifications";

/** Enough to read the list without a second round trip per row. */
const SELECT = {
  id: true,
  kind: true,
  readAt: true,
  createdAt: true,
  actor: { select: { name: true, avatarVariant: true } },
  ticket: { select: { number: true, reference: true, title: true } },
  project: { select: { key: true, name: true } },
  doc: { select: { slug: true, title: true, space: { select: { key: true } } } },
} as const;

export async function listNotifications(): Promise<{ notices: Notice[]; unread: number }> {
  const user = await requireUser();

  const [notices, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: NOTICE_LIMIT,
      select: SELECT,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return { notices, unread };
}

export async function markNotificationRead(id: string) {
  const user = await requireUser();

  // Scoped by user in the write itself: an id from someone else's bell matches
  // nothing rather than being read on their behalf.
  await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function markAllNotificationsRead() {
  const user = await requireUser();

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}
