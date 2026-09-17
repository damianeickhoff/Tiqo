# Attachments — audit

Scope note: attachments now also hang off Docs (migration 20260914150700_docs) and arrive by email (`src/lib/mail-inbox.ts:263,364`).

## 1. Broken / buggy

### Security
1.1 **SVG served inline — stored XSS on the app origin.** `src/lib/attachments.ts:38` `isInlineType` true for any `image/*` incl. `image/svg+xml`; `api/files/[id]/route.ts:58,64` sends `inline`. `attachment-list.tsx:52-68` wraps thumbnails in `<a target=_blank>`. Reachable from email-in by an unauthenticated sender. No CSP anywhere (`next.config.ts` has no headers()). Fix: exclude svg from inline; add CSP on `/api/files/*`.
1.2 HTML/XHTML fine (attachment + nosniff). 1.3 lying mimeType cannot escalate.

### Correctness
1.4 **Aggregate body size not capped.** `file-picker.tsx:128-131` per-file only; `uploadProblem` (`attachments.ts:26-33`) count + per-file only; `next.config.ts:12` caps body at 26 MB. Two 15 MB files → framework stack trace.
1.5 **Failed write silent on tickets/portal.** `files.ts:94-98` swallows, deletes rows, returns `[]`; `actions/tickets.ts:194-203`, `:548-555`, `portal.ts:227,288` ignore the return. `errors.uploadFailed` used only by `docs.ts:308`. No console.error.
1.6 **Missing file on disk → truncated 200.** `files.ts:39-41` lazy stream; route sets Content-Length from row (`route.ts:63`). Stat before streaming → 404.
1.7 No range requests (PDF viewers / video seek).
1.8 Object URLs never revoked (`markdown-editor.tsx:~303`).
1.9 Silent dedupe by `name:size` (`file-picker.tsx:122-126`).

Correct: 404 not 403 everywhere; RFC 5987 filename; nosniff + no-store; path traversal guarded (`files.ts:33`); bytes unlinked on cascade via `purgeUploads` (ticket-ops.ts:312, tickets.ts:699, docs.ts:509); rows deleted on write failure; token swap edge cases; relative-path own-instance img rule; portal caps; delete permission (`actions/attachments.ts:57-62`); ATTACHMENT_REMOVED names uploader; ConfirmDelete; nl complete; download streams; upload buffers (acceptable). Paperclip count includes internal-note files but only on the desk queue — add `where: { comment: { isInternal: false } }` when convenient.

## 2. Plan gaps
- Phase 4: non-image rows lack **uploader and timestamp** and use one generic `FileText` icon (`attachment-list.tsx:9-15, 78-91`).
- Phase 6: paperclip shows count only in `title` (`ticket-row.tsx:344-348`) while the reply indicator beside it shows a number; icon aria-hidden.
- Doc attachments and email-in attachments undocumented in `docs/plans/attachments.md`; `deleteAttachment` branches on `attachment.doc` (`:42-50`) with different permission and no trail.
- `docker-compose.yml` has no app service/files volume (correct for now).

## 3. Overbuilt
- Provider/button/chips split justified.
- `onImageDropped` ref-held callback registry (`file-picker.tsx:50,83,163-165`) — fragile two-way binding; replace with provider state the editor reacts to.
- `AttachButton` `querySelector('input[type="file"]')` reach-around (`:211-213`) — expose `open()` on context.
- `PasteZone` redundant with `DropZone` (fold onPaste in).
- `resolveDraftImages` guarded by `if (uploads.length)` at `tickets.ts:194, :548` → stale `attachment:` token persists; call unconditionally.
- `{from, items}` result tracking duplicates `ConversationComposer`'s `{from, text}` (`ticket-actions.tsx:515-520`).

## 4. Underbuilt
- No progress/pending on big upload (portal). No lightbox. No ticket-level attachments panel (anchoring payoff unclaimed). `object-cover` crops screenshots (`attachment-list.tsx:66`). No resize/EXIF. No attachments on projects. No usage totals.

## 5. Missing useful features
1. Attachments panel on the ticket (all files, newest first, uploader + date).
2. Lightbox with prev/next.
3. Uploader + timestamp on every row.
4. Upload progress with cancel.
5. Server-side thumbnails for images.

## 6. Design / UI
Good: chips/rows/overlay all tokens; overlay absolutely positioned.
Flags: `text-white` literal in `confirm-delete.tsx:84`; delete hover-only (`attachment-list.tsx:121`) unreachable on touch; chip vs row remove diverge; paperclip no number; thumbnail crop; chip name truncates to nothing at 320px (`file-picker.tsx:325-327`); floating remove on thumbnail on `bg-surface` disappears on light images (`attachment-list.tsx:124`); desk composer never shows the attach hint; no broken-image state.

## Top 10
1. Stop serving SVG inline; CSP on `/api/files/*`.
2. Aggregate upload cap client-side (and server-side).
3. Report failed writes (`errors.uploadFailed`) + log.
4. Uploader + timestamp + type icon on attachment rows.
5. 404 when bytes missing.
6. `resolveDraftImages` unconditionally.
7. Delete control reachable without hover.
8. Count beside paperclip; drop aria-hidden.
9. Replace `onImageDropped` registry and `querySelector`.
10. Update `docs/plans/attachments.md` for docs + email-in + dual delete permission.
