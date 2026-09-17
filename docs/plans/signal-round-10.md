# Signal round 10 — assets, documentation, mail, change templates

The build plan for the round-10 mockups: the four areas hardened in
September (see [hardening-2026-09.md](hardening-2026-09.md)), redrawn in the
Signal vocabulary and reviewed on 16 September 2026. The boards live on the
second page of the design canvas ("Round 10 · Assets, Docs, Mail,
Templates") and, as plain HTML, in `design/mockups/boards/` — serve them with
the `mock-preview` launch entry (port 3312) and open
`http://localhost:3312/<Board>.dc.html`. The generator is
`design/mockups/src/gen4.mjs`; the note beside each row on the canvas says
what is new on it.

Read [conventions.md](conventions.md) first. Everything below assumes the
hardening work is in place: sortable register, bulk edit, CSV export, the
files panel, the mail log, the approvals queue, doc move/notify/compare.

## What was decided

- **Every screen without an A/B is approved as drawn:** one asset (read and
  edit), documentation home, a space, a document (reading, editing,
  compare), documentation spaces settings.
- **Asset types:** one designer (`AssetTypes`, `AssetTypesPreview`). The
  type is a selector in the top bar, not a side list; Icon and Colour are
  buttons that open pickers; Preview is a button that opens a popup.
- **Mail settings:** the tabbed layout (`MailLog`). Wording is a table
  (`MailTemplates`); a template is edited on its own page without the
  settings side-nav (`MailTemplateDesigner`). The one-page variant and the
  side-by-side designer are gone.
- **Change template:** a phase strip over a dense steps table with an
  inspector (`ChangeTemplate`), sized for a dozen steps without scrolling.
  Every earlier variant is gone.
- **Register:** the split view (`AssetsRegisterSplit`) with the saved views
  from the table variant. The table-with-bulk-bar variant is gone.

## Scale

Boards are drawn at canvas scale; the app is one step larger, as in every
earlier round:

| Canvas | App |
| --- | --- |
| 13px body · 11px label · 12px meta | 14 · 12 · 13 |
| bar 48 · rail 220 · right rail 320 · tree 240 | 52 · 240 · 320 · 260 |
| control 28–30 · card head 34 | 32–36 · 34 |
| radius 6 / 8 / 12 | control / card / panel tokens |

Colours are tokens only; glyph tints are `color-mix(in oklab, <type colour>
16%, transparent)` as the CMDB already does.

## Order of work

Each phase ends with lint, a clean `tsc` (heap flag as in the hardening
plan), and the verify step in the browser as the roles named, both themes.
Schema changes are listed per phase; batch them into one migration per phase
and diff-check before every `migrate dev` (another session shares the tree).

### 1 — The register (`AssetsRegisterSplit`)

- **Split view.** A List / Split toggle in the page head (per-user
  preference, Split by default). In Split the table keeps name, type and
  lifecycle and a 400px pane on the right shows the selected item
  (`?peek=<id>`): header with lifecycle, Open and Edit, the details grid
  with the warranty bar, Connected to, Open tickets, and the one-hop
  "also open nearby" line. Arrow keys move the selection. In List the
  table shows the full column set as today.
- The name cell carries the serial or model underneath (first TEXT attribute
  after the name, or the model field when the type has one).
- **Saved views** in the sidebar: Expiring in 30 days, With open tickets,
  Retired shipped; "Save current view" stores the URL's filters per user.
  Schema: `User.ciViews Json` (name + query string), like `ciColumns`.
  "Expiring" reads DATE attributes flagged as an expiry (phase 5 adds the
  flag; until then, any DATE named like `expires|renews|warranty`).
- A lifecycle strip at the foot of the sidebar (counts by lifecycle for the
  current type).
- Row checkboxes stay for the existing bulk edit; the bulk controls become
  one floating bar at the bottom (lifecycle, operator group, Export
  selected, Labels, Retire, clear).

Verify: click a row and the pane fills without a navigation; save a view
with two filters and reopen it from the sidebar; the Expiring view lists
the certificate due in 23 days.

### 2 — One asset (`Asset`, `AssetEdit`)

- Read first: a header band (glyph, name, model · serial · group, lifecycle
  pill, Print label, Edit, menu), Details as a two-column label/value grid,
  Edit swaps the grid for the form inside the same card with Save / Cancel
  in its footer and a summary of what changed. Relations and tickets stay
  list-level and never wait for Save.
- Tickets card: Open / All toggle, and **Raise** that opens `/tickets/new`
  with the asset pre-attached (the picker from the hardening work).
- Rail: Connected to, grouped by verb with the inverse readings under a
  rule; **Also open nearby** — the one-hop query from `ticket-assets.ts`
  run from the asset's side; Lifecycle with the purchased → warranty bar
  and a Retire action; **Label** with a QR that encodes the asset's URL and
  a print view (`/cmdb/[id]/label`, and `/cmdb/labels?ids=` for many).
- History keeps the last five with "All N".

Verify: the same asset as `ci.view`-only reads as a grid with no form; Edit
as `ci.edit` changes warranty and the footer names the field.

### 3 — Documentation home and a space (`DocsHome`, `DocsSpace`)

- Home: one wide search over titles and text (`/` focuses it; results reuse
  the global search's doc branch), **Pinned by you** (schema: `DocStar`,
  the shape of `TicketStar`), space cards with team, page count and stale
  count, Recently updated, and Needs review with Still correct and Edit on
  each row plus the desk-wide count linking to a **review queue**
  (`/docs/review`, `doc.manage`: every stale page, by owner).
- Space page: the tree rail gets the space header, find-in-space (title and
  summary, client side), stale dots and a real New page button; the shelf
  gets All / Stale / Mine / Archived chips, an owner filter, sort, and a
  cards / list toggle (per-user preference).

Verify: pin a page, see it on Home; the Stale chip shows two pages; Still
correct on the Home row clears one.

### 4 — A document (`Doc`, `DocEdit`, `DocCompare`)

- Reading: an **On this page** row built from the body's headings, a meta
  line (review chip, owner, updated by, read time), reference chips for
  tickets, assets and pages (assets join `ReferenceKind`), sub-pages as
  cards, Pinned and **Reading mode** (hides both rails, remembered per
  user) in the toolbar.
- Rail cards: Ownership & review with Still correct and **Remind me**
  (snoozes the next `DOC_STALE` by 7 days); On the portal, which says when
  the article is behind the page (article `updatedAt` older than the last
  revision) with Publish again; Referenced from; Files; History with
  Compare.
- Editing: title and summary as inputs above the body; the editor bar
  carries the paperclip, image, and a `#` hint; the footer holds Save,
  Cancel, the optional change note, and **Counts as a review** (sets
  `reviewedAt` on save; default from phase 8's setting). Top right: who
  else has the page open, from the live route, if cheap — otherwise leave
  it out.
- Compare (exists): version pickers on both sides, Restore on the older
  side only, changed-line counts, Side by side / Inline toggle.

Verify: a page with three headings shows three outline links; editing with
the tick set clears a stale marker; compare 4 ↔ 6 shows 3 added, 1 removed.

### 5 — Settings: asset types (`AssetTypes`, `AssetTypesPreview`)

- One designer per type: top bar with a type selector, New type, Preview,
  Duplicate, Delete type. No side list.
- Name and key on one row; **Icon** and **Colour** as buttons opening
  pickers (icon: searchable grid; colour: the seven swatches plus a hex
  field).
- Attributes table with a kind-specific line: options for CHOICE, **counts
  as an expiry** for DATE (schema: `CiTypeField.isExpiry Boolean`),
  **points at** for ITEM (exists).
- **Default register columns** (schema: `CiType.defaultColumns String[]`,
  used when a user has no `ciColumns` for that type) and **Name pattern**
  (schema: `CiType.namePattern String?`, a regex checked on save with a
  field error).
- Preview popup: the item page card, the register row, or a compact card,
  rendered from the draft.
- Duplicate type copies fields with a `-copy` key.

Verify: flag Warranty until as an expiry and the register's column follows;
a name that fails the pattern is refused with the pattern in the message.

### 6 — Settings: documentation spaces (`DocSpaces`)

- The table: colour, name, description, team, pages, stale, review interval,
  portal category. Schema: `DocSpace.reviewDays Int @default(180)` (new
  pages start from it) and `DocSpace.portalCategoryId String?` (Publish
  proposes it).
- The dialog is a draft (Save enabled only when dirty); Delete lives left.
- **Review defaults** on `Instance`: `docRemindDays Int @default(7)`,
  `docRemindEveryDays Int @default(14)`, `docEscalateToTeam Boolean`,
  `docEditCountsAsReview Boolean`. The stale sweep from the hardening work
  reads them.

Verify: set a space to 90 days and a new page in it shows 90; a second
reminder goes to the team when escalation is on.

### 7 — Settings: mail (`MailLog`, `MailTemplates`)

- The health strip above every tab: Sending and Collecting state from the
  last successful test or drain (schema: `MailSettings.lastSentAt`,
  `lastPolledAt`, `lastPollSummary Json`), Queue (failed count, Retry runs
  the resend for all failed), Poll (address, token state, **Now** runs the
  drain in-process).
- Tabs: Connection (sending, collecting, polling — each its own draft with
  Test and Save; the polling card shows the address with Copy and the last
  run's counts) · Wording · Signature · Log.
- Wording: a table of the seven kinds — kind, who it goes to, subject,
  Shipped / Edited, last edited by and when, sent in 30 days (count
  `MailMessage` by template kind; schema: `MailMessage.kind String?`) —
  with Edit per row and **Send me every kind**. Nothing edits in place.
- A template's own page, `/settings/mail/templates/[kind]`, rendered
  without the settings side-nav (the form designer's precedent): subject
  and a tall body on the left with variable chips; on the right the preview
  (HTML / plain, light / dark client) and a "When it goes out" card
  (trigger, recipient, the never rule, the count). **Send me a test**
  queues the rendered mail to the signed-in user; Back to the shipped
  wording is immediate; Save / Cancel in a footer naming what changed.
- Signature: `MailSettings.signature String?`, rendered under every mail
  by `mail-layout.ts`.
- Log: the existing mail log with the day's four counters above it.

Verify: Send me a test lands in the log as Sent; a failed row retries from
the strip; the signature appears in a real received mail.

### 8 — Settings: change template (`ChangeTemplate`)

- The page becomes a phase strip, a dense steps table and an inspector,
  built for plans of a dozen steps, rendered without the settings side-nav
  (as the form designer and the mail template page). The strip has All steps, one chip per
  phase (count, a stamp when it has a sign-off) and a dashed Add; a chip
  filters the table to that phase. The table has a slim header row per
  phase (name, count, sign-off, add, menu) and 32px step rows (number,
  name, who, after, estimate, menu). Drag reorders within and across
  phases; add and remove are immediate.
- Selecting a step or a phase row fills the inspector; the template's own
  details (name, what it covers, approval by, **default assignee**) open
  there from Edit details in the header. Each inspector is one draft with
  Save.
- Step fields, schema on `ChangeTemplateStep`: `instructions String?`,
  `assigneeId String?` / `teamId String?`, `afterStepId String?`,
  `estimateMinutes Int?`, `skipNeedsReason Boolean`, `blocksPhase Boolean`.
  Template: `ChangeTemplate.defaultAssigneeId String?`. `copyPlanOnto`
  carries them onto the change's steps (instructions into the step
  description; "after" into the existing step gate).
- **Where it is used** in the inspector: changes that applied this template
  (`Ticket.templateId` is already recorded when a plan is applied — if not,
  add it).
- **Preview on a change** opens the plan card as the desk will see it.
- Duplicate copies phases and steps.

Verify: set a step's "after" and estimate, apply the template to a change,
and see the step locked until the other is done with the estimate on the
plan card.

## Out of scope for this round

A topology diagram, a document PDF export, per-team mailboxes, approval by
email reply, and a change-template marketplace. Every design decision for
this round is taken; the plan is ready to build.

## Follow-ups from the 16 September review

Raised after the round was built; assigned to six agents, one per area.

- **Tickets overview:** a shared table primitive (`src/components/table/resizable-columns.tsx`:
  Excel-like column resize persisted per user, sortable headers) used by the
  queue, the asset register and the mail templates table; sort by any column
  from its header; the desk `/approvals` page removed in favour of two queue
  filters (Waiting on a decision, Waiting on me); one Filter button with a
  popover and applied-filter chips instead of a row of controls; no status
  glyph in the status cell.
- **Assets:** every attribute of every type available as a column (union in
  All types); the columns picker in Split mode too; the type sidebar at full
  height; column resize from the primitive; the type designer uses its width
  with an always-visible live preview on the right.
- **Documentation:** whole card opens a page (pin stays a button); wider
  article; "On this page" as a sticky index card in the rail; renaming
  changes the slug with old slugs redirecting (`Doc.pastSlugs`); the rail
  cutoff fixed; the Ownership card at rail meta sizes; the stale rule made
  discoverable ("Stale after N days") in the card, the spaces table and the
  settings.
- **Markdown:** admonitions (`> [!NOTE]` and friends), nested lists with
  Tab/Shift+Tab, and GFM tables through the parser, the editor and the
  renderer.
- **Mail:** "Wording" renamed Templates; the templates table on the shared
  primitive; the template page rebalanced with a 600px mail preview; a
  per-template HTML layout (`MailTemplate.html`, null = shipped layout) with a
  code editor, placeholders and a live preview.
- **Navigation:** an in-app history stack with a Back control in the top bar
  ("← previous page"), `Alt+←`, and Recently viewed in ⌘K.
