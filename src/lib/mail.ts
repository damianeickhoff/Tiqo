import "server-only";

import { prisma } from "@/lib/prisma";
import {
  canCollectMail,
  canSendMail,
  dateLocaleOf,
  forgetMailSettings,
  getMailSettings,
  getMailTemplates,
  getMessages,
  getSettings,
  MAIL_ID,
  type InstanceSettings,
  type MailSettings,
} from "@/lib/settings";
import { can } from "@/lib/permissions";
import {
  firstLine,
  render,
  renderHtml,
  shippedTemplate,
  type TemplateKind,
} from "@/lib/mail-templates";
import { mailDocument, plainDocument } from "@/lib/mail-layout";
import type { Messages } from "@/lib/i18n";
import type { NotificationKind, Priority, TicketType } from "@/generated/prisma/enums";

/**
 * Mail out.
 *
 * Two halves, in two files. This one sends: it queues what the desk has to say
 * and drains that queue through SMTP. Collecting lives in `mail-inbox.ts`,
 * which is reached only from the poll route — partly so an action that queues a
 * mail does not drag an IMAP client in behind it, and partly because the
 * inbound side has to write notifications, and `notify()` already reaches in
 * here.
 *
 * Nothing is sent inline. A server action that waits on a remote handshake is
 * an action that times out, and a mail that fails on the first attempt is
 * usually one that succeeds on the second — so every message is a row, and
 * something outside the request sends it.
 *
 * What each message *says* is not here. The wording is a template — the desk's
 * own if it has written one, otherwise the one Tiqo ships — and this file's job
 * is to work out what the variables in it stand for.
 */

/** Given up on after this many tries. A server that has refused five times is
 *  not a server that is briefly busy. */
const MAX_ATTEMPTS = 5;

/** One drain sends at most this many, so a poll that runs every minute cannot
 *  hold a connection open for an hour on a backlog. */
const BATCH = 50;

/** How long a claimed row is left alone before another drain may take it. Long
 *  enough that a slow SMTP server is not overtaken, short enough that a crash
 *  costs one poll interval rather than the mail. */
const STALE_CLAIM_MS = 10 * 60 * 1000;

/**
 * Where a link in a mail points.
 *
 * The one thing mail cannot work out for itself: nothing in a queued row knows
 * what host the app answers on. Without it every mail would carry a link to
 * localhost, which is worse than carrying none.
 */
export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * Puts a message on the queue, or does nothing at all.
 *
 * Silent when the instance has no mail server: an unconfigured desk must behave
 * exactly as it did before this feature existed, rather than filling a table
 * with mail nobody will ever be able to send. It also means the queue never
 * holds a backlog of stale notifications waiting for the day SMTP is set up.
 */
export async function queueMail({
  to,
  subject,
  body,
  html,
  ticketId,
  kind,
}: {
  to: string;
  subject: string;
  body: string;
  /// The laid-out half. Optional so a caller that has only words to send still
  /// can: the plain half is what every client can read.
  html?: string;
  ticketId?: string | null;
  /// Which template wrote it, so the wording table can count sends by kind.
  kind?: TemplateKind | null;
}) {
  const mail = await getMailSettings();
  if (!canSendMail(mail) || !to.trim()) return;

  await prisma.mailMessage.create({
    data: {
      to: to.trim(),
      subject,
      body,
      html: html ?? null,
      ticketId: ticketId ?? null,
      kind: kind ?? null,
    },
  });
}

/**
 * When mail last worked, and what the last drain did.
 *
 * Written from the drains and from the two Test buttons, because the settings
 * screen otherwise has no way to tell a mailbox that is quiet from one that is
 * broken — both look like a form with a host typed into it. Upserted rather
 * than updated: a desk can pass a test against a draft it has not saved yet.
 */
export async function recordMailRun(data: {
  lastSentAt?: Date;
  lastPolledAt?: Date;
  lastPollSummary?: Record<string, number>;
}) {
  await prisma.mailSettings.upsert({
    where: { id: MAIL_ID },
    update: data,
    create: { id: MAIL_ID, ...data },
  });
  forgetMailSettings();
}

/* ------------------------------------------------------------ composition -- */

/** Enough of a person to address a message to them, name them in one, and know
 *  which half of the app they read it in. */
const RECIPIENT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  role: { select: { isMaster: true, permissions: true } },
} as const;

type Recipient = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role: { isMaster: boolean; permissions: string[] };
};

/** Everything a message can say about a ticket, in one selection. The variables
 *  a template is allowed to name are what decides this list. */
const TICKET = {
  id: true,
  number: true,
  reference: true,
  title: true,
  priority: true,
  type: true,
  dueDate: true,
  createdAt: true,
  status: { select: { name: true } },
  assignee: { select: { name: true } },
  reporter: { select: RECIPIENT },
} as const;

type TicketRow = {
  id: string;
  number: number;
  reference: string;
  title: string;
  priority: Priority;
  type: TicketType;
  dueDate: Date | null;
  createdAt: Date;
  status: { name: string } | null;
  assignee: { name: string } | null;
  reporter: Recipient;
};

/** Where this person reads a ticket. A requester has no desk to be sent to, and
 *  a link into one is a link to a page that refuses them. */
function pathFor(recipient: Recipient, ticket: { number: number }) {
  const actor = {
    id: recipient.id,
    isMaster: recipient.role.isMaster,
    permissions: recipient.role.permissions,
  };

  return can(actor, "desk.access")
    ? `/tickets/${ticket.number}`
    : `/portal/requests/${ticket.number}`;
}

/**
 * What a template fills its blanks in from.
 *
 * Every variable the editor offers is answered here, even when the answer is an
 * empty string: a name that is offered in settings and then missing at send
 * time is the failure this feature is most likely to have, and it would surface
 * as a hole in somebody's inbox rather than as anything anyone could debug.
 */
function valuesFor({
  ticket,
  recipient,
  actor,
  mail,
  settings,
  t,
  extra,
}: {
  ticket: TicketRow;
  recipient: Recipient;
  actor: string;
  mail: MailSettings;
  settings: InstanceSettings;
  t: Messages;
  extra?: Record<string, string>;
}): Record<string, string> {
  const locale = dateLocaleOf(settings);

  return {
    "ticket.reference": ticket.reference,
    "ticket.number": String(ticket.number),
    "ticket.title": ticket.title,
    "ticket.url": `${appUrl()}${pathFor(recipient, ticket)}`,
    "ticket.status": ticket.status?.name ?? "",
    "ticket.priority": t.vocab.priority[ticket.priority],
    "ticket.type": t.vocab.type[ticket.type],
    "ticket.due": writeDate(ticket.dueDate, locale),
    "ticket.raised": writeDate(ticket.createdAt, locale),
    "actor.name": actor,
    "recipient.name": recipient.name,
    "requester.name": ticket.reporter.name,
    "assignee.name": ticket.assignee?.name ?? "",
    "desk.name": mail.fromName,
    "desk.url": appUrl(),
    ...extra,
  };
}

/** A date as the desk writes dates, or nothing at all. */
function writeDate(date: Date | null, locale: string) {
  return date ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date) : "";
}

/**
 * Renders one message and puts it on the queue.
 *
 * A kind with no row of its own has never been edited and gets the wording Tiqo
 * ships — which is the whole reason putting a template back to the default
 * deletes the row rather than writing the default text into it.
 */
async function send(
  kind: TemplateKind,
  values: Record<string, string>,
  envelope: { to: string; ticketId?: string | null },
  t: Messages,
  /// A layout that has not been saved yet. Only a test passes one: somebody
  /// redrawing a document is asking what *this* would look like in a real
  /// client, and a test that ignored what is on screen would answer a question
  /// they did not ask.
  draftLayout?: string,
) {
  const [templates, mail, settings] = await Promise.all([
    getMailTemplates(),
    getMailSettings(),
    getSettings(),
  ]);

  const own = templates[kind];
  const wording = own ?? shippedTemplate(kind, t);
  // Everything but the bounce is about a ticket, and the bounce is the one
  // message that must not draw a card for one.
  const withTicket = kind !== "BOUNCE";
  // Both said only where a reply would land somewhere. A marker telling
  // somebody to answer above a line, on a desk whose mailbox nobody reads, is
  // an instruction to write into a void.
  const collects = canCollectMail(mail);
  const replyHint = collects ? t.mail.replyHint : "";
  const replyAbove = collects ? t.mail.replyAbove : "";

  const message = render(wording.body, values);
  const subject = render(wording.subject, values);
  // The desk's sign-off, filled in like the message itself: an address or an
  // opening-hours line is as likely to want the desk's own name in it.
  const signature = render(mail.signature ?? "", values);

  await queueMail({
    to: envelope.to,
    subject,
    // Both halves from the same template and the same values, built here so a
    // message cannot go out laid out one way and read another.
    body: plainDocument({ content: message, values, withTicket, replyHint, replyAbove, signature }),
    html: mailDocument({
      content: renderHtml(wording.body, values),
      // What an inbox list shows beside the subject: the first line of what
      // the message actually says.
      preheader: firstLine(message),
      values,
      brandColor: settings.brandColor,
      withTicket,
      signature,
      subject,
      // The desk's own document where it has drawn one, and the shipped one
      // otherwise — the same rule the wording follows, for the same reason.
      layout: draftLayout ?? own?.html,
      labels: { openTicket: t.mail.openTicket, replyHint, replyAbove },
    }),
    ticketId: envelope.ticketId,
    kind,
  });
}

/**
 * Which message a notification is.
 *
 * A kind missing from here belongs to a feature that has not asked for mail:
 * it is told in the app and nowhere else, rather than sent out under wording
 * nobody has written for it.
 */
const NOTIFICATION_TEMPLATE: Partial<Record<NotificationKind, TemplateKind>> = {
  ASSIGNED: "ASSIGNED",
  FORWARDED: "FORWARDED",
  COMMENTED: "COMMENTED",
  MENTIONED: "MENTIONED",
  APPROVAL_REQUESTED: "APPROVAL_REQUESTED",
  APPROVAL_DECIDED: "APPROVAL_DECIDED",
};

/**
 * The mail beside a notification.
 *
 * Called by `notify()` rather than by each of its call sites, so the two rules
 * that make notifications bearable — never your own doing, never a ticket with
 * nobody on it — govern the mail too, and a call site added later cannot forget
 * it.
 *
 * What was written is deliberately not among the variables these messages may
 * use. A notification is a nudge with a link on it, and a mention can as easily
 * sit inside an internal note as a public reply — a template quoting the body
 * here is how a desk's private conversation reaches the person it is about.
 */
export async function mailNotification({
  userId,
  actorId,
  ticketId,
  kind,
}: {
  userId: string;
  actorId: string;
  ticketId: string;
  kind: NotificationKind;
}) {
  const template = NOTIFICATION_TEMPLATE[kind];
  const mail = await getMailSettings();
  if (!template || !canSendMail(mail)) return;

  const [recipient, actor, ticket, settings, t] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: RECIPIENT }),
    prisma.user.findUnique({ where: { id: actorId }, select: { name: true } }),
    prisma.ticket.findUnique({ where: { id: ticketId }, select: TICKET }),
    getSettings(),
    getMessages(),
  ]);
  if (!recipient?.isActive || !ticket) return;

  await send(
    template,
    valuesFor({
      ticket,
      recipient,
      actor: actor?.name ?? t.notifications.someone,
      mail,
      settings,
      t,
    }),
    { to: recipient.email, ticketId: ticket.id },
    t,
  );
}

/**
 * A public reply, to the person who raised the ticket.
 *
 * The one message that may quote what was written, because that is the whole of
 * its point: a requester should be able to read the answer without signing in.
 * The caller is responsible for only calling it on a public comment — an
 * internal note reaching the person it is about is the worst thing this feature
 * can do, so the condition lives at the call site where the note is written
 * rather than behind a flag passed in here.
 */
export async function mailPublicReply({
  ticketId,
  actorId,
  body,
}: {
  ticketId: string;
  actorId: string;
  body: string;
}) {
  const mail = await getMailSettings();
  if (!canSendMail(mail)) return;

  const [ticket, actor, settings, t] = await Promise.all([
    prisma.ticket.findUnique({ where: { id: ticketId }, select: TICKET }),
    prisma.user.findUnique({ where: { id: actorId }, select: { name: true } }),
    getSettings(),
    getMessages(),
  ]);
  if (!ticket || ticket.reporter.id === actorId || !ticket.reporter.isActive) return;

  await send(
    "ANSWERED",
    valuesFor({
      ticket,
      recipient: ticket.reporter,
      actor: actor?.name ?? t.notifications.someone,
      mail,
      settings,
      t,
      extra: { "comment.body": plainText(body) },
    }),
    { to: ticket.reporter.email, ticketId: ticket.id },
    t,
  );
}

/**
 * "We have it", to somebody who wrote to the desk.
 *
 * The one message sent to the person who caused it, which is why it does not go
 * through `notify()`: every other mail here answers the rule that nobody hears
 * about their own doing, and this one exists precisely to break it. Somebody
 * who writes to a mailbox has no way of knowing whether anything is on the
 * other side of it, and the reference is what lets them chase it later.
 */
export async function mailReceived(ticketId: string) {
  const mail = await getMailSettings();
  if (!canSendMail(mail)) return;

  const [ticket, settings, t] = await Promise.all([
    prisma.ticket.findUnique({ where: { id: ticketId }, select: TICKET }),
    getSettings(),
    getMessages(),
  ]);
  if (!ticket || !ticket.reporter.isActive) return;

  await send(
    "RECEIVED",
    valuesFor({
      ticket,
      recipient: ticket.reporter,
      actor: mail.fromName,
      mail,
      settings,
      t,
    }),
    { to: ticket.reporter.email, ticketId: ticket.id },
    t,
  );
}

/** Where their request has got to. Status is the other thing a requester should
 *  not have to sign in to find out. */
export async function mailStatusChange({
  ticketId,
  actorId,
  status,
  previous,
}: {
  ticketId: string;
  actorId: string;
  /// Both names come from the caller rather than from the row: the caller has
  /// just written the change, and it is the only thing that still knows what
  /// the ticket moved away from.
  status: string;
  previous: string | null;
}) {
  const mail = await getMailSettings();
  if (!canSendMail(mail)) return;

  const [ticket, actor, settings, t] = await Promise.all([
    prisma.ticket.findUnique({ where: { id: ticketId }, select: TICKET }),
    prisma.user.findUnique({ where: { id: actorId }, select: { name: true } }),
    getSettings(),
    getMessages(),
  ]);
  if (!ticket || ticket.reporter.id === actorId || !ticket.reporter.isActive) return;

  await send(
    "STATUS",
    {
      ...valuesFor({
        ticket,
        recipient: ticket.reporter,
        actor: actor?.name ?? t.notifications.someone,
        mail,
        settings,
        t,
      }),
      "ticket.status": status,
      "status.previous": previous ?? "",
    },
    { to: ticket.reporter.email, ticketId: ticket.id },
    t,
  );
}

/**
 * To somebody whose mail the desk will not file.
 *
 * The one message with no ticket behind it, which is why it is the one whose
 * variables are two names and an address.
 */
export async function mailBounce(address: string) {
  const [mail, t] = await Promise.all([getMailSettings(), getMessages()]);
  if (!canSendMail(mail)) return;

  await send(
    "BOUNCE",
    { "sender.address": address, "desk.name": mail.fromName, "desk.url": appUrl() },
    { to: address },
    t,
  );
}

/**
 * What the variables stand for, for somebody editing a template.
 *
 * Filled in from the newest ticket on the desk rather than from invented text,
 * because the question the preview answers is "what will my message actually
 * say" — and a made-up ticket answers a different one. A desk with no tickets
 * yet gets the invented version, which is the only time it is the truthful
 * thing to show.
 *
 * It goes through `valuesFor` like a real send does, so the editor cannot drift
 * from what the sender does with the same template.
 */
export async function previewValues(viewer: { name: string }) {
  const [ticket, mail, settings, t] = await Promise.all([
    prisma.ticket.findFirst({ orderBy: { createdAt: "desc" }, select: TICKET }),
    getMailSettings(),
    getSettings(),
    getMessages(),
  ]);

  if (!ticket) {
    const locale = dateLocaleOf(settings);
    return {
      reference: null,
      values: {
        "ticket.reference": "INC-2609 0001",
        "ticket.number": "1",
        "ticket.title": t.mail.sampleTitle,
        "ticket.url": `${appUrl()}/tickets/1`,
        "ticket.status": t.tickets.noStatus,
        "ticket.priority": t.vocab.priority.MEDIUM,
        "ticket.type": t.vocab.type.INCIDENT,
        "ticket.due": "",
        "ticket.raised": writeDate(new Date(), locale),
        "actor.name": viewer.name,
        "recipient.name": viewer.name,
        "requester.name": viewer.name,
        "assignee.name": viewer.name,
        "desk.name": mail.fromName,
        "desk.url": appUrl(),
        "comment.body": t.mail.sampleTitle,
        "status.previous": "",
        "sender.address": "someone@example.com",
      },
    };
  }

  // The last thing said in public on it, because that is what the one template
  // that quotes a message would be quoting.
  const said = await prisma.comment.findFirst({
    where: { ticketId: ticket.id, isInternal: false },
    orderBy: { createdAt: "desc" },
    select: { body: true },
  });

  return {
    reference: ticket.reference,
    values: valuesFor({
      ticket,
      recipient: ticket.reporter,
      actor: viewer.name,
      mail,
      settings,
      t,
      extra: {
        "comment.body": said ? plainText(said.body) : ticket.title,
        "status.previous": ticket.status?.name ?? "",
        "sender.address": ticket.reporter.email,
      },
    }),
  };
}

/**
 * Markdown as somebody reads it in a mail client.
 *
 * Not a renderer — HTML mail is out of scope. It takes the marks back out of
 * what the editor put in, so a reply does not arrive full of asterisks and
 * bracketed links. The escaping `literal()` adds is undone last, so text that
 * only ever was plain comes out as it went in.
 */
export function plainText(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/(\*\*|__|~~|==|`)/g, "")
    .replace(/\\([\\*_`[\]#>+.)-])/g, "$1")
    .trim();
}

/* ------------------------------------------------------------------ SMTP -- */

/** The transport, built per drain rather than held open: a pool kept across
 *  requests would be a connection to a server whose settings may have been
 *  edited in the meantime. */
async function transportFor(mail: MailSettings) {
  // Imported here rather than at the top of the file so an action that only
  // queues a mail does not pull an SMTP client into its bundle.
  const { default: nodemailer } = await import("nodemailer");

  return nodemailer.createTransport({
    host: mail.smtpHost ?? "",
    port: mail.smtpPort,
    secure: mail.smtpSecure,
    ...(mail.smtpUser ? { auth: { user: mail.smtpUser, pass: mail.smtpPass ?? "" } } : {}),
  });
}

/**
 * The id the message goes out with.
 *
 * Ours rather than the transport's, so it is known before the send and can be
 * stored whatever the server answers — and derived from the row, so a retry of
 * a mail that did in fact arrive carries the same id and is recognised as the
 * same message at the other end.
 */
function messageIdFor(id: string, from: string) {
  return `<${id}@${from.split("@")[1] ?? "tiqo"}>`;
}

/** What went wrong, in the server's own words. A generic failure sends an admin
 *  looking in the wrong place; "535 authentication failed" does not. */
export function reason(error: unknown) {
  const said = error instanceof Error ? error.message : String(error);
  // Some clients throw with an empty message and everything in the name. An
  // empty sentence is the one answer nobody can act on.
  return said.trim() || (error instanceof Error ? error.name : "Unknown mail error");
}

/**
 * Sends everything waiting, one message at a time.
 *
 * A failure is recorded on the row rather than thrown: the next message in the
 * queue has nothing to do with the one that failed, and a drain that stops at
 * the first bad address would never reach it.
 */
export async function drainOutbox() {
  const mail = await getMailSettings();
  if (!canSendMail(mail)) return { sent: 0, failed: 0 };

  // Rows a drain died holding. Nothing else ever leaves a message in SENDING,
  // so anything still there after the timeout is nobody's.
  await prisma.mailMessage.updateMany({
    where: { status: "SENDING", claimedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } },
    data: { status: "PENDING", claimedAt: null },
  });

  const queue = await prisma.mailMessage.findMany({
    where: { direction: "OUT", status: "PENDING", attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  if (queue.length === 0) return { sent: 0, failed: 0 };

  const transport = await transportFor(mail);
  let sent = 0;
  let failed = 0;

  for (const row of queue) {
    // Claimed one row at a time, and the claim is the send permit: two drains
    // that picked the same batch both write this, only one of them changes a
    // row, and the loser leaves the message alone. A queue whose worst failure
    // is sending the same mail twice is not a queue.
    const claim = await prisma.mailMessage.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "SENDING", claimedAt: new Date() },
    });
    if (claim.count === 0) continue;

    const messageId = messageIdFor(row.id, mail.fromEmail!);
    try {
      await transport.sendMail({
        from: { name: mail.fromName, address: mail.fromEmail! },
        to: row.to,
        subject: row.subject,
        // Both halves, as alternatives: the client picks, and one of them is
        // always readable.
        text: row.body,
        ...(row.html ? { html: row.html } : {}),
        messageId,
        // So another desk's autoresponder leaves ours alone, and so ours knows
        // to leave its replies alone in turn.
        headers: { "Auto-Submitted": "auto-generated" },
      });

      await prisma.mailMessage.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          claimedAt: null,
          messageId,
          attempts: { increment: 1 },
          lastError: null,
        },
      });
      sent += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      await prisma.mailMessage.update({
        where: { id: row.id },
        data: {
          attempts,
          claimedAt: null,
          lastError: reason(error).slice(0, 500),
          status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
        },
      });
      failed += 1;
    }
  }

  transport.close();
  // Only on a message that actually left. A drain that failed every row has not
  // shown that sending works, and a green "last sent two minutes ago" over a
  // queue of failures is the most misleading thing this screen could say.
  if (sent > 0) await recordMailRun({ lastSentAt: new Date() });
  return { sent, failed };
}

/**
 * Connects and says whether it worked, without saving anything.
 *
 * Tests what is on screen rather than what is stored, because the whole point
 * is finding out before committing to it — so the draft comes in as an
 * argument, password included.
 */
export async function verifySending(mail: MailSettings) {
  const transport = await transportFor(mail);
  try {
    await transport.verify();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: reason(error) };
  } finally {
    transport.close();
  }
}

/**
 * One message, to whoever asked for it.
 *
 * The same `send` every real notification goes through, filled in from the same
 * example the editor previews with — so a test that arrives looking right is
 * evidence about the template rather than about a second code path written to
 * make tests look good. It goes onto the queue like everything else; the caller
 * drains it, because somebody who presses a button labelled "send me a test"
 * is asking to receive one now.
 */
export async function sendTestMail(
  kind: TemplateKind,
  viewer: { name: string; email: string },
  /// The layout on screen, unsaved. What somebody redrawing a document wants a
  /// test for is the version they are looking at.
  draftLayout?: string,
) {
  const preview = await previewValues(viewer);
  const t = await getMessages();

  await send(
    kind,
    { ...preview.values, "recipient.name": viewer.name },
    // No ticket on the row: a test is not something that happened on the
    // ticket it borrowed its words from, and linking it there would put it in
    // that ticket's thread for good.
    { to: viewer.email },
    t,
    draftLayout,
  );
}
