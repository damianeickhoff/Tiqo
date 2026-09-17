# CMDB audit — Tiqo

Overall: this is a genuinely well-built feature. The schema matches the plan almost exactly (owner correctly dropped), the draft rule is respected everywhere it applies, both dictionaries are complete, the register list is not N+1, filters live in the URL, pagination exists, and the comments read like the rest of the codebase. The problems are concentrated in four places: ticket visibility, re-typing an item, the `ITEM` field kind, and the import's ergonomics.

## 1. Broken / buggy

**1.1 Ticket visibility is never applied in the CMDB — information leak.** `src/app/(app)/cmdb/[id]/page.tsx:101` lists every `TicketCi` row with title, reference, priority and status; `src/app/(app)/cmdb/page.tsx:82` counts them. Neither applies `ticketVisibilityFilter` (`src/lib/permissions.ts:92`), nor does `src/lib/ticket-assets.ts:32`. A user holding `ci.view` but not `ticket.view.all` reads the titles of every ticket raised against an asset.

**1.2 Three different definitions of "open".** `src/lib/ticket-assets.ts:22` uses `status: { isNot: { settles: true } }`; `src/app/(app)/cmdb/page.tsx:82` uses `status: { is: { settles: false } }`; `src/app/(app)/cmdb/[id]/page.tsx:155` sorts on `settles ?? false`. `Ticket.statusId` is nullable. Every other call site (14) uses `is: { settles: false }`.

**1.3 Re-typing an item wipes its attributes and shows the wrong form.** `src/components/cmdb/ci-editor.tsx:147` lets you change `typeId` in the draft, but `fields` is a prop from the old type and `useDraft` is initialised once (`ci-editor.tsx:84`, no `key` on the component at `[id]/page.tsx:182`). `attributesFrom` (`ci-editor.tsx:48`) builds values for the old type's keys, and `updateCiItem` validates against the new type (`src/lib/actions/cmdb.ts:351`), where `parseAttributes` drops every unknown key. Silent total attribute loss.

**1.4 `updateCiItem` does not check the type exists.** `createCiItem` does (`cmdb.ts:313`); `updateCiItem` (`cmdb.ts:338`) does not. Same for `updateCiType` (`cmdb.ts:151`) and `deleteCiField` (`cmdb.ts:246`). A stale tab produces an unhandled Prisma error/500 rather than `{ errors }`.

**1.5 The `ITEM` field kind is not implemented end-to-end.** `AttributeField` (`ci-editor.tsx:227`) falls through to a plain text `Input` at `:307` for ITEM — set by pasting a raw cuid. Read side (`ci-table.tsx:186`, `cmdb/page.tsx:143`) is complete. Schema says `options` holds the type key for ITEM but `FieldRow` only exposes options for CHOICE (`ci-type-manager.tsx:357`).

**1.6 No referential validation on `USER` / `ITEM` values.** `parseAttributes` (`src/lib/cmdb.ts:124`) coerces with `String(given)` — no existence check, no cleanup on delete; dangling id renders as "unset" (`ci-table.tsx:185`).

**1.7 `DATE` is not validated at all.** Same default branch — any string is stored.

**1.8 Required attributes are not enforced on import.** `cmdb.ts:792` filters to fields present in the row before validating.

**1.9 The import writes row-by-row, unbatched and non-transactional.** `cmdb.ts:828`, `:841`, up to `MAX_ROWS = 10_000` (`:674`); a failure mid-way throws with no partial report.

**1.10 Pasting into the import textarea destroys your mapping.** `ci-import.tsx:200` calls `load()` on every `onChange`; `load` (`:75`) re-sniffs the delimiter (overwriting the manual choice at `:183`) and resets the mapping with `guess(...)`.

**1.11 Duplicate mappings are resolved silently.** `mapping.indexOf(target)` (`cmdb.ts:712`). Also `guess` maps a `status` column to `lifecycle` (`ci-import.tsx:64`) so a TOPdesk-shaped export skips every row via `rowBadLifecycle` (`cmdb.ts:772`) without a hint.

**1.12 Clear leaves the search box full.** `ci-filter-bar.tsx:110` uncontrolled `defaultValue`; `clear()` (`:53`) never remounts.

**1.13 `removeTicketCi` writes history for a no-op.** `cmdb.ts:637` `deleteMany` then unconditional `CI_REMOVED` activity (`:638`).

**1.14 `deleteCiItem` is the least guarded write.** `cmdb.ts:417`: permission check then `delete`; no existence check, no activity, cascade takes Activity history, relations, TicketCi rows; ConfirmDelete shows only the generic blurb (unlike `deleteCiType`, `ci-type-manager.tsx:126`).

**Correct and worth keeping:** unique null semantics on externalSource/externalId; import scoped by source (`cmdb.ts:731`); in-run `byKey` (`:856`); CSV BOM/CRLF/quotes/delimiter (`csv.ts`); self-link + mirror refusal (`cmdb.ts:459`, `:474`); inverse verbs (`[id]/page.tsx:145`, `ci-relations.tsx:90`); one-hop inference three queries (`ticket-assets.ts:50`); Restrict on type delete surfaced (`cmdb.ts:163`); column persistence (`ci-columns.ts:48`, `cmdb.ts:899`); revalidation; nl complete.

## 2. Plan gaps

- Phase 1: no reorder control for types (`CiType.position` write-once). ITEM kind cannot round-trip.
- Phase 2: seed has five items, not a hundred.
- Phase 3: complete.
- Phase 4: **no asset picker on the new-ticket form** (`src/app/(app)/tickets/new/`, `src/lib/actions/tickets.ts` never touch `ticketCi`). One-hop inference is buried behind a toolbar button + modal (`ticket-actions.tsx:388` → `ticket-assets-dialog.tsx:101`) rather than said on the page. **No `TicketCi` seed at all.**
- Phase 5: present, re-runnable; no dry-run, required fields unenforced, fragile mapping.
- Integration: CIs absent from global search (`src/lib/actions/search.ts`) and from references (`ReferenceKind` at `src/lib/references.ts:18`).

## 3. Overbuilt

- Per-type column picker (`ci-columns.ts`, `ci-columns-picker.tsx`, `saveCiColumns`, `User.ciColumns`, migration) — ~200 lines before sorting/bulk edit exist.
- Four relation verbs where only `DEPENDS_ON` is read (`ticket-assets.ts:59`).
- Nine-icon allowlist plus per-type colour picker (`ci-type-manager.tsx:195`).

## 4. Underbuilt

- No bulk edit. No sorting (`cmdb/page.tsx:69` hard-coded). Lifecycle is a plain dropdown (retired items still in pickers `searchCiItems` `cmdb.ts:438`).
- Item page has no read view — `ci.view`-only users see disabled form controls (`ci-editor.tsx:110`); dates as raw inputs, USER/ITEM as disabled select / raw cuid.
- `CiTickets` unbounded (`[id]/page.tsx:101`, sorted in JS `:154`); `people` loaded unbounded on every item page (`:80`).
- No attribute search (`cmdb/page.tsx:59`).

## 5. Missing useful features

1. Bulk edit from the register (team / lifecycle).
2. Asset picker on the new-ticket form.
3. Expiry awareness for DATE attributes (dashboard card / filter, e.g. next 30 days).
4. CSV export of the current view.
5. CIs in global search and as `#` references.
6. "What depends on this" warning before retiring/deleting.

## 6. Design / UI

Good: tokens throughout, `color-mix` for type colours, aria-labels, Suspense fallbacks, chip-select copied from queue.

Flags:
- `PanelCard` re-implemented three times: `ci-relations.tsx:60`, `ci-tickets.tsx:30`, `ci-import.tsx:208` vs `src/components/tickets/panel-card.tsx:36`.
- Empty state wrong half the time: `cmdb/page.tsx:197` one EmptyState for fresh-install and filtered (`en.ts:1001`), no action.
- No loading state on the register (no `loading.tsx`), no error state.
- Search box only fires on Enter, no affordance (`ci-filter-bar.tsx:96`, magnifier `pointer-events-none` `:104`).
- Item editor has no Cancel (`SaveBar` at `ci-editor.tsx:221`).
- Narrow: filter bar wraps to three rows; import mapping table `min-w-[170px]` per column (`ci-import.tsx:218`).
- Pickers draw `icon={null}` (`ci-relations.tsx:204`, `ticket-assets-dialog.tsx:164`) because `searchCiItems` (`cmdb.ts:445`) does not select `icon`.
- Import whole file in a controlled Textarea with parse per keystroke (`ci-import.tsx:197`).
- ConfirmDelete on an in-use type still offers Delete (`ci-type-manager.tsx:124`).

## Top 10

1. Apply `ticketVisibilityFilter` in `cmdb/[id]/page.tsx:101`, `cmdb/page.tsx:82`, `ticket-assets.ts:32`.
2. Fix re-typing (key `CiEditor` on type id, or drop the type selector from the editor).
3. Implement ITEM editor (picker + options as target type key) or remove the kind.
4. One definition of "open" (`is: { settles: false }`).
5. Asset picker on the new-ticket form.
6. Batch the import in a transaction; return partial report.
7. Stop `load()` resetting mapping/delimiter; warn on duplicate targets.
8. Cap/paginate CiTickets; load people only when needed.
9. Guard by-id writes; activity + dependant warning on item delete.
10. Seed TicketCi rows and more items; fix empty state; fix stale search box.
