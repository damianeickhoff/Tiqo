# Ticket relations (links) — audit

Overall: careful implementation; one directed row honoured; both ends permission-checked; dictionaries complete; queue payoffs exist.

## 1. Broken / buggy
1. `src/components/tickets/links-card.tsx:20` — `KINDS` offers only the five forward verbs; "is blocked by" / "child of" cannot be recorded from the ticket you are on. Data model supports it (swap source/target).
2. `tickets/[number]/page.tsx:231-245` vs `:389-392` — Links card omits far ends the viewer can't read; the activity trail on the same page has no such filter (LINKED rows render openable chips).
3. `src/lib/actions/ticket-links.ts:211-239` — `searchLinkTargets` does not exclude merged tickets (cf. `ticket-ops.ts:188`) nor already-linked ones.
4. `ticket-actions.tsx:279-284` — close warning guards only the toolbar Close; setting a settling status from the properties card (`updateTicket`) bypasses it; no server-side check.
5. `schema.prisma:546-550` Cascade + `ticket-ops.ts:293-314` — deleting a ticket leaves the far ticket's LINKED/UNLINKED activity rows pointing at a 404.
6. `ticket-ops.ts:221-289` — merge does not touch links; merged-away ticket keeps its BLOCKS rows (closed → blocked marker silently clears), survivor inherits nothing.
7. `en.ts:973` / `nl.ts:967` — `links.blockedTitle` defined, unused; queue marker (`ticket-row.tsx:239-246`) has aria-label but no title.
8. `ticket-links.ts:145-153` — pre-check + create not in a transaction; concurrent double-add throws P2002 (house-consistent, plan asked for handling).
9. `links-card.tsx:56-63, 118` — one `useTransition` shared by all rows (all X dim); error never cleared after later success.

Checked and fine: canViewTicket both ends via `ends()` (:92-94); self-link (:107); mirror rejection naming existing link (:120-143) both languages; activity both tickets with direction (:54-69, :147-152; `activity.tsx:132-140`); portal filter in `where` (`requests/[number]/page.tsx:142-156`); blocked marker from open BLOCKS only (`tickets/page.tsx:157-162`); blocked filter (:81-89, `filter-bar.tsx:199-212`); close warning latches; revalidation both ends; nl complete; migration matches plan.

## 2. Plan gaps
- Phase 2: `reference-picker.tsx` is a TipTap popover, not reusable → `AddLinkDialog` (`links-card.tsx:142-250`) duplicates the row markup. `ticket-peek` used as click-modal, so link row is not a hyperlink (no middle-click, extra round-trip).
- No seed links; REST API `TICKET_SELECT` (`src/lib/api.ts:77-95`) exposes no links.

## 3. Overbuilt
`Ends` tagged union (:38-44), `entry()` factory (:54-69), duplicated candidate row (`links-card.tsx:206-235` vs `reference-picker.tsx:86-106`) — extract a shared `PickerRow`.

## 4. Underbuilt
1. Inverse verbs unreachable. 2. No "new child ticket" from parent (`tickets/new` takes no parent). 3. No PARENT_OF tree display / grouping by kind (flat by createdAt, `page.tsx:358`). 4. No cycle guard on PARENT_OF. 5. No link count on the queue (`_count` already selected at `page.tsx:164`). 6. Merge dialog doesn't offer "link as duplicate instead". 7. No notification on link (cf. `record-references.ts:89`). 8. No links in REST API.

## 5. Missing useful features
1. Inverse-direction linking. 2. Notify far assignee on BLOCKS. 3. New child ticket from Links card. 4. Link count badge on queue. 5. Group Links card by kind, parent/children as tree.

## 6. Design / UI
Right: tokens only; PanelCard; StatusRing + PriorityBars from glyphs.tsx; empty state consistent with approvals/activity; verb above reference; both themes.
Wrong:
1. Row does not answer "still open": `StatusRing` 14px aria-hidden, no title, no status name. Portal version (`requests/[number]/page.tsx:308-325`) shows a named pill and reads better. Fix: `title={status.name}`, dim/strike settled.
2. Row is a `<button>` opening a modal (:101-108), not an `<a>`.
3. Header Add / row remove are hand-rolled buttons (:70-79, :112-121) not `buttonClass`.
4. `Link2Off` for remove reads like the activity `Link2` icon; house remove is `X`.
5. Reference + title on one line with truncate (:106-107) → title collapses at rail width; no @container breakpoints.
6. No per-row pending state.
7. Picker says "No matches" before first load (:207-208).
8. Queue marker has no tooltip.

## Top 10
1. Inverse verbs in picker (swap source/target in `add()`).
2. Filter LINKED/UNLINKED trail entries by far-end visibility.
3. Close warning on any settling status change (server-side in updateTicket ideally).
4. Row answers "still open" (StatusRing title, dim settled).
5. Row is a real link; peek secondary.
6. Exclude merged and already-linked from picker.
7. Wire `links.blockedTitle` onto queue marker.
8. Notify far assignee on BLOCKS.
9. Picker loading state; per-row pending.
10. Merge carries links to survivor; delete sweeps dangling link activity.
