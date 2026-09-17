# Saved views

Let an operator keep a queue filter and come back to it. Today
`src/components/tickets/filter-bar.tsx` has five built-in views hard-coded in a
`VIEWS` constant, and everything else is rebuilt by hand every morning.

Read [conventions.md](conventions.md) first.

## Decisions already made

**A view is a stored query string, nothing cleverer.** The queue is already
entirely driven by search parameters — `status`, `priority`, `project`,
`assignee`, `type`, `team`, `scope`, `open`, `sort`, `q` — so a saved view is
one `String` column and a redirect. Modelling filters as structured rows would
be a second source of truth for something the URL already expresses perfectly,
and it would go out of date the first time a filter is added.

Store the parameters **without** `page`. A saved view that opens on page four is
a bug, and the key is already excluded nowhere else, so strip it on save.

**The five built-ins stay in code.** All open, mine, my teams, unassigned,
everything. They are the vocabulary the app teaches and they must be identical
on a fresh install. Saved views appear alongside them, after a divider.

**Personal by default, shareable by permission.** A view with no owner is the
desk's, visible to everyone with `desk.access`, and editable only with a new
`view.share` permission. A view with an owner is that person's alone — not
hidden-but-discoverable, just theirs.

**Saving is explicit and takes a name.** No "your filters were remembered". The
current filters plus a Save view button, a name, done. Renaming and reordering
are list-level commands and are immediate; there is no editor, because editing a
view means setting the filters and saving over it.

**One view can be the operator's landing queue.** `isDefault` per owner: opening
`/tickets` with no parameters redirects to it. This is the reason the feature is
worth building — the morning starts in the right place instead of in a filter
bar.

## Schema

```prisma
/// A queue somebody wants back tomorrow.
model SavedView {
  id   String @id @default(cuid())
  name String

  /// The queue's own search parameters, stored exactly as the URL carries them
  /// and minus `page`. One column rather than a row per filter: the queue is
  /// already defined by these keys, and a second structured copy of them would
  /// be a second thing to keep in step every time a filter is added.
  query String

  /// Whose it is. Null means the desk's — shared with everyone who can see the
  /// queue, and editable only with `view.share`.
  ownerId String?
  owner   User?   @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  /// Where this person lands when they open the queue with nothing set. At most
  /// one per owner.
  isDefault Boolean @default(false)
  position  Int     @default(0)

  createdAt DateTime @default(now())

  @@index([ownerId, position])
}
```

Permission: `view.share`, group `tickets`. Migration name: `saved_views`.

## Phases

### 1 — Save and list

`src/lib/actions/views.ts`: `saveView(name, query, shared)`, `renameView`,
`deleteView`, `moveView`, `setDefaultView`. Sharing requires `view.share`;
everything else requires only that the view is yours.

`setDefaultView` clears the previous default for that owner in the same
transaction — two defaults is a state with no correct behaviour.

Verify: save the current filters, reload, open the view, and land on exactly the
same queue.

### 2 — In the filter bar

The saved views render as chips after the built-ins, with the desk's shared ones
distinguishable from your own at a glance. A Save view control appears once the
filters differ from every existing view — offering to save what is already saved
is noise.

Verify: the control is absent on a fresh queue, present after one filter change,
and absent again when the current filters match a saved view.

### 3 — Landing queue

`/tickets` with no search parameters redirects to the viewer's default view when
they have one. A star on each view chip sets and clears it.

Take care not to trap anyone: the built-in **Everything** must always be one
click away, and the redirect must not fire when any parameter is present, or
Clear becomes impossible to use.

Verify: set a default, open `/tickets`, land on it; press Clear and stay on the
unfiltered queue.

### 4 — Manage

A small section in `src/app/(app)/settings/tickets` listing every view the
viewer may edit, with rename, reorder and delete. Shared views are marked and
only editable with `view.share`.

Verify: as an operator without `view.share`, the desk's views are visible,
usable, and not editable.

## Out of scope

Views over anything but the ticket queue, scheduling a view as an emailed
digest, views scoped to a team rather than to a person or to everyone, and
column selection per view. The last one only becomes interesting once
`src/components/tickets/ticket-columns.tsx` is user-configurable, which it is
not.
