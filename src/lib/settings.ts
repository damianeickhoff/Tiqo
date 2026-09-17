import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Priority } from "@/generated/prisma/enums";
import { DEFAULT_TARGETS, PRIORITY_ORDER, type Clock } from "@/lib/tickets";
import type { BusinessHours } from "@/lib/clock";
import { messagesFor } from "@/lib/i18n";
import type { Template, TemplateKind } from "@/lib/mail-templates";

/**
 * A per-request memo a write in the same request can drop.
 *
 * `cache()` on its own is not enough. A server action reads the settings — for
 * the locale of its own error messages, if nothing else — then writes, and then
 * Next re-renders the page inside that same request. The memo would still be
 * holding the row from before the write, so a form showed its old state until
 * the page was reloaded by hand. Forgetting it after a write is what makes the
 * re-render see what was just saved.
 */
type Cached<T> = (() => Promise<T>) & { forget: () => void };

function requestCache<T>(load: () => Promise<T>): Cached<T> {
  const slot = cache(() => ({ value: null as Promise<T> | null }));
  const read = (() => (slot().value ??= load())) as Cached<T>;
  read.forget = () => void (slot().value = null);
  return read;
}

/** The single row every instance setting lives on. */
export const INSTANCE_ID = "instance";

export type InstanceSettings = {
  brandColor: string;
  locale: string;
  dateLocale: string | null;
  selfRegistration: boolean;
  portalEnabled: boolean;
  portalTitle: string;
  portalWelcome: string;
  portalClosedReason: string | null;
  defaultType: "QUESTION" | "INCIDENT" | "CHANGE";
  defaultPriority: Priority;
  defaultProjectId: string | null;
  businessHours: boolean;
  businessDays: number[];
  businessStart: number;
  businessEnd: number;
  timeZone: string;
};

const FALLBACK: InstanceSettings = {
  brandColor: "#febe2e",
  locale: "en-GB",
  dateLocale: null,
  selfRegistration: true,
  portalEnabled: true,
  portalTitle: "Service portal",
  portalWelcome: "Tell us what you need and we will pick it up.",
  portalClosedReason: null,
  defaultType: "QUESTION",
  defaultPriority: "MEDIUM",
  defaultProjectId: null,
  businessHours: false,
  businessDays: [1, 2, 3, 4, 5],
  businessStart: 540,
  businessEnd: 1020,
  timeZone: "Europe/Amsterdam",
};

/**
 * Cached for the lifetime of one request: the layout, the page and any number
 * of components ask for these, and they must all see the same answer anyway.
 *
 * The row is created by the migration, but an instance whose database predates
 * it — or a test one — should render rather than crash, so a missing row falls
 * back to the values the code shipped with.
 */
export const getSettings = requestCache(async (): Promise<InstanceSettings> => {
  const row = await prisma.instance.findUnique({
    where: { id: INSTANCE_ID },
    select: {
      brandColor: true,
      locale: true,
      dateLocale: true,
      selfRegistration: true,
      portalEnabled: true,
      portalTitle: true,
      portalWelcome: true,
      portalClosedReason: true,
      defaultType: true,
      defaultPriority: true,
      defaultProjectId: true,
      businessHours: true,
      businessDays: true,
      businessStart: true,
      businessEnd: true,
      timeZone: true,
    },
  });

  return row ?? FALLBACK;
});

/** The single row every mail setting lives on. */
export const MAIL_ID = "mail";

export type MailSettings = {
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPass: string | null;
  fromName: string;
  fromEmail: string | null;
  imapHost: string | null;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string | null;
  imapPass: string | null;
  imapFolder: string;
  archiveFolder: string | null;
  signature: string | null;
  lastSentAt: Date | null;
  lastPolledAt: Date | null;
  lastPollSummary: PollSummary | null;
};

/** What the last drain did. Shaped here rather than read back as loose Json, so
 *  the health strip and the polling card agree on what the counts are called. */
export type PollSummary = {
  sent?: number;
  failed?: number;
  filed?: number;
  bounced?: number;
  skipped?: number;
};

const MAIL_FALLBACK: MailSettings = {
  smtpHost: null,
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: null,
  smtpPass: null,
  fromName: "Service desk",
  fromEmail: null,
  imapHost: null,
  imapPort: 993,
  imapSecure: true,
  imapUser: null,
  imapPass: null,
  imapFolder: "INBOX",
  archiveFolder: "Processed",
  signature: null,
  lastSentAt: null,
  lastPolledAt: null,
  lastPollSummary: null,
};

/**
 * How this desk talks to a mail server.
 *
 * A desk that has never been given one has no row at all, and that is the
 * normal state rather than a fault: the fallback says "no host", which is what
 * everything downstream reads as "this instance does not do mail".
 */
export const getMailSettings = requestCache(async (): Promise<MailSettings> => {
  const row = await prisma.mailSettings.findUnique({
    where: { id: MAIL_ID },
    select: {
      smtpHost: true,
      smtpPort: true,
      smtpSecure: true,
      smtpUser: true,
      smtpPass: true,
      fromName: true,
      fromEmail: true,
      imapHost: true,
      imapPort: true,
      imapSecure: true,
      imapUser: true,
      imapPass: true,
      imapFolder: true,
      archiveFolder: true,
      signature: true,
      lastSentAt: true,
      lastPolledAt: true,
      lastPollSummary: true,
    },
  });

  // The summary is the one column the database cannot type for us; a row
  // written by an older build, or by hand, is read as "no last run" rather than
  // trusted to be the shape the screen expects.
  return row ? { ...row, lastPollSummary: asSummary(row.lastPollSummary) } : MAIL_FALLBACK;
});

function asSummary(value: unknown): PollSummary | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as PollSummary)
    : null;
}

/** Whether there is anywhere to send. Everything that queues or drains asks
 *  this first, so an unconfigured instance stays exactly as quiet as it is. */
export function canSendMail(mail: MailSettings) {
  return Boolean(mail.smtpHost && mail.fromEmail);
}

/** Whether there is a mailbox to collect from. */
export function canCollectMail(mail: MailSettings) {
  return Boolean(mail.imapHost && mail.imapUser);
}

/**
 * The messages the desk has written itself, by kind.
 *
 * Only the edited ones: a kind with no row uses the wording Tiqo ships, which
 * is what makes an upgrade improve the messages nobody has touched and leave
 * alone the ones somebody has.
 */
export const getMailTemplates = requestCache(
  async (): Promise<Partial<Record<TemplateKind, Template & { html: string | null }>>> => {
    const rows = await prisma.mailTemplate.findMany({
      select: { kind: true, subject: true, body: true, html: true },
    });

    return Object.fromEntries(
      rows.map((row) => [row.kind, { subject: row.subject, body: row.body, html: row.html }]),
    );
  },
);

/**
 * Response targets by priority, in hours. Any priority without a row falls back
 * to the shipped default, so the map is always complete.
 */
export const getPriorityTargets = requestCache(async (): Promise<Record<Priority, number>> => {
  const rows = await prisma.priorityTarget.findMany({
    select: { priority: true, targetHours: true },
  });

  const targets = { ...DEFAULT_TARGETS };
  for (const row of rows) targets[row.priority] = row.targetHours;
  return targets;
});

export { DEFAULT_TARGETS, PRIORITY_ORDER };

/** Opening hours in the shape the clock wants them. */
export function businessHoursOf(settings: InstanceSettings): BusinessHours {
  return {
    enabled: settings.businessHours,
    days: settings.businessDays,
    start: settings.businessStart,
    end: settings.businessEnd,
    timeZone: settings.timeZone,
  };
}

/**
 * Everything the clock needs, in one request-cached read. Every component that
 * draws a countdown asks for this, so it must be one query however many of them
 * there are on the page.
 */
export const getMessages = requestCache(async () => messagesFor((await getSettings()).locale));

/**
 * The locale dates and numbers are written in.
 *
 * Separate from the interface language because the two answer different
 * questions: what the app speaks, and what a date looks like. An instance that
 * has never been asked gets the language, which is the old behaviour exactly.
 */
export function dateLocaleOf(settings: InstanceSettings) {
  return settings.dateLocale ?? settings.locale;
}

export const getClock = requestCache(async (): Promise<Clock> => {
  const [targets, settings] = await Promise.all([getPriorityTargets(), getSettings()]);
  return { targets, hours: businessHoursOf(settings) };
});

/**
 * The instance's blocked words, lower-cased.
 *
 * Cached per request rather than held in a module: a word added in Settings has
 * to bite on the very next message, and a module-level cache in a long-running
 * server would keep letting it through.
 */
export const getBlockedWords = requestCache(async (): Promise<string[]> => {
  const rows = await prisma.blockedWord.findMany({ select: { word: true } });
  return rows.map((row) => row.word);
});

/**
 * The first blocked word the text contains, or null.
 *
 * Whole words only, and case-insensitively: blocking "ass" should not reject
 * "assignee", which is the classic way a word filter makes itself hated.
 */
export async function findBlockedWord(text: string) {
  const words = await getBlockedWords();
  if (words.length === 0) return null;

  const haystack = text.toLowerCase();
  return (
    words.find((word) => {
      const pattern = new RegExp(
        `(?:^|[^\\p{L}\\p{N}])${escapeRegExp(word)}(?:[^\\p{L}\\p{N}]|$)`,
        "u",
      );
      return pattern.test(haystack);
    }) ?? null
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Drop what a settings write just invalidated. Called by the actions that
 * change these rows, so the re-render Next does straight after sees the new
 * values rather than the ones the action itself read on the way in.
 */
export function forgetSettings() {
  getSettings.forget();
  getMessages.forget();
  getClock.forget();
}

export function forgetPriorityTargets() {
  getPriorityTargets.forget();
  getClock.forget();
}

export function forgetBlockedWords() {
  getBlockedWords.forget();
}

export function forgetMailSettings() {
  getMailSettings.forget();
}

export function forgetMailTemplates() {
  getMailTemplates.forget();
}
