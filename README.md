# Tiqo

A ticket system for people who work the queue.

## Running it

Postgres runs in Docker; everything else runs on the host.

```bash
docker compose up -d
```

```bash
npm install
```

```bash
npx prisma migrate dev
```

```bash
npx prisma db seed
```

```bash
npm run dev
```

The app is on http://localhost:3000. Copy `.env.example` to `.env` first if you do not
have one — the defaults match the compose file (Postgres on host port **5433**, so it
does not collide with an existing local Postgres).

### Where attachments live

Uploaded files are written to `TIQO_FILES_DIR`, which defaults to `./var/files`
and is gitignored. Postgres holds only the row describing each one — filename,
type, size, who attached it — so **a database backup on its own is not a
backup**. Whatever copies the database has to copy that directory as well, and a
restore of one without the other leaves a ticket pointing at files that are not
there.

### Mail, in and out

Mail is off until a server is set. **Settings → Mail** holds both halves: what the
desk sends through, and the mailbox it collects replies from. Either can be filled in
without the other, and each has a Test button that connects and reports the server's
own answer without saving anything.

**Both passwords live in Postgres, not in the environment.** There is no
`SMTP_PASSWORD` or `IMAP_PASSWORD` to set and no fallback to one: an admin types them
into Settings → Mail and they are stored on the settings row. Neither is ever sent back
to the browser — the screen says only whether one is set — so anything that backs up the
database backs up the mail credentials with it, and anything that reads the database can
read them. That is the trade, and it is made so a desk can be configured by the person
running it rather than by whoever can restart the container.

Tiqo has no background worker, so **nothing is sent or collected until something calls
the poll route**. It drains the outbox and then the mailbox, and answers with what it
did:

```bash
curl -s -X POST -H "Authorization: Bearer $MAIL_POLL_TOKEN" http://localhost:3000/api/mail/poll
```

Put that on a timer — a cron entry, a systemd timer, an Unraid user script — once a
minute:

```bash
* * * * * curl -fsS -X POST -H "Authorization: Bearer REPLACE_ME" http://localhost:3000/api/mail/poll >/dev/null
```

The token is `MAIL_POLL_TOKEN` in the environment. Without one the route refuses every
call, which is what an instance that has not opted in to being polled should do. Links
in outgoing mail are built from `NEXT_PUBLIC_APP_URL`, so an instance reachable on a
real hostname has to say so there or every mail points at localhost.

**The poll is not only about mail.** It is the only thing in Tiqo that runs on a clock,
so it also sweeps the documentation for pages past their review date and tells the
people who own them. A desk that never configures mail still wants the timer above, or
the review settings in **Settings → Documentation** describe reminders that are never
sent. The stale markers on the pages and the review queue are worked out as they are
read and do not depend on it.

Two things worth knowing about what arrives:

- **A reply finds its ticket by the message id it quotes**, and only failing that by
  the reference in the subject line. Both are stored, so a subject somebody reworded
  still lands on the right ticket.
- **An unknown sender gets a requester account**, because a desk that silently drops
  mail from a new starter is worse than one with an extra account. With sign-ups
  closed in **Settings → General**, those senders are bounced instead.

The requester is mailed about public replies and status changes. **Internal notes are
never mailed to them** — the test for that is on the comment as written, not on what
was asked for.

### What the mail says

Every message has a template, edited on the same settings page. Leave one alone and it
uses the wording Tiqo ships, so an upgrade improves the messages nobody has touched and
leaves the ones somebody has. Putting a message back deletes the row rather than copying
the shipped text into it, which is what keeps that true.

A template is plain text with variables in it — `{{ticket.reference}}`,
`{{requester.name}}`, `{{comment.body}}` — and the editor lists the ones each message
can use, because they differ: a bounce knows no ticket, and only a reply has something
somebody wrote. Clicking one drops it in at the cursor, and the preview underneath fills
the whole thing in with the newest ticket on the desk. A variable the ticket has no
answer for comes out empty rather than as a gap in a sentence, and a variable that does
not exist is refused when you save rather than going quiet in somebody's inbox.

**You write the message; the desk lays it out.** Every mail goes out as a laid-out HTML
half and a plain-text half built from the same template and the same values — the client
picks, and one of them is always readable. Around your words, `src/lib/mail-layout.ts`
adds the band in the instance's brand colour, the card naming the ticket, a button back
into the app, and a footer. That split is what keeps the editor to two fields: rewording
a notification should not mean keeping a layout working in Outlook.

The preview shows the real thing — the HTML in an iframe, the plain half one click away,
both filled in with the newest ticket on the desk. `{{ticket.url}}` points at the desk
or at the portal depending on who is reading it, since a requester has no desk to be
sent to. The reply line and the link in the footer belong to the layout, not to a
template, so nothing can end up saying them twice.

The layout is hand-written table HTML with every style inline, because that is what mail
clients render. It is light-only on purpose: a half-supported dark mode is worse than
none.

### When nothing loads

Every authenticated request looks the session up first, so a database that is not
running surfaces as a Prisma error on `session.findUnique` in `src/lib/auth.ts` —
which reads like an auth bug and is not one. Check the container before the code:

```bash
docker compose ps
```

The compose file gives Postgres a `pg_isready` healthcheck, so a healthy container
says `Up (healthy)`. Anything else — `Exited`, `starting`, or no row at all — means
the app has nothing to talk to. Start it again with:

```bash
docker compose up -d
```

If `docker` itself errors, Docker Desktop is not running; start that first. The
container is set to `restart: unless-stopped`, so it comes back on its own after a
reboot — but not after Docker has been quit.

To watch it come up:

```bash
docker compose logs -f postgres
```

### Demo accounts

The seed creates three people, all with the password `Tiqo!2345`:

| Email              | Role      | Sees                                            |
| ------------------ | --------- | ----------------------------------------------- |
| `admin@tiqo.local` | Admin     | Everything, plus people and projects            |
| `agent@tiqo.local` | Operator  | Every ticket, internal notes, all edit controls |
| `user@tiqo.local`  | Requester | Only tickets they raised, no internal notes     |

On an empty instance the **first account to register becomes the admin**; everyone after
that starts as a requester.

To lay the demo queue down again after poking at it:

```bash
npx tsx prisma/reseed-tickets.ts && npx prisma db seed
```

## What is in it

- **Accounts** — email and password, hashed with bcrypt. Sessions are server-side rows;
  the cookie holds a random token and the database stores only its SHA-256 hash, so a
  database leak does not hand out live sessions. Deactivating someone deletes their
  sessions immediately.
- **Tickets** — a reference of the form `INC-2609 0001` (type prefix, year and month of
  filing, then a counter within that month), title, description, due date. Both the
  reference and the internal number are allocated inside the create transaction, so two
  operators cannot both take the same one.
- **Priorities** — Low, Medium, High, Urgent, each with a response target (168h / 72h /
  24h / 4h) that drives the heat spine.
- **Statuses** — Open, In progress, Blocked, Resolved, Closed.
- **Assignment** to any agent or admin.
- **Comments**, including **internal notes** that requesters never receive — they are
  filtered in the query, not hidden in the browser.
- **Activity trail** — every field change writes an append-only row, rendered as a
  sentence in the ticket timeline.
- **Labels and projects** — each project owns its own numbering and its own label set.
- **Roles** — Requester / Agent / Admin, with a people screen for admins.
- **PWA** — installable, with a bottom tab bar on phones.

### The heat spine

Every ticket row carries a vertical bar. Its colour is the priority; its fill is how far
the ticket has travelled toward the response target that priority promises. A four-hour
urgent and a week-old low therefore read on the same scale, which is what makes the queue
sortable by eye. Anything full is past target, and its age is printed in the priority
colour.

Targets live in one place, `PRIORITY_META` in `src/lib/tickets.ts`.

## Design notes

Brand is **`#febe2e`**. Amber is a warm hue, so the neutral base is warm too — stone
rather than slate — which is what stops the accent looking bolted on. Light and dark
both follow `prefers-color-scheme`; the dark steps are chosen against the dark surface
rather than flipped from the light ones.

Colour has three jobs and they never overlap:

| Role            | Where it appears                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| **Brand amber** | Logo, primary buttons, active nav, focus rings, hero metrics, and the sequential ramp in the pipeline chart |
| **Priority**    | The one categorical palette — teal → indigo → amber → magenta                                               |
| **Status**      | Glyph + label pills in lists; the brand ramp in its own chart                                               |

Every chart palette was checked with the colour-blind validator in the `dataviz` skill,
against both surfaces. Two results worth recording:

- Raw `#febe2e` **cannot** be a data colour on the light surface — 1.62:1 contrast, and
  outside the categorical lightness band. Chart amber is a darker step of the same hue.
- URGENT is magenta, not red. Inside the dark-mode lightness band, amber and red come
  out at ΔE 1.9 under deuteranopia — indistinguishable. Magenta separates cleanly at
  both ends, so the priority ramp stays readable for colour-blind agents in dark mode.

Type is Plus Jakarta Sans (interface) and JetBrains Mono (ticket keys, timestamps,
metrics). Motion is CSS-only — staggered entrances, chart draw-ins, count-ups on the KPI
tiles, hover lifts on cards — and all of it collapses under `prefers-reduced-motion`.

### Charts

`src/components/charts` holds hand-rolled inline SVG — no charting dependency, so both
themes and the animations are under direct control. The dashboard carries: raised vs
resolved over 14 days (crosshair + tooltip), a response-target gauge, the status
pipeline, open tickets by priority with the overdue portion picked out, and workload per
agent. Aggregates come from `src/lib/analytics.ts`, which derives every figure from one
scoped query so the tiles and the charts can never disagree.

## API

`/api/v1` is a real boundary, versioned separately from the UI, and it is where the
TOPdesk sync will attach.

| Method  | Path                   | Notes                                                                      |
| ------- | ---------------------- | -------------------------------------------------------------------------- |
| `GET`   | `/api/v1/me`           | The current user                                                           |
| `GET`   | `/api/v1/projects`     | Projects with their labels                                                 |
| `GET`   | `/api/v1/tickets`      | Filters: `status`, `priority`, `project`, `updatedSince`; cursor paginated |
| `POST`  | `/api/v1/tickets`      | Create                                                                     |
| `GET`   | `/api/v1/tickets/:key` | One ticket                                                                 |
| `PATCH` | `/api/v1/tickets/:key` | Partial update; writes the same activity trail as the UI                   |

Every route applies the same permission rules as the interface — a requester's `GET
/api/v1/tickets` returns only their own tickets.

`Ticket.externalSource` and `Ticket.externalId` are already in the schema, with a unique
constraint on the pair, so an import cannot create the same TOPdesk ticket twice.

**Authentication today is the session cookie.** That is enough for the app and for
same-origin scripting, but not for a machine talking to Tiqo from outside the browser.
Machine tokens are the next thing to build here — see below.

## Not built yet

Deliberate omissions, roughly in the order they will start to hurt:

1. **API keys / machine tokens** — required before TOPdesk can actually call in.
2. **TOPdesk sync itself** — the schema and the API boundary are ready; the mapping and
   the worker are not.
3. **Attachments** — no file uploads.
4. **Full-text search** — the ticket filter matches titles with `ILIKE`, nothing more.
5. **Password reset** — an admin has to intervene. Notably, an account created by an
   inbound mail has no password until one does.
6. **SLA policies per project** — response targets are global per priority.

## Layout

```
prisma/          schema, migrations, seed
src/app/(auth)   sign in and registration
src/app/(app)    the authenticated application
src/app/api/v1   integration boundary
src/lib/actions  server actions — every mutation goes through one of these
src/lib          auth, permissions, ticket vocabulary, validation
```

`src/generated/prisma` is generated output. Run `npx prisma generate` after changing the
schema.
