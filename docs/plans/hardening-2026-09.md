# Hardening the September features

Docs, CMDB, Approvals, Ticket relations, Email and Attachments were built in
the week of 14 September 2026. Six read-only audits were run against them the
same day; the reports are in `docs/audits/2026-09-14/` and this plan is what
came out of them. Read [conventions.md](conventions.md) first, then the six
audit files — every item below cites them and the audits carry the `file:line`
and the reasoning. This page is the order of work and the decisions; the
audits are the evidence.

The verdict, in one paragraph: all six features are well built and on-house.
None is overbuilt to the point of needing a rewrite. Each has a handful of
real defects, two of which are security holes (an inbound mail can write onto
any ticket; an SVG attachment runs script on the desk origin), several have
"hidden button, open action" gaps, and each is missing one or two things a
desk would ask for in its first month.

## Decisions taken while planning

Do not re-open these; they were made so the work could be handed over.

- **Documentation spaces stay readable by everyone with `doc.view`.** The
  original plan wanted a space's team to be the default reader. The
  implementation declined that on purpose (`src/lib/permissions.ts:240`) and
  the decision is right for a desk of this size — record it in
  `documentation.md` rather than build it.
- **A refused phase approval holds that phase; a refused whole-ticket approval
  cancels the change; a refusal on a non-change ticket only records itself.**
  Today every refusal cancels the whole ticket and skips every step.
- **Being named as approver is a view right.** `canViewTicket` treats the
  approver of any round on the ticket like the reporter.
- **An inbound reply from someone who may not comment on the thread becomes a
  new ticket**, not a comment and not a bounce. Nothing is lost and nothing
  leaks; the existing new-ticket rules (self-registration, bounce) apply.
- **SVG is never inline.** Files are served with a `sandbox` CSP as the second
  lock.
- **The CMDB column picker, the four relation verbs and the editable mail
  templates stay.** Removing built, working things is churn. Two
  simplifications are taken instead (below).
- **No new per-team mailboxes, no approval-by-email, no discovery, no
  collaborative editing, no thumbnails service.** Still out of scope.

## Order of work

Three tiers. Finish A before touching B; finish B before C. Inside a tier the
phases are independent and can be done in any order. Every phase ends with
`npm run lint`, a clean `tsc` (see the heap note below), and the verify step
exercised in the browser as the roles named.

Migrations: several phases add enum values or a table. Before every
`prisma migrate dev`, run
`npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
and read it; another session shares this tree and its half-finished schema
edits must not end up in your migration. Merge the enum additions of A3, A4
and C-phases into as few migrations as practical — one per tier is fine.

`tsc` on this machine: `NODE_OPTIONS=--max-old-space-size=3072 npx tsc --noEmit`.
Check the exit code; a crashed tsc prints nothing.

The dev server on port 3210 belongs to whoever started it; attach to it. If
it is down, start `tiqo-3211` from `.claude/launch.json`. The browser profile
is shared too — sign in as the role you need and expect it to change under you.

---

# Tier A — security and correctness

## A1 — Email: authorise and de-duplicate inbound mail

Audit: `audit-email.md` §1.1–1.4, 1.6–1.8.

- `reply()` in `src/lib/mail-inbox.ts` must check the sender before writing:
  reporter, assignee, someone who has already commented on the ticket, or
  `canComment(user, ticket)`. Anyone else falls through to `raise()` as a new
  ticket (decision above).
- Store every inbound `Message-ID` that was filed as a comment. Smallest
  honest shape: a `MailMessage` row with a new `direction` (`IN` / `OUT`) —
  or, if that muddies the outbox, a two-column `MailSeen` table. Skip a
  message whose id is already there. Then the `\Seen` flag and the move to
  `Processed` cannot cause a duplicate comment.
- A mail with no `Message-ID` gets one synthesised from a hash of
  `from + date + subject + body`, so the `externalSource`/`externalId` pair
  actually bites.
- Bounce loop: `isAutomated` also returns true for `Return-Path: <>`,
  `Content-Type: multipart/report`, `X-Failed-Recipients`, and a
  `MAILER-DAEMON` / `postmaster` local part. Bounce a given address at most
  once per day (a `bouncedAt` on the seen-ledger row is enough).
- Skip `related` / `contentDisposition === "inline"` attachments (signature
  logos), and cap the total bytes of one message's attachments at
  `MAX_UPLOAD_BYTES` — refuse the rest with a warning in the poll report.
- Outbox: claim rows before sending (`status: SENDING`, set in one
  `updateMany`), so two drains cannot both send the batch.

Verify: reply to a Tiqo mail from an address that is not on the ticket and
see a new ticket, not a comment. Poll twice with the same unread message and
see one comment. A DSN in the inbox produces no bounce.

## A2 — Attachments: SVG, caps, silent failures

Audit: `audit-attachments.md` §1.1, 1.4–1.6.

- `isInlineType` in `src/lib/attachments.ts` excludes `image/svg+xml` and
  `image/svg`. The download route adds `Content-Security-Policy: sandbox`.
- Aggregate size: the picker refuses a selection whose total would exceed
  `MAX_UPLOAD_BYTES` (keep the good files, as it already does per file), and
  `uploadProblem` enforces the same total server-side.
- A failed write returns `{ errors: { files: t.errors.uploadFailed } }` from
  `addComment`, `createTicket`, `submitForm` and the portal reply, and logs
  the swallowed error in `files.ts`.
- The download route stats the file before sending headers; missing bytes are
  a 404.
- Call `resolveDraftImages` unconditionally so a stale `attachment:` token can
  never be stored.

Verify: an SVG attachment downloads instead of opening. Two 15 MB files are
refused in the picker with a sentence. Delete a file from `var/files` by hand
and its link 404s.

## A3 — Approvals: races, scope of a refusal, who may see

Audit: `audit-approvals.md` B1–B8, B10, B11.

- `respondToApproval` and `cancelApproval` write with
  `updateMany({ where: { id, state: "PENDING" } })` and stop when nothing
  matched.
- Scope the refusal (decision above): `approval.phase` null and
  `ticket.type === "CHANGE"` → cancel the change as today; phase set → the
  gate holds and nothing else changes; not a change → record only. Stop
  writing `closedAt` on a cancelling status. Re-read the ticket's status
  inside the transaction.
- `copyPlanOnto` in `src/lib/actions/steps.ts` validates template approvers
  against `APPROVER_ROLE_FILTER`; an approver who no longer qualifies is
  skipped and a trail row says so. Use a `Set` for the people to notify.
- Superseding and withdrawing a round write `APPROVAL_CANCELLED` and notify
  the person who was asked.
- `canViewTicket` grants the approver of any round on the ticket.
- Add `APPROVAL_REQUESTED` and `APPROVAL_DECIDED` to `NOTIFICATION_TEMPLATE`
  in `src/lib/mail.ts` and to `TemplateKind`, with shipped wording in both
  dictionaries and a deep link to the ticket (portal link for a requester).

Verify: approve twice fast and see one trail entry. Refuse a phase approval
and see only that phase locked. Sign in as an approver without
`ticket.view.all` and open the ticket from the dashboard widget.

## A4 — CMDB: visibility, re-typing, the ITEM kind

Audit: `audit-cmdb.md` §1.1–1.7.

- Apply `ticketVisibilityFilter` in `cmdb/[id]/page.tsx`, `cmdb/page.tsx` and
  `src/lib/ticket-assets.ts`.
- One definition of open: `status: { is: { settles: false } }`.
- Re-typing: remove the type selector from the item editor. Changing an
  item's type is rare and destructive; it is not a draft field.
- `ITEM` kind: a picker in the editor (reuse the relate dialog's search),
  `options[0]` as the target type key exposed in the type manager for ITEM
  fields, and `parseAttributes` verifies `USER` and `ITEM` ids exist and
  `DATE` values parse. Required fields are enforced on import as well.
- Existence checks before `updateCiItem`, `updateCiType`, `deleteCiField`,
  `deleteCiItem`; `deleteCiItem` writes a trail row and the confirm dialog
  names what depends on the item. `removeTicketCi` writes history only when
  it removed something.

Verify: an agent without `ticket.view.all` sees no foreign ticket titles on an
asset. A type with one field of every kind round-trips, including ITEM.

## A5 — Docs: references, atomic publish, archived pages

Audit: `audit-docs.md` §1.1–1.5.

- `record-references.ts` reconciles the incoming half on every save: add rows
  for new targets, remove rows for dropped ones, never re-append an existing
  one.
- `publishDoc` creates the article and writes `articleId` in one transaction.
- Archiving archives the subtree (`archivedAt` on every descendant, cleared
  together on unarchive); the shelf page and the rail then agree.
- Everything that edits a document checks `archivedAt` in the action:
  `saveDoc`, `restoreRevision`, `updateDocCare`, `markReviewed`. The care
  card and Still correct are hidden on archived pages.
- `saveDoc` takes the `updatedAt` the editor loaded and refuses when it has
  moved, with an error that says who saved in between.

Verify: edit a doc that mentions a ticket eight times; the ticket shows one
reference. Two tabs edit the same doc; the second save is refused.

## A6 — Ticket relations: what the trail leaks, what close misses

Audit: `audit-links.md` §1.2–1.6.

- Filter `LINKED` / `UNLINKED` trail rows on the ticket page by far-end
  visibility, the way the Links card already does.
- The still-blocking warning fires for any change to a settling status —
  server-side in `updateTicket`, returning a `warn` the properties card shows
  once, the same latch the toolbar uses.
- The picker excludes merged tickets and tickets already linked.
- Merge carries links to the survivor (re-pointing both ends, dropping ones
  that would now be self-links or duplicates) and writes trail rows. Delete
  removes the far tickets' `LINKED`/`UNLINKED` rows that point at the dead
  number.

Verify: an agent without `ticket.view.all` sees no chip to a foreign ticket in
the trail. Change a blocker's status from the rail to Closed and get the
warning.

---

# Tier B — plan gaps, house rules and design

## B1 — Draft rule violations

- `src/components/settings/plan-editor.tsx`: name, description and the
  approver become one draft with a `SaveBar` (dirty-gated, confirms). Phase
  approvers likewise, per phase or in the same draft.
- `src/components/settings/space-manager.tsx`: the space dialog's Save is
  enabled only when dirty and confirms.
- `src/components/cmdb/ci-editor.tsx`: the SaveBar gets a Cancel.

## B2 — Plan bullets never built

- CMDB: asset picker on the new-ticket form writing `TicketCi`; seed
  `TicketCi` rows (three incidents on one server) and enough items to see the
  register working.
- Approvals: `approvals` in `DEFAULT_WIDGETS`; the approve/refuse prompt also
  on `/tickets/N/plan` and the step page; `question` required when a person
  asks (template rounds keep the gate name as their question and say so).
- Attachments: uploader, time and an icon by broad type on every non-image
  row; the count beside the queue paperclip, not only in a title.
- Links: `t.links.blockedTitle` on the queue marker; seed two links.
- Docs: record the space-team decision in `documentation.md`; delete the
  dead `docs.*` dictionary keys and `DocSpace.icon` plumbing.
- Email: a `RECEIVED` template sent when a mail raises a ticket, and
  `notify()` the desk that one arrived; README and `.env.example` say the
  mailbox password lives in Postgres.

## B3 — Design pass, one component at a time

Use `src/components/tickets/panel-card.tsx` for every rail card, `Button` /
`buttonClass` for every control, `FormError` for every error, tokens only.

- Links card: the row is an `<a>` to the ticket with the peek as a secondary
  affordance; `StatusRing` gets a `title` and settled rows dim; reference and
  title on two lines at rail width; `X` for remove; per-row pending; the
  picker shows a searching state before its first result.
- Approvals: one CSS class for the brand callout instead of three inline
  styles; Withdraw is a `Button`; `decidedAt` shown on every decided round;
  the whole-ticket gate reads "this change has not been approved"; the
  portal card renders the description through `<Markdown>`; portal page
  slices after the pending/answered split; per-row errors.
- CMDB: replace the three hand-rolled card headers with `PanelCard`; two
  empty states (fresh register with an action, filtered with none); a
  `loading.tsx` under `cmdb/`; search box gets a submit affordance; `clear()`
  empties the search box; pickers show the type glyph (select `icon` in
  `searchCiItems`); the import mapping stops resetting on every keystroke
  and warns on duplicate targets; column sort on name, type, lifecycle and
  any DATE/NUMBER column.
- Docs: chevron `aria-label` says expand/collapse; the three rail hover
  controls become one menu that is reachable on touch; the inline add field
  no longer overlays rows; `stale-docs.tsx` and the shelf page use the
  one-line empty state and offer an action to editors; archive/move surface
  errors; review chip renders "due today" / "overdue by N days".
- Attachments: delete control visible without hover; `object-contain`
  thumbnails on a `bg-surface-2` tile; remove button on a thumbnail gets a
  scrim; chip name keeps `max-w-[14rem]`; the desk composer shows the
  paste/drop hint once; `confirm-delete.tsx` drops its `text-white` literal.
- Email settings: a dirty collapsed template row is marked and cannot be
  collapsed silently; the preview debounces 300 ms; a paper-coloured gutter
  frames the light preview; `useShipped` and the preview toggle use
  `buttonClass`; the Test result clears on edit; both TLS checkboxes carry a
  hint; the poll URL gets a copy control; `pollTokenMissing` is muted until a
  host is set; drop the `unknownTokens` save refusal.

## B4 — Small simplifications

- Fold `PasteZone` into `DropZone`; replace the `onImageDropped` ref registry
  with provider state; expose `open()` on the attachments context instead of
  `querySelector`.
- Extract one `PickerRow` used by the links dialog and the reference picker.
- Remove the unreachable standing-refusal ledger in `src/lib/approvals.ts`
  and inline `isOpen`; one query for the portal banner and badge.
- Cap `CiTickets` at 50 with a "show all"; load `people` on the item page only
  when the type has a `USER` field; stop selecting every `body` on the docs
  shelf page.

---

# Tier C — the features a desk asks for first

Each is a small phase. Build in this order; stop when the tier is done or the
user says stop.

## C1 — Mail log with resend

Settings → Mail → Recent: the last 50 `MailMessage` rows with direction,
recipient, subject, ticket reference (linked), status, attempts, `lastError`,
and a Resend command on `FAILED` rows that puts them back to `PENDING`.
List-level, immediate.

## C2 — Reply-above-this-line

A localised marker line in every outbound mail (`mail-layout.ts`), and
`stripQuoted` cuts on it first. Then extend `QUOTED` for `Op … schreef:`,
`Am … schrieb:`, `Von:`, `De:`, `-----Original Message-----`,
`-----Oorspronkelijk bericht-----`; require `From:` / `Van:` to be followed by
something that looks like an address.

## C3 — Links that point both ways

The picker offers all ten readings and swaps source/target for the inverse
five. A "New child ticket" action on the Links card opens `/tickets/new` with
`?parent=N`, pre-filling project, team and requester, and writes `PARENT_OF`
on save. The card groups rows by kind, parent and children first. Linking
`BLOCKS` notifies the far ticket's assignee.

## C4 — Approvals: ask again, and a desk queue

- "Ask again" on a refused round: pre-filled with the question and the gate,
  and for a whole-ticket refusal it also moves the change out of Cancelled
  and reopens the skipped steps, writing the trail.
- `/approvals` on the desk behind `approval.request`: every round, filterable
  by state and approver, overdue first.

## C5 — Attachments panel

A Files card in the ticket rail listing every attachment on the ticket,
newest first, with uploader and date, hidden internal-note files for those
who cannot read notes. Clicking an image opens a modal lightbox with
previous/next across the ticket's images.

## C6 — CMDB: where it earns its keep

- CSV export of the current register view (same columns, same filters).
- Assets in global search.
- An "Expiring soon" dashboard widget: any DATE attribute within 30 days,
  across types, linked to the item.
- Bulk edit: select rows in the register, set lifecycle or operator group.
- A dependants warning before retiring or deleting an asset.

## C7 — Docs: move, notify, compare

- Move a page (and its subtree) to another space, from the care card.
- Notify the owner when someone else saves their page
  (`NotificationKind.DOC_EDITED`), and once when it goes stale — the stale
  sweep runs from the mail poll route, which is the only scheduled entry
  point the app has.
- Compare any two revisions side by side, changed lines marked.

---

## Not doing

Upload progress bars (server actions cannot report them), server-side image
thumbnails, EXIF stripping, per-user mail preferences, CC handling, sending a
free-form mail from a ticket, PARENT_OF cascading behaviour, a topology
diagram, real-time editing, and a `FILE` field kind on portal forms. Each is
worth its own plan when somebody asks.
