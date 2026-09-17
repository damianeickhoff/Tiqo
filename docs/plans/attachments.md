# Attachments

> **Built on 14 September 2026.** This page is kept as the record of what was
> decided and why. Four things ended up different from the plan below, each for
> a reason worth knowing:
>
> - **Every attachment is anchored to its ticket**, not to a ticket *or* a
>   comment. A file that came in with a reply carries both ids. Without that,
>   "does this ticket have files" cannot be answered without walking the
>   conversation, and the queue's paperclip needs exactly that answer.
> - **There is no `ATTACHMENT_ADDED` activity.** A file arriving with a comment
>   is drawn inside that comment, the same reason `COMMENTED` is already dropped
>   from the feed. Only removal leaves a trail entry, because only a removal is
>   otherwise invisible.
> - **The size limit is enforced in the picker as well as the action.** A body
>   over Next's own cap is refused by the framework before any of our code runs,
>   so a 30 MB file produced a stack trace rather than a sentence. It is now
>   refused the moment it is picked, and the good files in the same selection
>   are kept.
> - **Downloads are `no-store`.** The first version sent `private, max-age=3600`
>   and a signed-out browser went on serving the file from its own cache.
>   Permission is checked per request, so nothing may outlive it.
>
> A second round, the same day, moved the controls and widened the reach:
>
> - **The paperclip lives in the editor's own toolbar**, beside bold and italic,
>   and the chips sit inside the writing box under what was typed. It was next
>   to the submit button, which read as part of sending rather than part of
>   writing. `AttachmentsProvider` / `AttachButton` / `AttachChips` in
>   `src/components/tickets/file-picker.tsx` are what let the two halves sit
>   apart; a writing box with no provider around it shows no paperclip, which is
>   how the project, article and description editors stay as they were.
> - **Pasting attaches.** A clipboard carrying files is intercepted by the
>   editor and by `PasteZone`, which wraps the plain boxes. Text pastes are
>   untouched.
> - **The portal can attach too** — on a new request and on a reply. `submitForm`
>   takes files the same way `createTicket` does.
>
> A third round added dropping and pictures in the text:
>
> - **Files can be dropped on any composer.** `DropZone` covers the whole box
>   rather than a strip of it, because somebody dragging a file at a box aims at
>   the box.
> - **Pictures go in the text; everything else is listed.** An image carries
>   meaning where it was put, so pasting one into the writing area — or dropping
>   one onto the words — places it there. A zip has nothing to show, and a link
>   buried mid-sentence is worse than a row with a size and a delete control on
>   it. A file picked with the paperclip, or dropped on the composer's chrome
>   rather than on the words, chose no position and is only attached.
> - **A picture placed in the text is not listed underneath as well**, derived
>   from whether the body names it rather than from a column.
> - **Markdown grew an image**, through the whole stack it had to: `Inline` in
>   `markdown-ast`, the node in `markdown-doc`, an `<img>` in `markdown.tsx`, and
>   a hand-rolled Tiptap node in `src/components/editor/inline-image.ts`.
> - **The draft rule survived it.** Nothing is uploaded before Save, so a picture
>   in a draft cannot name an address that does not exist yet: it points at
>   `attachment:<key>`, the keys travel with the files in a parallel field, and
>   the action swaps the tokens for real addresses once the bytes are down. The
>   editor shows an object URL in the meantime, which is never written down.
> A fourth round tightened the edges:
>
> - **Taking a file off the list takes its picture out of the text too**, through
>   one function the writing box lends the list — neither knows anything about
>   the other otherwise.
> - **Removing a file says who put it there**, so whoever has to put it back
>   knows who to ask. Left out when they are the one deleting it.
> - **Every deletion asks first.** `src/components/confirm-delete.tsx` is the
>   shared dialog; the trigger stays with the call site, because a bin in a
>   hovered row and a button in a toolbar are not the same control. Applied to
>   attachments, comments, project comments, trail entries, milestones, roles,
>   operator groups, notices, catalogue sections and change templates. Left
>   immediate on purpose: steps and phases inside a plan editor, blocks in the
>   page builder, blocked words — all of them a keystroke to re-add, and a
>   dialog on each would be an obstacle rather than a safeguard.
>
> - **An `<img>` may only ever point at this instance's own files.** An address
>   from anywhere else renders as its alt text. A comment could otherwise tell
>   every operator who opens the ticket to fetch a stranger's server, which is
>   how a sender learns the desk read their message and roughly from where.
>   Requester text is escaped before it is stored, so nothing typed can become a
>   picture at all; the renderer's rule is the second lock.

Let people attach files to tickets and comments, on the desk and on the portal.
There is nothing of the sort anywhere in Tiqo today — no screenshot of the
error, no log file, no photo of the broken thing. This is the largest hole in
the product and the one with the fewest dependencies.

Read [conventions.md](conventions.md) first.

## Decisions already made

Do not re-open these. They were taken so the work could be handed over.

**Files live on disk, not in Postgres.** A self-hosted desk already mounts a
volume for Postgres; it can mount one more. Bytes in a database make every
backup enormous and every row read expensive. The directory comes from
`TIQO_FILES_DIR`, defaulting to `./var/files` — add it to `.gitignore` and to
`.env.example`, and give it a volume in `docker-compose.yml` when the app itself
is containerised.

**No object storage, no S3 client.** Tiqo runs on one box. A filesystem path is
the whole abstraction; wrapping it in a storage interface with one
implementation is the kind of speculative flexibility `CLAUDE.md` forbids.

**Files upload when the form is submitted, not while you pick them.** The
composer is a form and the project's rule is that nothing is written until Save.
A file input inside the existing `<form>`, read with `formData.getAll("files")`
in the action, means no orphan rows, no separate upload endpoint, and no
half-attached state to clean up. The cost is real and accepted: a large upload
delays the post and there is no progress bar. At a 25 MB cap on a desk's own
network that is a second or two.

**The filename on disk is the row id.** Never the name the browser sent — that
is user input, and a filename is a path traversal waiting to happen. The
original name is a column, used only in the download header.

**Nothing is served from `public/`.** A route handler checks who is asking
before it streams a byte. An attachment on an internal note must not be readable
by the requester the note is about, and a file under `public/` is readable by
the whole internet.

**One size cap, one count cap, no type allowlist.** 25 MB per file, 10 files per
comment or ticket. Anything may be uploaded; everything is served with
`Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` except
images and PDFs, which may render inline. An extension allowlist blocks the log
file somebody actually needed and stops no attacker.

## Schema

```prisma
/// A file somebody attached. The parent is one of two columns rather than a
/// generic owner: an attachment belongs to a ticket or to one comment on it,
/// and a pair of foreign keys says so in a way the database can enforce.
model Attachment {
  id String @id @default(cuid())

  /// What it was called on the machine it came from. Shown, and sent back in
  /// the download header — never used as a path. The file on disk is `id`.
  filename String
  /// What the browser said it was. Trusted for display and for deciding
  /// whether a preview is worth drawing, never for anything else.
  mimeType String
  /// Bytes. Stored so a list of attachments can be drawn without stat-ing the
  /// disk once per row.
  size     Int

  ticketId String?
  ticket   Ticket? @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  /// Set when the file came in with a comment rather than with the ticket
  /// itself. The comment's visibility then governs the file's: an attachment
  /// on an internal note is internal.
  commentId String?
  comment   Comment? @relation(fields: [commentId], references: [id], onDelete: Cascade)

  uploadedById String?
  uploadedBy   User?    @relation(fields: [uploadedById], references: [id], onDelete: SetNull)
  createdAt    DateTime @default(now())

  @@index([ticketId, createdAt])
  @@index([commentId])
}
```

Add the back-relations on `Ticket`, `Comment` and `User`. Cascade is right on
both parents: a deleted comment takes its files, and a deleted ticket takes
everything. **The rows cascade but the bytes do not** — deleting a row must
unlink the file too, which is why deletion goes through one helper.

Migration name: `attachments`.

## Phases

### 1 — Storage helper

New file `src/lib/files.ts`, `import "server-only"`.

- `filesDir()` — reads `TIQO_FILES_DIR`, defaults to `./var/files`, resolved
  absolute.
- `pathFor(id)` — shards on the first two characters of the id
  (`<dir>/ab/abc123…`). One flat directory holding fifty thousand files is a
  directory nobody can list.
- `writeUpload(id, file)` — creates the shard directory, streams the file to
  disk.
- `removeUpload(id)` — unlinks, swallowing "not there".
- `MAX_UPLOAD_BYTES = 25 * 1024 * 1024`, `MAX_UPLOAD_COUNT = 10`.

Verify: a scratch script writes and reads a file through the helper; the shard
directory appears under `var/files`.

### 2 — Download route

`src/app/api/files/[id]/route.ts`. Load the attachment with enough of its parent
to answer the question, then:

- no session, or the viewer fails `canViewTicket` on the parent ticket → 404,
  not 403. A 403 confirms the file exists.
- the attachment hangs off an internal comment and the viewer cannot write
  internal notes (`canWriteInternalNote`) → 404 as well.
- otherwise stream from disk with `Content-Type` from the row,
  `X-Content-Type-Options: nosniff`, and `Content-Disposition: inline` for
  `image/*` and `application/pdf`, `attachment` for everything else. Encode the
  filename in the header rather than interpolating it.

Verify: signed out, the URL 404s. As the requester, an agent's internal-note
attachment 404s while their own file downloads.

### 3 — Accept uploads on a comment

`addComment` in `src/lib/actions/tickets.ts`. After the comment is created:

- read `formData.getAll("files")`, keep the entries that are `File` with
  `size > 0`;
- reject over `MAX_UPLOAD_COUNT` or over `MAX_UPLOAD_BYTES` with a field error
  (`errors.files`), before anything is written;
- create the rows, then write the bytes. If a write fails, delete the rows it
  was for and return a form error — a row pointing at a file that is not there
  is worse than no attachment.

New messages under `errors` in both dictionaries: `fileTooLarge(name, limit)`,
`tooManyFiles(limit)`, `uploadFailed`.

Add the input to the composer in `src/components/tickets/ticket-actions.tsx`
(`ConversationComposer`) and to the reply form in
`src/components/tickets/comment-card.tsx`. Not a bare `<input type="file">`: a
small paperclip button that opens it, and a row of chips naming what has been
picked, each removable before posting. The chips are draft state — nothing is
written until the post.

Verify: post a reply with two images and a text file; all three appear on the
comment. Post one 30 MB file and get a field error with nothing written to disk.

### 4 — Show them

New `src/components/tickets/attachment-list.tsx`:

- an `image/*` attachment renders as a thumbnail that opens the full file; the
  point of the feature is that a screenshot is *visible* without a download;
- everything else is a row: icon by broad type, filename, size, uploader, time;
- a delete control for the uploader and for anyone with `comment.moderate`,
  calling a `deleteAttachment` action that removes the row *and* the file.

Render it under the comment body in `comment-card.tsx`, and under the
description on the ticket page for ticket-level files.

Verify: both themes, a comment with one image and one zip, and a delete that
leaves nothing behind in `var/files`.

### 5 — Attach when raising a ticket

`createTicket` accepts the same field and writes `ticketId` attachments. Add the
input to `src/app/(app)/tickets/new`, to the portal request form
(`src/components/portal/portal-form.tsx`), and to the portal reply composer
(`src/components/portal/portal-reply.tsx`).

Next rejects a server action body over 1 MB by default. Raise it once, in
`next.config.ts`, to one megabyte over the file cap — so the cap a user hits is
ours and the message they get is ours.

Verify: raise a ticket from the portal with a screenshot attached; it is on the
ticket on the desk side, and the requester can see it again on their own request
page.

### 6 — Trail and counts

- `ActivityType.ATTACHMENT_ADDED` and `ATTACHMENT_REMOVED`, with sentences under
  `activity` in both dictionaries. `newValue` carries the filename.
- A paperclip and a count on the queue row
  (`src/components/tickets/ticket-row.tsx`) for tickets that have any. Fold the
  count into the existing ticket list query rather than a second round trip.

Verify: the trail reads properly in English and Dutch; the queue shows the clip.

## Out of scope

Virus scanning, image resizing or thumbnail generation (the `<img>` tag scales
it), drag-and-drop onto the composer, paste-from-clipboard, attachments on
portal articles, a `FILE` kind for portal form fields, and any quota per user or
per instance. Each is worth having; none of them is the hole.
