"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";

/**
 * The answers a desk writes once and sends a hundred times.
 *
 * They answer to `settings.tickets` like statuses and tags do: a canned reply
 * is a thing the desk says in its own name, and who may write one is the same
 * question as who may decide what a status is called.
 */
async function guard() {
  const [t, user] = await Promise.all([getMessages(), requireUser()]);
  return { t, ok: can(user, "settings.tickets") };
}

function refresh() {
  revalidatePath("/settings/tickets");
  // Every ticket page carries the picker, so the list has to be re-read there
  // too — a reply added this morning is no use if it appears tomorrow.
  revalidatePath("/tickets", "layout");
}

export async function createCannedReply(title: string, body: string) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const clean = title.trim().slice(0, 80);
  if (!clean) return { ok: false as const, error: t.errors.nameCannedReply };
  if (!body.trim()) return { ok: false as const, error: t.errors.emptyCannedReply };

  const last = await prisma.cannedReply.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.cannedReply.create({
    data: { title: clean, body: body.trim(), position: (last?.position ?? -1) + 1 },
  });

  refresh();
  return { ok: true as const };
}

export async function updateCannedReply(
  id: string,
  patch: { title?: string; body?: string; isActive?: boolean },
) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const title = patch.title?.trim().slice(0, 80);
  if (patch.title !== undefined && !title) {
    return { ok: false as const, error: t.errors.nameCannedReply };
  }
  if (patch.body !== undefined && !patch.body.trim()) {
    return { ok: false as const, error: t.errors.emptyCannedReply };
  }

  await prisma.cannedReply.update({
    where: { id },
    data: {
      ...(title === undefined ? {} : { title }),
      ...(patch.body === undefined ? {} : { body: patch.body.trim() }),
      ...(patch.isActive === undefined ? {} : { isActive: patch.isActive }),
    },
  });

  refresh();
  return { ok: true as const };
}

export async function deleteCannedReply(id: string) {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  await prisma.cannedReply.delete({ where: { id } });
  refresh();
  return { ok: true as const };
}

/**
 * Up or down one place. Two rows swap positions rather than the whole list
 * being rewritten: the list is short, and a swap is the smallest write that
 * says what happened.
 */
export async function moveCannedReply(id: string, direction: "up" | "down") {
  const { t, ok } = await guard();
  if (!ok) return { ok: false as const, error: t.errors.noSettings };

  const all = await prisma.cannedReply.findMany({
    orderBy: { position: "asc" },
    select: { id: true },
  });

  const index = all.findIndex((row) => row.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= all.length) return { ok: true as const };

  const reordered = [...all];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith]!, reordered[index]!];

  await prisma.$transaction(
    reordered.map((row, position) =>
      prisma.cannedReply.update({ where: { id: row.id }, data: { position } }),
    ),
  );

  refresh();
  return { ok: true as const };
}
