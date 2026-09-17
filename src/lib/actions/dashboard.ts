"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMessages } from "@/lib/settings";
import { readWidgets, writeWidgets } from "@/lib/dashboard-widgets";

/**
 * Which panels someone keeps on their dashboard.
 *
 * No permission check beyond being signed in: this is a preference about one
 * person's own screen, and it is written to their own row.
 *
 * The list is normalised on the way in rather than trusted — an id we have
 * never heard of would otherwise sit in the column forever, waiting to be a
 * blank space on the page.
 */
export async function saveDashboard(order: string) {
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { dashboard: writeWidgets(readWidgets(order)) },
      select: { id: true },
    });
  } catch {
    return { ok: false as const, error: t.errors.generic };
  }

  revalidatePath("/");
  return { ok: true as const };
}
