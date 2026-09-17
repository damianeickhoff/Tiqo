"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { fieldErrors, statusSchema } from "@/lib/validation";
import type { FormState } from "@/lib/actions/auth";

async function allowed() {
  const user = await requireUser();
  return can(user, "settings.tickets");
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function createStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getMessages();
  if (!(await allowed())) return { errors: { form: t.errors.noSettings } };

  const parsed = statusSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || "#9a9287",
    settles: formData.get("settles") === "on",
    showOnPortal: formData.get("showOnPortal") === "on",
    pausesClock: formData.get("pausesClock") === "on",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error, t) };

  const taken = await prisma.status.findUnique({
    where: { name: parsed.data.name },
    select: { id: true },
  });
  if (taken) return { errors: { name: t.errors.statusNamed } };

  const last = await prisma.status.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.status.create({
    data: { ...parsed.data, position: (last?.position ?? 0) + 1 },
  });

  refresh();
  return {};
}

export async function updateStatus(
  statusId: string,
  values: {
    name: string;
    color: string;
    settles: boolean;
    showOnPortal: boolean;
    pausesClock: boolean;
  },
) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const parsed = statusSchema.safeParse(values);
  if (!parsed.success) return { ok: false as const, error: t.errors.invalidStatus };

  const clash = await prisma.status.findFirst({
    where: { name: parsed.data.name, id: { not: statusId } },
    select: { id: true },
  });
  if (clash) return { ok: false as const, error: t.errors.otherStatusNamed };

  await prisma.status.update({ where: { id: statusId }, data: parsed.data });
  refresh();
  return { ok: true as const };
}

/** Exactly one status starts a ticket, one is where Close sends it, and one is
 *  where a refused change goes; setting any of them moves the flag rather than
 *  adding a second holder. */
export async function setStatusFlag(
  statusId: string,
  flag: "isDefault" | "isClosing" | "isCancelling",
) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  await prisma.$transaction([
    prisma.status.updateMany({ where: { [flag]: true }, data: { [flag]: false } }),
    prisma.status.update({ where: { id: statusId }, data: { [flag]: true } }),
  ]);

  refresh();
  return { ok: true as const };
}

export async function moveStatus(statusId: string, direction: "up" | "down") {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const all = await prisma.status.findMany({
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });

  const index = all.findIndex((status) => status.id === statusId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= all.length) return { ok: true as const };

  // Positions are rewritten wholesale rather than swapped: the two rows may
  // share a position if they were ever created in the same breath.
  const reordered = [...all];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith]!, reordered[index]!];

  await prisma.$transaction(
    reordered.map((status, position) =>
      prisma.status.update({ where: { id: status.id }, data: { position } }),
    ),
  );

  refresh();
  return { ok: true as const };
}

/**
 * Deleting takes the status off the tickets that held it, exactly as asked:
 * they keep everything else and simply show as having no stage. The count is
 * returned so the screen can say what it just did.
 */
export async function deleteStatus(statusId: string) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const status = await prisma.status.findUnique({
    where: { id: statusId },
    select: { isDefault: true, _count: { select: { tickets: true } } },
  });
  if (!status) return { ok: false as const, error: t.errors.statusGone };
  if (status.isDefault) {
    return { ok: false as const, error: t.errors.startingStatusFirst };
  }

  await prisma.status.delete({ where: { id: statusId } });
  refresh();
  return { ok: true as const, orphaned: status._count.tickets };
}
