# Ticket relations

Let one ticket say something about another: this blocks that, this duplicates
that, these five incidents are all the same problem. Today the only structural
link between tickets is `Ticket.mergedInto`, which is an ending rather than a
relationship, and the soft links that `src/lib/references.ts` creates when
somebody types a reference into a comment.

This is the prerequisite for [cmdb.md](cmdb.md) and for anything resembling
problem management. Read [conventions.md](conventions.md) first.

## Decisions already made

**A link is one directed row with two readings.** `INC-1 blocks INC-2` and
`INC-2 is blocked by INC-1` are the same fact. Storing both directions gives you
two rows that can disagree. Store the row once, from the ticket the link was
made on, and render the inverse verb at the far end.

**Five kinds, no more, and not configurable.** `RELATES_TO`, `DUPLICATES`,
`BLOCKS`, `CAUSED_BY`, `PARENT_OF`. A configurable link vocabulary is the sort
of feature that gets used once, produces eleven synonyms for "related", and
makes every query about the graph unanswerable. If a sixth is genuinely needed
later, adding an enum value is a one-line migration.

**Merge stays where it is.** `mergedInto` already works, already keeps the old
number resolving, and already moves the conversation. Do not fold it into this
model; a merge is not a link, it is the end of a ticket's separate existence.
`DUPLICATES` is for the case where both tickets stay open.

**A link is a list-level command, not a draft.** Picking a ticket and pressing
Add creates it immediately; the X removes it immediately. That is the exception
in `CLAUDE.md` and this is squarely inside it.

**`PARENT_OF` does not imply anything.** No rolled-up status, no inherited
assignee, no blocking the parent from closing. It draws a tree and nothing more.
Cascading behaviour is a decision for whoever asks for it, with a reason.

## Schema

```prisma
/// What one ticket has to do with another. Directed: the row is written from
/// the ticket somebody was looking at, and the far end reads it backwards —
/// "blocks" one way is "blocked by" the other, and one row cannot contradict
/// itself the way a stored pair can.
enum TicketLinkKind {
  RELATES_TO
  DUPLICATES
  BLOCKS
  CAUSED_BY
  PARENT_OF
}

model TicketLink {
  id   String         @id @default(cuid())
  kind TicketLinkKind

  sourceId String
  source   Ticket @relation("LinkSource", fields: [sourceId], references: [id], onDelete: Cascade)
  targetId String
  target   Ticket @relation("LinkTarget", fields: [targetId], references: [id], onDelete: Cascade)

  createdById String?
  createdBy   User?    @relation(fields: [createdById], references: [id], onDelete: SetNull)
  createdAt   DateTime @default(now())

  /// One statement per pair per kind. Saying the same thing twice is a slip,
  /// not an opinion held more strongly.
  @@unique([sourceId, targetId, kind])
  @@index([targetId])
}
```

Migration name: `ticket_links`.

## Phases

### 1 — Model and actions

`src/lib/actions/ticket-links.ts`: `linkTickets(sourceId, targetId, kind)` and
`unlinkTickets(linkId)`. Both require `ticket.edit` and `canViewTicket` on
**both** ends — a link is a way to learn that a ticket exists, so linking to one
you cannot see is a disclosure.

Reject a ticket linked to itself. Reject the mirror of an existing link
(`A blocks B` when `B blocks A` is already recorded) with a message saying which
link already exists.

New `ActivityType.LINKED` and `UNLINKED`, written on **both** tickets, the way
`src/lib/record-references.ts` already does for prose references — read that
file before writing this one, because it has solved this exact problem and the
two should behave alike. `newValue` carries the kind, `link` the far ticket.

Verify: link two tickets, see one row and two trail entries reading correctly
from each side.

### 2 — The picker

Reuse `src/components/tickets/reference-picker.tsx` — it already searches
tickets and is the control people know. A kind `<select>` beside it, an Add
button, and the list of existing links below.

Each link row: the kind as a verb in the viewer's language, then the far
ticket's reference, title, status ring and priority bars, so the row answers
"is that one still open" without a click. Use `src/components/ticket-peek.tsx`
for hover.

Strings: a `links` block in both dictionaries with both readings of every kind
(`blocks` / `blockedBy`, `duplicates` / `duplicatedBy`, `causedBy` / `caused`,
`parentOf` / `childOf`, `relatesTo` both ways).

Verify: both directions read as English and as Dutch; adding is immediate;
removing is immediate.

### 3 — On the ticket page

A Links card in the ticket rail
(`src/app/(app)/tickets/[number]/page.tsx`), below the properties. Load links in
both directions in the page query and merge them into one list with the correct
verb per row.

On the portal (`src/app/(portal)/portal/(shell)/requests/[number]/page.tsx`),
show links only to tickets the requester can see, and only `RELATES_TO` and
`DUPLICATES` — "your request is blocked by INC-4471" is meaningless to someone
who cannot open INC-4471.

Verify: as a requester, a linked ticket belonging to someone else is absent
rather than shown as an unopenable reference.

### 4 — Where links change what the queue says

Two small payoffs that make the feature worth having rather than decorative:

- a ticket with an open `BLOCKS` link pointing at it gets a marker on the queue
  row and in the filter bar (`src/components/tickets/filter-bar.tsx`) — "blocked"
  as a filter, computed from links, not a new column;
- the ticket page's Close action warns, once, when the ticket still blocks
  something open. A warning, not a refusal: the desk knows things the graph
  does not.

Verify: close a blocking ticket and get the warning; close it again from the
warning and it closes.

## Out of scope

Link types on projects, a graph visualisation, automatic linking by similarity,
and any rule that changes one ticket's status because of another's. Problem
management as a ticket type of its own is a separate plan — `CAUSED_BY` plus a
parent ticket covers most of what a desk needs first.
