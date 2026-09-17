"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  MAIL_ID,
  forgetMailSettings,
  forgetMailTemplates,
  getMailSettings,
  getMessages,
} from "@/lib/settings";
import type { MailSettings } from "@/lib/settings";
import type { TemplateKind } from "@/lib/mail-templates";
import { TEMPLATE_KINDS } from "@/lib/mail-templates";
import {
  firstError,
  mailCollectingSchema,
  mailSendingSchema,
  mailSignatureSchema,
  mailTemplateSchema,
} from "@/lib/validation";
import { drainOutbox, reason, recordMailRun, sendTestMail, verifySending } from "@/lib/mail";
import { drainInbox, verifyCollecting } from "@/lib/mail-inbox";
import type { Written } from "@/lib/actions/settings";

/**
 * The mail settings, and the two Test buttons beside them.
 *
 * The passwords are the only thing here that is not simply written: they are
 * never sent to the browser, so an empty field means "leave the stored one
 * alone" rather than "clear it". Somebody moving to a relay that wants no
 * authentication clears the username, which is what actually turns it off.
 */

export type SendingDraft = {
  smtpHost: string;
  smtpPort: number | string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
};

export type CollectingDraft = {
  imapHost: string;
  imapPort: number | string;
  imapSecure: boolean;
  imapUser: string;
  imapPass: string;
  imapFolder: string;
  archiveFolder: string;
};

async function allowed() {
  return can(await requireUser(), "settings.mail");
}

async function write(data: Record<string, unknown>) {
  await prisma.mailSettings.upsert({
    where: { id: MAIL_ID },
    update: data,
    create: { id: MAIL_ID, ...data },
  });
  // Before the revalidation, not after: the re-render happens inside this same
  // request and must not read the row this action loaded on the way in.
  forgetMailSettings();
  revalidatePath("/settings/mail", "layout");
}

export async function updateMailSending(values: SendingDraft): Promise<Written> {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false, error: t.errors.noSettings };

  const parsed = mailSendingSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error, t) };

  const stored = await getMailSettings();
  await write({ ...parsed.data, smtpPass: parsed.data.smtpPass || stored.smtpPass });
  return { ok: true };
}

export async function updateMailCollecting(values: CollectingDraft): Promise<Written> {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false, error: t.errors.noSettings };

  const parsed = mailCollectingSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error, t) };

  const stored = await getMailSettings();
  await write({ ...parsed.data, imapPass: parsed.data.imapPass || stored.imapPass });
  return { ok: true };
}

/**
 * Connect and report back, saving nothing.
 *
 * Tests what is on screen rather than what is stored — the point of a test is
 * finding out before committing to it. The password is the exception again: an
 * untouched field means the stored one, which is what lets somebody test a
 * changed port without retyping a secret they cannot see.
 */
export async function testMailSending(values: SendingDraft) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const parsed = mailSendingSchema.safeParse(values);
  if (!parsed.success) return { ok: false as const, error: firstError(parsed.error, t) };
  if (!parsed.data.smtpHost) return { ok: false as const, error: t.errors.noMailServer };

  const result = await verifySending(await withStored(parsed.data));
  // A passing test is the other thing the health strip counts as sending
  // working — on a fresh instance it is the only thing there is, because
  // nothing has been queued yet.
  if (result.ok) {
    await recordMailRun({ lastSentAt: new Date() });
    revalidatePath("/settings/mail", "layout");
  }
  return result;
}

export async function testMailCollecting(values: CollectingDraft) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const parsed = mailCollectingSchema.safeParse(values);
  if (!parsed.success) return { ok: false as const, error: firstError(parsed.error, t) };
  if (!parsed.data.imapHost) return { ok: false as const, error: t.errors.noMailbox };

  const result = await verifyCollecting(await withStored(parsed.data));
  if (result.ok) {
    await recordMailRun({ lastPolledAt: new Date() });
    revalidatePath("/settings/mail", "layout");
  }
  return result;
}

/* ------------------------------------------------------------- signature -- */

/**
 * What the desk signs off with, under every message.
 *
 * One setting rather than a line at the bottom of ten templates: a desk that
 * changes its opening hours should change them once, and a sign-off repeated
 * ten times is nine places to forget.
 */
export async function updateMailSignature(values: { signature: string }): Promise<Written> {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false, error: t.errors.noSettings };

  const parsed = mailSignatureSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error, t) };

  await write({ signature: parsed.data.signature || null });
  return { ok: true };
}

/* -------------------------------------------------------------- wording -- */

/**
 * What one message says, and what it looks like saying it.
 *
 * One write for both halves, because they are one decision: somebody moving a
 * sentence out of the wording and into the layout would otherwise have to save
 * a document that reads wrong in between.
 *
 * A layout that is still the shipped one comes in empty and is stored as null,
 * so a desk that only reworded something keeps getting the layout Tiqo ships —
 * the same rule the wording follows through an upgrade.
 */
export async function updateMailTemplate(
  kind: TemplateKind,
  values: { subject: string; body: string; html: string },
): Promise<Written> {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false, error: t.errors.noSettings };

  const parsed = mailTemplateSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error, t) };

  // A variable this message has nothing to fill in is not a reason to refuse
  // the save. It renders as nothing — which is what the preview above the Save
  // button has been showing all along — and refusing it meant somebody could
  // not store a message that happened to contain two braces.

  await prisma.mailTemplate.upsert({
    where: { kind },
    update: parsed.data,
    create: { kind, ...parsed.data },
  });

  forgetMailTemplates();
  revalidatePath("/settings/mail", "layout");
  return { ok: true };
}

/**
 * Back to the template Tiqo ships, wording and layout both — by deleting the
 * row rather than by writing the shipped text into it, so the message keeps
 * improving with the app.
 *
 * A list-level command: it takes effect on the click, like every other verb
 * that stands on its own.
 */
export async function resetMailTemplate(kind: TemplateKind) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  await prisma.mailTemplate.deleteMany({ where: { kind } });

  forgetMailTemplates();
  revalidatePath("/settings/mail", "layout");
  return { ok: true as const };
}

/* ------------------------------------------------------------------ log -- */

/**
 * A message that was given up on, put back on the queue.
 *
 * The attempt count goes back to nothing as well as the status: five failures
 * are what made this row dead, and leaving them on it would have the next drain
 * skip it for the same reason. `lastError` is kept — it is the only record of
 * why the first five tries did not work, and somebody deciding whether to press
 * this again needs to read it.
 *
 * A list-level command, so it takes effect on the click. Nothing is sent here:
 * the row goes back in the queue and the next poll does the sending, which is
 * the whole shape of this feature.
 */
export async function resendMail(id: string) {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const put = await prisma.mailMessage.updateMany({
    where: { id, direction: "OUT", status: "FAILED" },
    data: { status: "PENDING", attempts: 0, claimedAt: null },
  });
  if (put.count === 0) return { ok: false as const, error: t.errors.mailGone };

  revalidatePath("/settings/mail", "layout");
  return { ok: true as const };
}

/** The draft over the stored row, so a test has every field a connection needs
 *  even though the form only holds one card's worth of them. */
async function withStored(draft: Partial<MailSettings>): Promise<MailSettings> {
  const stored = await getMailSettings();
  const merged = { ...stored, ...draft };

  return {
    ...merged,
    smtpPass: draft.smtpPass || stored.smtpPass,
    imapPass: draft.imapPass || stored.imapPass,
  };
}

/* ----------------------------------------------------------- the strip -- */

/**
 * Every message that was given up on, back on the queue.
 *
 * The same command as the one on a log row, aimed at all of them: a relay that
 * was refusing connections for an hour leaves a column of identical failures,
 * and pressing Send again forty times is not a use of anybody's morning.
 */
export async function retryFailedMail() {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  const put = await prisma.mailMessage.updateMany({
    where: { direction: "OUT", status: "FAILED" },
    data: { status: "PENDING", attempts: 0, claimedAt: null },
  });

  revalidatePath("/settings/mail", "layout");
  return { ok: true as const, count: put.count };
}

/**
 * The drain, run here and now.
 *
 * Nothing in the app runs on a clock — the poll route is called from outside —
 * and that is the right shape for a desk that has set a timer up. It is the
 * wrong shape for the ten minutes in which somebody is setting mail up for the
 * first time, which is what this button is for: both halves, in process, with
 * the counts handed straight back.
 */
export async function pollMailNow() {
  const t = await getMessages();
  if (!(await allowed())) return { ok: false as const, error: t.errors.noSettings };

  try {
    const out = await drainOutbox();
    const inbound = await drainInbox();
    revalidatePath("/settings/mail", "layout");
    return {
      ok: true as const,
      counts: {
        sent: out.sent,
        failed: out.failed,
        filed: inbound.filed,
        bounced: inbound.bounced,
        skipped: inbound.skipped,
      },
    };
  } catch (error) {
    // The server's own sentence: a drain that could not connect is the whole
    // reason somebody pressed this.
    return { ok: false as const, error: reason(error) };
  }
}

/* -------------------------------------------------------- send me one -- */

/**
 * One message, or all ten, to whoever asked.
 *
 * Queued and drained in the same breath, because somebody who presses "send me
 * a test" is asking to receive one now rather than at the next poll — and a
 * test that sits in a queue proves nothing about whether mail works.
 */
export async function sendMailTest(kind?: TemplateKind, draftLayout?: string) {
  const t = await getMessages();
  const user = await requireUser();
  if (!can(user, "settings.mail")) return { ok: false as const, error: t.errors.noSettings };

  const mail = await getMailSettings();
  if (!mail.smtpHost || !mail.fromEmail) {
    return { ok: false as const, error: t.errors.noMailServer };
  }

  const kinds = kind ? [kind] : TEMPLATE_KINDS;
  // The layout on screen where there is one — a test of a document nobody has
  // saved yet is the only way to find out how a client draws it.
  for (const one of kinds) await sendTestMail(one, user, kind ? draftLayout : undefined);

  try {
    await drainOutbox();
  } catch (error) {
    return { ok: false as const, error: reason(error) };
  }

  revalidatePath("/settings/mail", "layout");
  return { ok: true as const, to: user.email, count: kinds.length };
}
