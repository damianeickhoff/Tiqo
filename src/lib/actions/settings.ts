"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";
import {
  INSTANCE_ID,
  forgetBlockedWords,
  forgetPriorityTargets,
  forgetSettings,
  getMessages,
} from "@/lib/settings";
import { PRIORITY_ORDER } from "@/lib/tickets";
import {
  blockedWordSchema,
  brandSchema,
  businessHoursSchema,
  fieldErrors,
  firstError,
  localeSchema,
  priorityTargetsSchema,
  tagSchema,
  ticketDefaultsSchema,
} from "@/lib/validation";
import type { FormState } from "@/lib/actions/auth";

/** Each action names the permission it needs, matching the section it lives in.
 *  The page hides what you cannot use; this is what stops you doing it anyway. */
async function allowed(permission: Permission) {
  const user = await requireUser();
  return can(user, permission);
}

/**
 * A settings change can touch anything on screen — the brand recolours the whole
 * shell, a renamed tag appears on every ticket — so the whole tree is
 * revalidated rather than a guessed subset.
 */
function refreshEverything() {
  revalidatePath("/", "layout");
  // The settings tree by name as well. Revalidating the root layout alone
  // re-renders the layout and leaves the page segment the client is looking at
  // served from its own cache — which is how a saved checkbox came back on
  // screen holding the value it had before the save.
  revalidatePath("/settings", "layout");
}

/**
 * What every settings write answers with.
 *
 * These take their values as an argument rather than as `FormData` through
 * `useActionState`. React 19 resets a form once its action returns, which wipes
 * what is on screen even though the write succeeded — a ticked box came back
 * unticked until the page was reloaded. Values in, one result out, and the form
 * keeps its own draft.
 */
export type Written = { ok: true } | { ok: false; error: string };

async function writeInstance(data: Record<string, unknown>) {
  await prisma.instance.upsert({
    where: { id: INSTANCE_ID },
    update: data,
    create: { id: INSTANCE_ID, ...data },
  });
  // Before the revalidation, not after: the re-render happens inside this same
  // request, and it must not read the row this action loaded on the way in.
  forgetSettings();
  refreshEverything();
}

/* ------------------------------------------------------------- appearance -- */

export async function updateBrandColor(brandColor: string): Promise<Written> {
  const t = await getMessages();
  if (!(await allowed("settings.general"))) return { ok: false, error: t.errors.noSettings };

  const parsed = brandSchema.safeParse({ brandColor });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error, t) };

  await writeInstance({ brandColor: parsed.data.brandColor });
  return { ok: true };
}

export async function updateLocale(locale: string, dateLocale: string): Promise<Written> {
  const t = await getMessages();
  if (!(await allowed("settings.general"))) return { ok: false, error: t.errors.noSettings };

  const parsed = localeSchema.safeParse({ locale, dateLocale });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error, t) };

  await writeInstance({
    locale: parsed.data.locale,
    dateLocale: parsed.data.dateLocale || null,
  });
  return { ok: true };
}

export async function setSelfRegistration(open: boolean) {
  const t = await getMessages();
  if (!(await allowed("settings.general")))
    return { ok: false as const, error: t.errors.noPermission };

  await writeInstance({ selfRegistration: open });
  return { ok: true as const };
}

export async function updatePortal(values: {
  portalEnabled: boolean;
  portalTitle: string;
  portalWelcome: string;
}): Promise<Written> {
  const t = await getMessages();
  if (!(await allowed("settings.general"))) return { ok: false, error: t.errors.noSettings };

  await writeInstance({
    portalEnabled: values.portalEnabled,
    portalTitle: values.portalTitle.trim().slice(0, 60) || "Service portal",
    portalWelcome: values.portalWelcome.trim().slice(0, 300),
  });

  revalidatePath("/portal", "layout");
  return { ok: true };
}

/* ---------------------------------------------------------------- tickets -- */

/**
 * Open or close the portal.
 *
 * Closing takes a reason, and will not proceed without one: the portal keeps
 * answering while it is shut, and what it answers with is this sentence. A
 * door with no notice on it sends people to the phone.
 */
export async function setPortalOpen(open: boolean, reason: string): Promise<Written> {
  const t = await getMessages();
  if (!(await allowed("settings.general"))) return { ok: false, error: t.errors.noSettings };

  const why = reason.trim().slice(0, 300);
  if (!open && !why) return { ok: false, error: t.errors.needClosedReason };

  await writeInstance({
    portalEnabled: open,
    // The reason is kept when reopening, so closing again next month does not
    // start from a blank field.
    ...(open ? {} : { portalClosedReason: why }),
  });

  revalidatePath("/portal", "layout");
  revalidatePath("/settings/portal", "layout");
  return { ok: true };
}

export async function updateTicketDefaults(values: {
  defaultType: string;
  defaultPriority: string;
  defaultProjectId: string;
}): Promise<Written> {
  const t = await getMessages();
  if (!(await allowed("settings.tickets"))) return { ok: false, error: t.errors.noSettings };

  const parsed = ticketDefaultsSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error, t) };

  await writeInstance(parsed.data);
  return { ok: true };
}

export async function updatePriorityTargets(
  values: Record<string, number | string>,
): Promise<Written> {
  const t = await getMessages();
  if (!(await allowed("settings.tickets"))) return { ok: false, error: t.errors.noSettings };

  const parsed = priorityTargetsSchema.safeParse(
    Object.fromEntries(PRIORITY_ORDER.map((priority) => [priority, values[priority]])),
  );
  if (!parsed.success) return { ok: false, error: firstError(parsed.error, t) };

  // One transaction: a half-applied set of targets would have tickets measured
  // against a promise the desk never made.
  await prisma.$transaction(
    PRIORITY_ORDER.map((priority) =>
      prisma.priorityTarget.upsert({
        where: { priority },
        update: { targetHours: parsed.data[priority] },
        create: { priority, targetHours: parsed.data[priority] },
      }),
    ),
  );

  forgetPriorityTargets();
  refreshEverything();
  return { ok: true };
}

export async function updateBusinessHours(values: {
  businessHours: boolean;
  businessDays: number[];
  businessStart: number;
  businessEnd: number;
  timeZone: string;
}): Promise<Written> {
  const t = await getMessages();
  if (!(await allowed("settings.tickets"))) return { ok: false, error: t.errors.noSettings };

  const parsed = businessHoursSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error, t) };

  await writeInstance(parsed.data);
  return { ok: true };
}

/* ------------------------------------------------------------------- tags -- */

export async function createTag(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getMessages();
  if (!(await allowed("settings.tags"))) return { errors: { form: t.errors.noTags } };

  const parsed = tagSchema.safeParse({
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
  refreshEverything();
  return {};
}

export async function renameTag(labelId: string, name: string, color: string) {
  const t = await getMessages();
  if (!(await allowed("settings.tags")))
    return { ok: false as const, error: t.errors.noPermission };

  const parsed = tagSchema.safeParse({ name, color });
  if (!parsed.success) return { ok: false as const, error: t.errors.invalidTag };

  const clash = await prisma.label.findFirst({
    where: { name: parsed.data.name, id: { not: labelId } },
    select: { id: true },
  });
  if (clash) return { ok: false as const, error: t.errors.otherTagNamed };

  await prisma.label.update({ where: { id: labelId }, data: parsed.data });
  refreshEverything();
  return { ok: true as const };
}

export async function deleteTag(labelId: string) {
  const t = await getMessages();
  if (!(await allowed("settings.tags")))
    return { ok: false as const, error: t.errors.noPermission };

  // The join rows go with it, so the tag simply leaves the tickets that carried
  // it. Nothing else references a label.
  await prisma.label.delete({ where: { id: labelId } });
  refreshEverything();
  return { ok: true as const };
}

/* --------------------------------------------------------- blocked words -- */

export async function addBlockedWord(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getMessages();
  if (!(await allowed("settings.words"))) return { errors: { form: t.errors.noWords } };

  const parsed = blockedWordSchema.safeParse({ word: formData.get("word") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error, t) };

  const exists = await prisma.blockedWord.findUnique({
    where: { word: parsed.data.word },
    select: { id: true },
  });
  if (exists) return { errors: { word: t.errors.wordListed } };

  await prisma.blockedWord.create({ data: parsed.data });
  forgetBlockedWords();
  refreshEverything();
  return {};
}

export async function removeBlockedWord(id: string) {
  const t = await getMessages();
  if (!(await allowed("settings.words")))
    return { ok: false as const, error: t.errors.noPermission };

  await prisma.blockedWord.delete({ where: { id } });
  forgetBlockedWords();
  refreshEverything();
  return { ok: true as const };
}
