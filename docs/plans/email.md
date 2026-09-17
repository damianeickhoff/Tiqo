# Email — in and out

Tiqo cannot send or receive mail. There is no SMTP client, no IMAP client, and
`src/lib/notify.ts` writes rows nobody sees unless they are already looking at
the app. Mail is what turns a ticket database into a service desk: people raise
things by writing to an address, and they find out what happened without logging
in.

Read [conventions.md](conventions.md) first, and build
[attachments.md](attachments.md) before this — mail carries files, and an
importer with nowhere to put them is half an importer.

## Open question to settle before phase 3

**Where mail credentials live.** This plan stores them in the database so the
settings screen can own them, which means anyone with the database has the
mailbox password. If that is unacceptable for your deployment, make each field
fall back to an environment variable and hide the ones that are set from the
environment. Decide before writing the settings screen; everything else in the
plan is unaffected.

## Decisions already made

**`nodemailer` out, `imapflow` in.** Both are the boring, maintained choice for
a self-hosted Node app. No transactional-email SaaS: a desk that must reach an
internal-only relay cannot use one, and the ones that can already have an SMTP
host to point at.

**Inbound is polled, not pushed.** Next.js has no background worker and this
project is not adding a process model for one. A route handler at
`/api/mail/poll`, guarded by a shared secret in `MAIL_POLL_TOKEN`, drains the
mailbox when something calls it. A cron entry, a systemd timer or an Unraid user
script calls it every minute. Document that in the README; a feature whose
operating instructions are missing is not finished.

**Threading is by `Message-ID` first, reference second.** Store the `Message-ID`
of every message Tiqo sends. An inbound mail whose `In-Reply-To` or `References`
names one of them is a reply on that ticket. Failing that, match the ticket
reference in the subject (`INC-2709 0001`, the format in
`src/lib/tickets.ts`). Failing both, it is a new ticket. Subject-line matching
alone is what makes other desks file a reply as a new ticket every time someone
edits the subject.

**An unknown sender gets a requester account.** A desk that silently drops mail
from a new starter is worse than one with an extra account. Honour
`Instance.selfRegistration`: with it off, unknown senders are rejected with a
bounce rather than filed.

**Outbound mail is queued, not sent inline.** A server action must not wait on a
remote SMTP handshake, and a mail that fails must be retried rather than lost. A
`MailMessage` table is the queue; the same poll route drains it.

## Schema

```prisma
/// How this instance talks to a mail server. One row, like `Instance`.
model MailSettings {
  id String @id @default("mail")

  /// Sending. Off until a host is set — an instance with no mail server
  /// configured must behave exactly as it does today, not fail loudly.
  smtpHost   String?
  smtpPort   Int      @default(587)
  smtpSecure Boolean  @default(false)
  smtpUser   String?
  smtpPass   String?
  /// What the desk signs its mail as. Separate from the mailbox it collects
  /// from: plenty of desks send as `support@` and collect from somewhere else.
  fromName   String   @default("Service desk")
  fromEmail  String?

  /// Collecting.
  imapHost   String?
  imapPort   Int      @default(993)
  imapSecure Boolean  @default(true)
  imapUser   String?
  imapPass   String?
  /// Where drained mail goes. Deleting it outright leaves no way to work out
  /// why something was filed the way it was.
  imapFolder String  @default("INBOX")
  archiveFolder String? @default("Processed")

  updatedAt DateTime @updatedAt
}

enum MailStatus {
  PENDING
  SENT
  FAILED
}

/// One outbound message. A queue rather than a direct send: an action that
/// waits on a remote handshake is an action that times out, and a mail that
/// fails on the first attempt is usually one that succeeds on the second.
model MailMessage {
  id      String     @id @default(cuid())
  to      String
  subject String
  body    String
  status  MailStatus @default(PENDING)
  /// The header of the message as sent, so a reply that quotes it can be
  /// threaded back onto the right ticket.
  messageId String?  @unique
  attempts  Int      @default(0)
  lastError String?

  ticketId String?
  ticket   Ticket? @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  sentAt    DateTime?

  @@index([status, createdAt])
}
```

Also add to `Ticket`: nothing. An emailed ticket already records its origin
through `externalSource`/`externalId` — use `externalSource = "mail"` and the
inbound `Message-ID` as `externalId`, which the existing unique pair turns into
free protection against filing the same mail twice.

Migration name: `mail`.

## Phases

### 1 — Settings screen

`src/app/(app)/settings/mail/page.tsx`, behind a new `settings.mail`
permission. Two cards, sending and collecting, each with a **Test** button that
connects and reports back without saving. Fields are a draft; Save commits.

Verify: saving against a real or local SMTP catcher (`MailHog`, `smtp4dev`)
reports success, and a wrong password reports the server's own error rather than
a generic failure.

### 2 — Send

`src/lib/mail.ts`: `queueMail({ to, subject, body, ticketId })` writes a row;
`drainOutbox()` sends every `PENDING` row, stamping `messageId` and `sentAt`,
recording `lastError` and incrementing `attempts` on failure, and giving up at
five attempts.

Verify: queue three mails with the server down, bring it up, drain, and see all
three delivered with `attempts` recorded.

### 3 — Notify by mail

Every call site of `notify()` in `src/lib/notify.ts` also queues a mail, subject
to two rules that already govern notifications — never tell someone about their
own doing, never about a ticket with nobody on it — and one new one: **the
requester hears about public comments and status changes, never about internal
notes.** Getting that wrong leaks the desk's private conversation to the person
it is about, so make it the first thing you test.

Templates live in the dictionaries so they are written in the desk's language.
Every mail ends with the ticket reference and a link.

Verify: as an agent, post a public reply and an internal note on a ticket whose
requester is someone else. One mail, not two.

### 4 — Collect

`drainInbox()` in `src/lib/mail.ts`, called by the same poll route:

- connect, fetch unseen mail from `imapFolder`;
- thread it: `In-Reply-To`/`References` against `MailMessage.messageId`, then
  the reference in the subject, then new ticket;
- resolve the sender to a `User`, creating a requester if allowed;
- strip the quoted reply — everything below the first `On … wrote:` or `--`
  line. A thread where every message repeats the whole history is unreadable;
- write a comment (or a ticket), attachments included, using the existing
  `addComment` path where it can be reused rather than a second copy of the
  rules about blocked words, references and reply-status;
- move the message to `archiveFolder`.

Verify: reply to a Tiqo mail from a real client with a file attached — it lands
as a comment on the right ticket with the attachment, the quote is gone, and a
`waiting on user` status moves back via `onReplyStatusId`.

### 5 — The poll route

`src/app/api/mail/poll/route.ts`: compares a bearer token against
`MAIL_POLL_TOKEN`, runs `drainOutbox()` then `drainInbox()`, returns counts.
Refuses to run two at once. README section on how to call it.

Verify: `curl` with the wrong token 401s; with the right one it reports what it
did.

## Out of scope

HTML mail composition (send plain text, generated from the markdown body),
DKIM signing, per-team mailboxes, mail templates editable in the UI, and a
digest mode. Add the second mailbox only once one desk has asked for it.
