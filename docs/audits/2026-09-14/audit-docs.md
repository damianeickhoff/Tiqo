# Documentation feature — audit

Headline: well-built; all five phases present; draft rule honoured; every action permission-checked; dictionaries in parity; references wired both ways. Problems are a small set of concrete bugs.

## 1. Broken / buggy (verified)

1. `src/lib/record-references.ts:98-109` — the incoming half of a reference is appended on every save, never reconciled. A doc edited eight times leaves eight `REFERENCED` rows on the ticket's history; `tickets/[number]/page.tsx:179` renders all. (Doc page dedupes by `link` at `[slug]/page.tsx:137-141`, ticket side does not.)
2. `src/lib/actions/docs.ts:610-623` — `publishDoc` creates the PortalArticle then writes `articleId` in two statements, no transaction → duplicate article on retry. (Revision path at :317 is correctly transactional.)
3. `src/lib/docs.ts:99-105` + `src/app/(app)/docs/[space]/layout.tsx:56` — archiving a parent orphans children: layout filters archived rows, `buildTree` promotes orphans to roots (children appear at top of rail); `[space]/page.tsx:77` uses `!parentId` so they vanish on the shelf page. Two contradictory views.
4. `[space]/[slug]/page.tsx:263-271` — `DocCare` gets `canEdit` while `DocArticle` (:203) gets `canEdit && !doc.archivedAt`; `StillCorrectButton` (:175) offered on archived pages.
5. `src/lib/actions/docs.ts:282`, `:529` — `saveDoc` and `restoreRevision` never check `archivedAt` (hidden button, open action). Same for `updateDocCare`/`markReviewed`.
6. `src/components/docs/review-chip.tsx:31-56` — `stale = days <= 0` and always renders `t.docs.stale`; `dueToday` and `overdueBy` strings unreachable.
7. `src/components/docs/doc-care.tsx:53-56` — SaveBar summary shows "Owner" only when owner changed and interval didn't; nothing for interval/parent.
8. `[space]/page.tsx:61` — shelf page selects `body` for every doc in the space to feed `excerptOf` for root cards without summary.
9. `src/lib/actions/docs.ts:164-177` — `uniqueDocSlug` probes with findUnique per attempt, no P2002 catch (house-consistent with `portal.ts:25`).
10. `src/lib/actions/docs.ts:509` — sequential `purgeUploads` per descendant.
11. `src/lib/actions/docs.ts:42-46` + `:431` — `refreshDoc` revalidates the moved doc's path not the viewed one; `updateSpace` (:101) can change key and only calls `refreshSpaces()`.

Checked and fine: permissions on all twelve actions; draft rule; tree cycles refused both sides (`doc-care.tsx:48-51`, `actions/docs.ts:373`); slug scoped unique; restore semantics; republish honours articleId; nl parity; reviewDays 0 = never stale (plan's verify step contradicts schema comment).

Dead i18n: 14 `docs.*` keys unused (`addDoc, blurb, editingHint, eyebrow, filesHint, historyBlurb, inThisSpace, neverReviewed, noFiles, notPublished, reviewedOn, spaceIcon, untitled, yoursTitle`), `errors.noDocView`, and `DocSpace.icon` collected by validator (`validation.ts:256`) but hard-wired null (`space-manager.tsx:213`).

## 2. Plan gaps
- Phases 1–5 complete.
- Space team does nothing: `permissions.ts:240-247` explicitly declines the plan's "team is the default reader" rule; deviation not recorded anywhere. Team is decorative.
- Stale marker missing in global search results (`global-search.tsx:70`) and the reference picker.
- `DocSpace.icon` half-built.

## 3. Overbuilt
- `doc-care.tsx:53-56` summary expression.
- `uniqueDocSlug` duplicates `portal.ts:25` `uniqueSlug`.
- `docs.ts:74-115` `TreeRow`/`TreeNode<T>` generics for one implementation.

## 4. Underbuilt
1. No concurrency protection on `saveDoc:317` (last write wins silently).
2. No move between spaces (`updateDocCare:365-378` scopes parent picker to current space).
3. Rail search title-only client-side (`doc-tree.tsx:57`) while global search covers body.
4. No keyboard flow in the editor (Ctrl+S, Escape, unsaved-changes guard when clicking rail links).
5. No diff between revisions.
6. Shelf page EmptyState has no action for `doc.edit` users.
7. `/docs` landing not paginated/scoped.

## 5. Missing useful features
1. Notify the owner when a page goes stale / someone else edits it.
2. Move a page between spaces.
3. Compare two revisions.
4. Print / single-page view.
5. Pin/favourite a page.
6. Desk-wide review queue (not just `ownerId = me`).

## 6. Design / UI
Good: Card/CardHeader/EmptyState, PanelCard reuse, label/value grid, tokens, color-mix, server-side staleness.
Flags:
1. `doc-tree.tsx:222` chevron `aria-label` is the doc title.
2. `doc-tree.tsx:247` three 20px hover-only controls in the rail (mixed icon rows; unreachable on touch).
3. `doc-tree.tsx:348` inline add field `absolute inset-x-0 z-10` overlays rows.
4. `space-manager.tsx:325` dialog Save always enabled, never confirms (draft rule).
5. `space-manager.tsx:52` bespoke dashed `<p>` instead of EmptyState.
6. `stale-docs.tsx:30` EmptyState with `body=""` renders full py-16 dashed void in a widget.
7. `doc-actions.tsx:170`, `doc-tree.tsx:250` discard action results; no error path for archive/move.
8. `[slug]/page.tsx:156` breadcrumb wrap leaves the action cluster on its own line at narrow width.
9. No literal colours. 10. No loading.tsx anywhere in (app) — consistent.

## Top 10
1. Reconcile doc references instead of appending (`record-references.ts:98`).
2. Make `publishDoc` atomic.
3. Archive the subtree or hide orphans consistently.
4. Gate care card / Still correct / saveDoc / restoreRevision / updateDocCare / markReviewed on `!archivedAt`.
5. Render real review label (overdue by N / due today).
6. Decide space/team question and write it down (`permissions.ts:240`, `documentation.md`).
7. Stop selecting every body on the shelf page.
8. Dirty-gate and confirm the space dialog's Save.
9. Fix chevron label; surface archive/move errors.
10. `updatedAt` precondition on `saveDoc`.
