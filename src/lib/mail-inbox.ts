import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { ParsedMail } from "mailparser";

import { prisma } from "@/lib/prisma";
import { canCollectMail, getMailSettings, getMessages, getSettings } from "@/lib/settings";
import type { MailSettings } from "@/lib/settings";
import { formatReference, referenceBucket, TYPE_PREFIX } from "@/lib/tickets";
import { literal } from "@/lib/markdown-ast";
import { linkBareReferences } from "@/lib/link-references";
import { recordReferences } from "@/lib/record-references";
import { moveOnRequesterReply } from "@/lib/reply-status";
import { notify } from "@/lib/notify";
import { mailBounce, mailPublicReply, mailReceived, reason, recordMailRun } from "@/lib/mail";
import { displayName, uniqueUsername } from "@/lib/accounts";
import { hashPassword } from "@/lib/auth";
import { saveUploads } from "@/lib/files";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_COUNT } from "@/lib/attachments";
import { REPLY_FENCE } from "@/lib/mail-layout";
import { canComment, type Actor } from "@/lib/permissions";

/**
 * Mail in.
 *
 * Its own file rather than the other half of `mail.ts`, for two reasons: the
 * inbound side writes notifications and `notify()` already queues mail, which
 * in one file would be an import cycle; and an IMAP client has no business
 * being bundled into every action that only wants to queue a message.
 *
 * Nothing here runs on its own. The poll route drains the mailbox when
 * something outside the app asks it to — see the README.
 */

/** One drain files at most this many, so a mailbox that has been collecting for
 *  a month does not turn the first poll into an hour-long request. */
const BATCH = 25;

type Outcome = "filed" | "bounced" | "skipped";

/**
 * Collects everything unread, files it, and moves it out of the way.
 *
 * The flag goes on before the move: if the move fails — a folder renamed, a
 * server that will not copy — the message is still marked read and is not filed
 * a second time on the next poll. A message filed twice is a conversation
 * nobody can follow; a message left in the inbox is only untidy.
 */
export async function drainInbox() {
  const mail = await getMailSettings();
  // Things worth saying out loud but not worth refusing a message over — an
  // attachment left behind, say. The poll's answer carries them so whoever set
  // the timer up can see them without reading the server log.
  const problems: string[] = [];
  const counts = { filed: 0, bounced: 0, skipped: 0, problems };
  if (!canCollectMail(mail)) return counts;

  const { ImapFlow } = await import("imapflow");
  const client = new ImapFlow(connectionFor(mail));

  await client.connect();
  try {
    if (mail.archiveFolder) {
      // Cheaper than explaining to an admin why nothing was ever archived.
      // Creating one that exists throws, and that is the expected case.
      try {
        await client.mailboxCreate(mail.archiveFolder);
      } catch {
        // Already there.
      }
    }

    const lock = await client.getMailboxLock(mail.imapFolder);
    try {
      const unseen = (await client.search({ seen: false }, { uid: true })) || [];

      for (const uid of unseen.slice(0, BATCH)) {
        const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!message || !message.source) continue;

        const { simpleParser } = await import("mailparser");
        const parsed = await simpleParser(message.source);

        try {
          counts[await file(parsed, mail, problems)] += 1;
        } catch (error) {
          // One unfileable message must not stop the rest of the mailbox. It
          // stays unread, so the next poll tries again.
          console.error(`[mail] could not file ${parsed.messageId ?? uid}: ${reason(error)}`);
          continue;
        }

        await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        if (mail.archiveFolder) {
          try {
            await client.messageMove(String(uid), mail.archiveFolder, { uid: true });
          } catch (error) {
            console.error(`[mail] could not archive ${uid}: ${reason(error)}`);
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  // The drain got as far as logging out, so the mailbox answered — which is
  // what the health strip means by "collecting". The counts go with it: a poll
  // that filed nothing reads differently from a poll that never ran.
  await recordMailRun({
    lastPolledAt: new Date(),
    lastPollSummary: { filed: counts.filed, bounced: counts.bounced, skipped: counts.skipped },
  });

  return counts;
}

/** Connects and says whether it worked, without saving anything. `verifyOnly`
 *  logs straight back out again, which is the whole of the question. */
export async function verifyCollecting(mail: MailSettings) {
  const { ImapFlow } = await import("imapflow");
  const client = new ImapFlow({ ...connectionFor(mail), verifyOnly: true });

  try {
    await client.connect();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: reason(error) };
  } finally {
    // A verified connection has already closed itself; an unverified one never
    // opened. Either way there is nothing to report from closing it.
    try {
      await client.logout();
    } catch {
      // Already down.
    }
  }
}

function connectionFor(mail: MailSettings) {
  return {
    host: mail.imapHost ?? "",
    port: mail.imapPort,
    secure: mail.imapSecure,
    auth: { user: mail.imapUser ?? "", pass: mail.imapPass ?? "" },
    // The app's own log is not a place for a protocol trace.
    logger: false as const,
  };
}

/* ---------------------------------------------------------------- filing -- */

/**
 * One message, onto a ticket.
 *
 * The order is deliberate: work out who sent it before working out where it
 * goes, because an unknown sender on a desk that does not take unknown senders
 * is a bounce whatever the subject line says.
 */
async function file(parsed: ParsedMail, mail: MailSettings, problems: string[]): Promise<Outcome> {
  const t = await getMessages();

  // Autoresponders. Filing an out-of-office as a reply is how two desks end up
  // talking to each other for a weekend.
  if (isAutomated(parsed)) return "skipped";

  const from = parsed.from?.value?.[0];
  const address = from?.address?.trim().toLowerCase();
  if (!address) return "skipped";

  // Our own mail, come back to us. Nothing good can come of filing it.
  if (address === mail.fromEmail?.toLowerCase()) return "skipped";

  const messageId = messageIdOf(parsed, address);
  // Filed already. The `\Seen` flag goes on after the write, so a poll that
  // dies in between sees this message again — and a ledger the write shares a
  // transaction with is the only thing that can tell the two cases apart.
  const seen = await prisma.mailMessage.findUnique({
    where: { messageId },
    select: { id: true },
  });
  if (seen) return "skipped";

  const sender = await resolveSender(address, from?.name);
  if (!sender) {
    if (await bounceIsDue(address)) {
      await mailBounce(address);
      return "bounced";
    }
    return "skipped";
  }

  const text = stripQuoted(bodyOf(parsed));
  const files = filesIn(parsed, problems);
  const ticket = await threadOnto(parsed);

  // A reference in a subject line is a guess anybody can make, so it decides
  // *which* conversation this is and never *whether* the sender is in it. A
  // stranger quoting somebody else's ticket number gets a ticket of their own:
  // nothing is lost, and nothing leaks either way.
  const envelope = { messageId, from: address, subject: parsed.subject ?? "" };

  if (ticket && mayReply(sender, ticket)) {
    await reply(ticket, sender.id, text, files, envelope);
  } else {
    await raise(parsed, sender.id, text, files, envelope, t.mail.noSubject);
  }

  return "filed";
}

/** What the ledger row for an inbound message is made of: who it came from,
 *  what it called itself, and the id it is remembered by. */
type Envelope = { messageId: string; from: string; subject: string };

function received(envelope: Envelope, text: string) {
  return {
    direction: "IN",
    status: "RECEIVED",
    messageId: envelope.messageId,
    to: envelope.from,
    subject: envelope.subject.slice(0, 200),
    body: text,
  } as const;
}

/**
 * The id this message is remembered by.
 *
 * A client that sends no `Message-ID` is rare and not hypothetical, and a null
 * id is the one value a unique index cannot catch duplicates on. Hashing what
 * the message actually is gives the same message the same id on every poll,
 * which is the whole of what the ledger needs.
 */
function messageIdOf(parsed: ParsedMail, address: string) {
  if (parsed.messageId) return parsed.messageId;

  const digest = createHash("sha256")
    .update(
      [
        address,
        parsed.date?.toISOString() ?? "",
        parsed.subject ?? "",
        parsed.text ?? parsed.html ?? "",
      ].join("\n"),
    )
    .digest("hex");

  return `<${digest}@synthesised.tiqo>`;
}

/**
 * Whether this sender may write on this ticket.
 *
 * The same question the desk asks of a comment typed into the app, plus the two
 * people a ticket is about and anyone already in the conversation — a colleague
 * looped in on a thread is a participant, not an intruder.
 */
function mayReply(sender: Sender, ticket: Threaded) {
  return (
    sender.id === ticket.reporterId ||
    sender.id === ticket.assigneeId ||
    ticket.commenterIds.includes(sender.id) ||
    canComment(sender, ticket)
  );
}

/**
 * Whether this address has been told recently.
 *
 * A bounce is itself a mail, and an address that answers mail automatically
 * answers ours too. Once a day is often enough to be useful to a person who
 * mistyped something and rare enough that two machines cannot keep it up.
 */
async function bounceIsDue(address: string) {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const ledger = await prisma.mailBounce.findUnique({
    where: { address },
    select: { bouncedAt: true },
  });
  if (ledger && ledger.bouncedAt > yesterday) return false;

  await prisma.mailBounce.upsert({
    where: { address },
    update: { bouncedAt: new Date() },
    create: { address, bouncedAt: new Date() },
  });

  return true;
}

/**
 * Where a reply belongs.
 *
 * By message id first: every mail the desk sends stores the id it went out
 * with, and a client that quotes one is telling us exactly which conversation
 * this is. The reference in the subject is the fallback, and it is a fallback
 * rather than the rule because subject lines get edited, forwarded and
 * translated — matching on one alone is what makes other desks file every
 * reply as a new ticket.
 */
async function threadOnto(parsed: ParsedMail) {
  const quoted = [
    ...idsIn(parsed.inReplyTo),
    ...idsIn(Array.isArray(parsed.references) ? parsed.references.join(" ") : parsed.references),
  ];

  if (quoted.length) {
    const sent = await prisma.mailMessage.findFirst({
      where: { messageId: { in: quoted }, ticketId: { not: null } },
      select: { ticketId: true },
    });
    if (sent?.ticketId) {
      const ticket = await loadTicket({ id: sent.ticketId });
      if (ticket) return ticket;
    }
  }

  const reference = referenceIn(parsed.subject ?? "");
  return reference ? loadTicket({ reference }) : null;
}

const TICKET = {
  id: true,
  number: true,
  reporterId: true,
  assigneeId: true,
  statusId: true,
  pausedMinutes: true,
  pausedSince: true,
  // Who has already said something here. Distinct authors rather than every
  // comment, because the question is only ever "is this person in this
  // conversation".
  comments: { select: { authorId: true }, distinct: ["authorId" as const] },
};

type Threaded = {
  id: string;
  number: number;
  reporterId: string;
  assigneeId: string | null;
  statusId: string | null;
  pausedMinutes: number;
  pausedSince: Date | null;
  commenterIds: string[];
};

async function loadTicket(where: { id: string } | { reference: string }): Promise<Threaded | null> {
  const ticket = await prisma.ticket.findUnique({ where, select: TICKET });
  if (!ticket) return null;

  const { comments, ...rest } = ticket;
  return { ...rest, commenterIds: comments.map((comment) => comment.authorId) };
}

/**
 * A reply, as a comment.
 *
 * Public, always: mail has no way to say "internal", and guessing would be the
 * one guess this feature cannot afford to get wrong. The rest of the rules are
 * the ones a reply from the portal already answers to — the references it names
 * go in the trail, the desk hears about it, and a ticket parked on the person
 * who just wrote back comes off the shelf.
 *
 * Blocked words are deliberately not applied. Refusing a comment in the app
 * asks the writer to reword it; refusing one that arrived by mail would make it
 * disappear, which is the one thing a mailbox must never do.
 */
async function reply(
  ticket: Threaded,
  authorId: string,
  text: string,
  files: File[],
  envelope: Envelope,
) {
  const body = await linkBareReferences(literal(text));

  // The ledger row is written with the comment rather than after it: a poll
  // that dies between the two would otherwise either lose the message or file
  // it twice, and a transaction is the only thing that rules out both.
  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: { ticketId: ticket.id, authorId, body, isInternal: false },
      select: { id: true },
    }),
    prisma.activity.create({
      data: { ticketId: ticket.id, actorId: authorId, type: "COMMENTED" },
    }),
    prisma.mailMessage.create({
      data: {
        ...received(envelope, text),
        ticketId: ticket.id,
      },
    }),
  ]);

  if (files.length)
    await saveUploads(files, { ticketId: ticket.id, commentId: comment.id }, authorId);

  if (authorId === ticket.reporterId) {
    const moved = await moveOnRequesterReply(ticket);
    if (moved) {
      await prisma.activity.create({ data: { ...moved, ticketId: ticket.id, actorId: authorId } });
    }
  }

  await recordReferences({ body, actorId: authorId, ticketId: ticket.id });

  await notify({
    userId: ticket.assigneeId,
    actorId: authorId,
    ticketId: ticket.id,
    kind: "COMMENTED",
  });

  // An operator can answer from their own mail client too, and the requester
  // should read that the same way they read one written on the desk.
  await mailPublicReply({ ticketId: ticket.id, actorId: authorId, body });
}

/**
 * A message that threads onto nothing, as a new ticket.
 *
 * It records where it came from: `externalSource`/`externalId` already exist
 * for exactly this, and the unique pair on them means a message filed twice —
 * a poll that overlapped, a mailbox restored from backup — cannot become two
 * tickets.
 */
async function raise(
  parsed: ParsedMail,
  reporterId: string,
  text: string,
  files: File[],
  envelope: Envelope,
  untitled: string,
) {
  const already = await prisma.ticket.findUnique({
    where: {
      externalSource_externalId: { externalSource: "mail", externalId: envelope.messageId },
    },
    select: { id: true },
  });
  if (already) return;

  const settings = await getSettings();
  const title = (parsed.subject ?? "").trim().slice(0, 200) || untitled;
  const description = await linkBareReferences(literal(text));
  const filedAt = new Date();
  const bucket = referenceBucket(settings.defaultType, filedAt);

  const created = await prisma.$transaction(async (tx) => {
    const [counter, sequence] = await Promise.all([
      tx.counter.upsert({
        where: { id: "ticket" },
        update: { value: { increment: 1 } },
        create: { id: "ticket", value: 1 },
        select: { value: true },
      }),
      tx.counter.upsert({
        where: { id: bucket.key },
        update: { value: { increment: 1 } },
        create: { id: bucket.key, value: 1 },
        select: { value: true },
      }),
    ]);

    const status = await tx.status.findFirst({
      where: { isDefault: true },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    const ticket = await tx.ticket.create({
      data: {
        number: counter.value,
        reference: formatReference(settings.defaultType, filedAt, sequence.value),
        title,
        description,
        statusId: status?.id ?? null,
        priority: settings.defaultPriority,
        type: settings.defaultType,
        projectId: settings.defaultProjectId,
        reporterId,
        createdById: reporterId,
        externalSource: "mail",
        externalId: envelope.messageId,
      },
      select: { id: true },
    });

    await tx.activity.create({
      data: { ticketId: ticket.id, actorId: reporterId, type: "CREATED" },
    });

    await tx.mailMessage.create({
      data: { ...received(envelope, text), ticketId: ticket.id },
    });

    return ticket;
  });

  if (files.length) await saveUploads(files, { ticketId: created.id }, reporterId);
  await recordReferences({ body: description, actorId: reporterId, ticketId: created.id });

  // "We have it", to the person who wrote in. A mailbox that answers nothing is
  // one people write to twice and then telephone about.
  await mailReceived(created.id);

  // And the desk hears that something arrived. To whoever works the queue
  // rather than to one person, because nothing raised this way has a name on it
  // yet — and a mailbox nobody notices filling up is the failure this whole
  // feature is meant to prevent.
  const desk = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { is: { OR: [{ isMaster: true }, { permissions: { hasEvery: DESK_WATCHERS } }] } },
    },
    select: { id: true },
  });

  for (const operator of desk) {
    await notify({
      userId: operator.id,
      actorId: reporterId,
      ticketId: created.id,
      kind: "RAISED",
    });
  }
}

/// Who counts as "the desk" for a ticket that arrived with nobody's name on it:
/// somebody who works the queue rather than only their own requests.
const DESK_WATCHERS = ["desk.access", "ticket.view.all"];

/* ---------------------------------------------------------------- people -- */

/**
 * Who wrote it.
 *
 * An unknown address gets an account, because a desk that silently drops mail
 * from a new starter is worse than one with an extra requester in its
 * directory. `Instance.selfRegistration` governs it: a desk that has closed its
 * register page has said it wants its accounts made by hand, and mail is not a
 * way around that — those senders are bounced instead.
 *
 * A deactivated account is treated as unknown and bounced rather than being
 * quietly written back into: deactivating somebody is a decision, and filing
 * their mail as them would undo it.
 */
async function resolveSender(address: string, display?: string): Promise<Sender | null> {
  const known = await prisma.user.findUnique({
    where: { email: address },
    select: SENDER,
  });
  if (known) return known.isActive ? actorOf(known) : null;

  const settings = await getSettings();
  if (!settings.selfRegistration) return null;

  const role = await prisma.role.findFirst({
    where: { isDefault: true },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  const landing =
    role ?? (await prisma.role.findFirst({ orderBy: { position: "asc" }, select: { id: true } }));
  if (!landing) return null;

  const { firstName, lastName } = nameFrom(address, display);

  const created = await prisma.user.create({
    data: {
      email: address,
      username: await uniqueUsername(address),
      firstName,
      lastName,
      name: displayName(firstName, lastName),
      // Nobody signs in with this. The account exists so the mail has an author
      // and the requester has somewhere to read their ticket once an admin has
      // given them a way in.
      passwordHash: await hashPassword(randomBytes(24).toString("base64url")),
      roleId: landing.id,
    },
    select: SENDER,
  });

  return actorOf(created);
}

/** Enough of the sender to ask the permission layer what they may write on.
 *  Their role travels with them because an inbound reply answers to exactly the
 *  checks a comment typed into the app does. */
const SENDER = {
  id: true,
  isActive: true,
  role: { select: { isMaster: true, permissions: true } },
} as const;

type Sender = Actor & { isActive: boolean };

function actorOf(row: {
  id: string;
  isActive: boolean;
  role: { isMaster: boolean; permissions: string[] };
}): Sender {
  return {
    id: row.id,
    isActive: row.isActive,
    isMaster: row.role.isMaster,
    permissions: row.role.permissions,
  };
}

/** A name from the header if there is one, otherwise from the address itself.
 *  "jan.jansen@" reads as Jan Jansen, which is closer than "jan.jansen". */
function nameFrom(address: string, display?: string) {
  const source = (display ?? "").trim() || address.split("@")[0]!.replace(/[._-]+/g, " ");
  const words = source
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1));

  return { firstName: words[0] ?? address, lastName: words.slice(1).join(" ") };
}

/* ----------------------------------------------------------- the message -- */

/**
 * Mail that a machine sent. Filing one as a reply is how two autoresponders
 * spend a weekend talking to each other.
 *
 * Delivery reports are the half that bites hardest: our own bounce goes to an
 * address that does not exist, the report of that comes back here, and without
 * these four tests the desk answers the report with another bounce. A report is
 * recognised by its envelope — an empty `Return-Path`, the `multipart/report`
 * body a DSN is, the header Exim adds, and the two local parts every mail
 * system in the world sends them from.
 */
function isAutomated(parsed: ParsedMail) {
  const submitted = header(parsed, "auto-submitted");
  const local = (parsed.from?.value?.[0]?.address ?? "").split("@")[0]?.toLowerCase() ?? "";
  // `<>` is what a delivery report is sent from, and mailparser hands back an
  // address list for it — one entry with nothing in it.
  const returnPath = parsed.headers.get("return-path");
  const emptyReturnPath =
    typeof returnPath === "object" && returnPath !== null && "value" in returnPath
      ? (returnPath.value as { address?: string }[]).every((one) => !one.address)
      : header(parsed, "return-path").replace(/\s/g, "") === "<>";

  return (
    (submitted !== "" && submitted !== "no") ||
    header(parsed, "x-autoreply") !== "" ||
    header(parsed, "x-autorespond") !== "" ||
    ["bulk", "list", "junk"].includes(header(parsed, "precedence")) ||
    emptyReturnPath ||
    (parsed.headers.get("content-type") as { value?: string } | undefined)?.value ===
      "multipart/report" ||
    header(parsed, "x-failed-recipients") !== "" ||
    ["mailer-daemon", "postmaster"].includes(local)
  );
}

/** One header as plain text. mailparser hands structured headers back as
 *  objects, so anything but a string is not the answer being asked for. */
function header(parsed: ParsedMail, name: string) {
  const value = parsed.headers.get(name);
  return typeof value === "string" ? value.toLowerCase() : "";
}

/** What was written, plain. An HTML-only message is stripped rather than
 *  dropped: a reply nobody can read is still better than no reply. */
function bodyOf(parsed: ParsedMail) {
  if (parsed.text?.trim()) return parsed.text;
  if (!parsed.html) return "";

  return parsed.html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * The desk's own marker, come back to it.
 *
 * Whatever language the sentence between the fences is written in, and whether
 * or not the client prefixed the quoted line with angle brackets or re-wrapped
 * the spacing around it. This is the only cut that is a fact rather than a
 * guess, which is why it is tried first.
 */
const MARKER = new RegExp(`^[>\\s]*${REPLY_FENCE}\\s.*\\s${REPLY_FENCE}\\s*$`);

/**
 * Where the reply stops and the history somebody's client tacked on begins.
 *
 * A guess, and known to be one: every client writes its attribution line
 * differently and every language writes it in its own words. What is here are
 * the shapes a desk in this part of the world actually meets, plus the two
 * separator rules.
 *
 * `From:` and its translations are the loosest of them, and the only ones that
 * could plausibly open a sentence somebody meant to write — so they have to be
 * followed by something address-shaped before they count.
 */
const QUOTED = new RegExp(
  [
    "^>",
    // "On Monday 14 September 2026 at 09:12, Ada Admin wrote:", and the same
    // line as Dutch, German and French clients write it.
    "^On\\b.{0,300}\\bwrote:\\s*$",
    "^Op\\b.{0,300}\\bschreef\\b.{0,120}:\\s*$",
    "^Am\\b.{0,300}\\bschrieb\\b.{0,120}:\\s*$",
    "^Le\\b.{0,300}\\ba écrit\\s*:\\s*$",
    // What Outlook draws between a reply and the thing it answers.
    "^-{2,}\\s*(Original Message|Oorspronkelijk bericht|Ursprüngliche Nachricht)\\s*-{2,}",
    // A header block from a client that pastes the old message's headers.
    "^(From|Van|Von|De)\\s*:\\s*.*[<@]",
    // Separator rules: a line of dashes or underscores and nothing else.
    "^-{2,}\\s*$",
    "^_{5,}\\s*$",
  ].join("|"),
);

/**
 * Everything above the quote.
 *
 * A thread where every message repeats the whole history is a thread nobody
 * reads to the bottom of. What is left after the cut is checked, though: a
 * client that leads with the quote would otherwise file an empty comment, and
 * an over-quoted reply is worth more than a blank one.
 */
function stripQuoted(text: string) {
  const lines = text.split(/\r?\n/);

  // The marker first, and on its own terms: where the desk put one, it is the
  // truth and the guesses below get no say. A quote pattern that happened to
  // match inside somebody's own sentence would otherwise cut the reply in half
  // while the real boundary sat three lines lower.
  const marked = lines.findIndex((line) => MARKER.test(line.trim()));
  const cut = marked === -1 ? lines.findIndex((line) => QUOTED.test(line.trim())) : marked;
  if (cut === -1) return text.trim();

  const kept = lines.slice(0, cut).join("\n").trim();
  return kept || text.trim();
}

/// `INC-2709 0001` anywhere in a subject line, however the client mangled it.
const SUBJECT_REFERENCE = new RegExp(
  `(${Object.values(TYPE_PREFIX).join("|")})[-\\s]?(\\d{4})[-\\s]?(\\d{4})`,
  "i",
);

function referenceIn(subject: string) {
  const found = SUBJECT_REFERENCE.exec(subject);
  return found ? `${found[1]!.toUpperCase()}-${found[2]} ${found[3]}` : null;
}

/** Every `<id>` in a header that may hold several. */
function idsIn(header?: string | string[] | null) {
  const text = Array.isArray(header) ? header.join(" ") : (header ?? "");
  return text.match(/<[^>\s]+>/g) ?? [];
}

/**
 * The files that came with it.
 *
 * Held to the same limits as an upload, and without refusing the message: a
 * mail is not a form, so there is nobody standing there to be told that one of
 * six screenshots was too big. What was left behind is said in the poll's
 * answer instead, which is where somebody can act on it.
 *
 * Two things a form never has to think about. A signature logo is an
 * attachment as far as the format is concerned, so the parts a client marked
 * `inline` or filed under `related` are dropped — a ticket full of everybody's
 * company badge is a ticket nobody scrolls. And the limits are per message as
 * well as per file: ten files each under the cap still add up to more than the
 * request that carries them can hold.
 */
function filesIn(parsed: ParsedMail, problems: string[]): File[] {
  const files: File[] = [];
  let budget = MAX_UPLOAD_BYTES;
  let refused = 0;

  for (const attachment of parsed.attachments) {
    if (attachment.related || attachment.contentDisposition === "inline") continue;
    if (attachment.size <= 0) continue;

    if (files.length >= MAX_UPLOAD_COUNT || attachment.size > budget) {
      refused += 1;
      continue;
    }

    budget -= attachment.size;
    files.push(
      new File([new Uint8Array(attachment.content)], attachment.filename ?? "attachment", {
        type: attachment.contentType || "application/octet-stream",
      }),
    );
  }

  if (refused) {
    problems.push(
      `[mail] ${refused} attachment(s) on ${parsed.messageId ?? "a message"} were over the limit and were not filed`,
    );
  }

  return files;
}
