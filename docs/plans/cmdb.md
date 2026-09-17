# CMDB — configuration items

A register of the things the desk looks after — servers, laptops, licences,
applications, lines, sites — and, more importantly, what they are connected to
and which tickets have been raised against them.

Read [conventions.md](conventions.md) first, and build
[ticket-relations.md](ticket-relations.md) before this. A configuration item
whose incidents cannot point at one another is a spreadsheet.

## Open question to settle before phase 1

**What feeds it.** This is the question that decides whether the feature is
worth building. A CMDB maintained by hand rots inside a quarter: every desk that
has one has a register that disagrees with reality, and a register nobody
trusts is worse than none because people stop checking it and start guessing
anyway.

Pick at least one of these before writing code, and say which in the phase-1
commit message:

1. **CSV import**, re-runnable, matching on a stable external key. The cheapest
   honest answer, and the one phase 5 assumes.
2. **A sync from an existing source** — the `externalSource`/`externalId` pair
   on `Ticket` suggests TOPdesk is already in view; an inventory tool, an RMM,
   or Active Directory would do as well.
3. **The desk maintains it deliberately**, with a small enough scope that this
   is credible — services and sites rather than every laptop.

If the answer is "we will keep it up to date by hand" and the scope is every
endpoint, build something else instead. That is not a hedge; it is the finding.

## Decisions already made

**Types are configurable, attributes are typed.** A server and a licence have
almost nothing in common, and one table of nullable columns covering both is a
table nobody can query. `CiType` carries a field definition; `ConfigurationItem`
stores values against it. Copy the shape of `PortalForm` / `PortalFormField` /
`PortalFieldKind` in `prisma/schema.prisma` — that problem is already solved in
this codebase, and a second, different answer to it is a cost.

**Attribute values are JSON on the item, not a row per value.** An
entity-attribute-value table is the textbook answer and it makes every list
query a join per column. Postgres indexes JSONB well enough for a register this
size.

**Relations between items are their own thing, not ticket links.** `depends on`
between two servers and `blocks` between two tickets are different graphs with
different verbs. Same directed-row shape as `TicketLink`, separate table.

**A ticket points at items through a join table, not a column.** One incident
can touch three machines. The join carries nothing but the two ids.

**No discovery agent, no network scanning, ever, in this plan.** That is a
product, not a feature.

## Schema

```prisma
enum CiFieldKind {
  TEXT
  NUMBER
  DATE
  BOOLEAN
  CHOICE
  USER
  ITEM
}

/// A kind of thing the desk looks after, and what is worth recording about it.
/// Configurable because a desk that cannot add "licence" will keep its licences
/// in a spreadsheet, which is the failure this is meant to prevent.
model CiType {
  id       String  @id @default(cuid())
  key      String  @unique
  name     String
  icon     String?
  color    String  @default("#febe2e")
  position Int     @default(0)

  fields CiTypeField[]
  items  ConfigurationItem[]
}

model CiTypeField {
  id       String      @id @default(cuid())
  typeId   String
  type     CiType      @relation(fields: [typeId], references: [id], onDelete: Cascade)
  key      String
  label    String
  kind     CiFieldKind @default(TEXT)
  required Boolean     @default(false)
  /// Options for CHOICE; the type key for ITEM. Empty otherwise.
  options  String[]    @default([])
  position Int         @default(0)

  @@unique([typeId, key])
}

model ConfigurationItem {
  id     String @id @default(cuid())
  /// What people call it out loud. Indexed, because every search starts here.
  name   String
  typeId String
  type   CiType @relation(fields: [typeId], references: [id], onDelete: Restrict)

  /// Values keyed by `CiTypeField.key`. JSON rather than a row per attribute:
  /// a register of a few thousand items is read as lists far more often than
  /// it is queried by one attribute, and a join per column makes every list
  /// slow to save a query nobody runs.
  attributes Json @default("{}")

  /// Where it came from, when it came from somewhere. The unique pair is what
  /// makes an import re-runnable instead of duplicating the estate.
  externalSource String?
  externalId     String?

  /// Who to ask about it, and which team carries it.
  ownerId String?
  owner   User?   @relation(fields: [ownerId], references: [id], onDelete: SetNull)
  teamId  String?
  team    Team?   @relation(fields: [teamId], references: [id], onDelete: SetNull)

  /// In service, retired, on order. Deliberately a small fixed set rather than
  /// another configurable status list: this one is about the asset's life, and
  /// the desk's own stages already exist for tickets.
  lifecycle CiLifecycle @default(IN_SERVICE)

  outgoing CiRelation[] @relation("CiSource")
  incoming CiRelation[] @relation("CiTarget")
  tickets  TicketCi[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([externalSource, externalId])
  @@index([typeId, name])
  @@index([name])
}

enum CiLifecycle {
  PLANNED
  IN_SERVICE
  MAINTENANCE
  RETIRED
}

enum CiRelationKind {
  DEPENDS_ON
  CONNECTS_TO
  RUNS_ON
  PART_OF
}

model CiRelation {
  id       String            @id @default(cuid())
  kind     CiRelationKind
  sourceId String
  source   ConfigurationItem @relation("CiSource", fields: [sourceId], references: [id], onDelete: Cascade)
  targetId String
  target   ConfigurationItem @relation("CiTarget", fields: [targetId], references: [id], onDelete: Cascade)

  @@unique([sourceId, targetId, kind])
  @@index([targetId])
}

/// Which items a ticket is about. A join rather than a column, because one
/// incident routinely touches several.
model TicketCi {
  ticketId String
  ticket   Ticket            @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  itemId   String
  item     ConfigurationItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  addedAt  DateTime          @default(now())

  @@id([ticketId, itemId])
  @@index([itemId])
}
```

Permissions: `ci.view`, `ci.edit`, `ci.manage` (types and import), group `cmdb`.

Migration name: `cmdb`.

## Phases

### 1 — Types

`src/app/(app)/settings/cmdb` — types and their fields, behind `ci.manage`. The
field editor is a draft with a Save; adding, deleting and reordering fields are
immediate. Seed two types in `prisma/seed.ts` so the feature is not invisible on
a fresh install.

Verify: create a type with one of each field kind; the values round-trip.

### 2 — The register

`src/app/(app)/cmdb` — a filterable list (type, lifecycle, team, owner, free
text on name), and an item page with attributes, owner, team and lifecycle.
Editing is a draft with Save.

Verify: a hundred seeded items list and filter without a visible delay.

### 3 — Relations

The same directed-row treatment as `TicketLink`, with a picker on the item page
and both readings of each verb in the dictionaries. A relations card listing
both directions.

Verify: `A runs on B` reads as `B runs` … the inverse, correctly, from B.

### 4 — Tickets against items

- an item picker on the ticket page and on the new-ticket form, writing
  `TicketCi`;
- on the item page, the tickets raised against it, open ones first — this is the
  payoff, the "what else is broken on this host" question;
- a count of open tickets on each item in the register list.

Then the one inference worth making: on the ticket page, when the linked item
has other open tickets against it *or against something that depends on it*,
say so. One level deep only. A full transitive closure on every ticket render is
a query nobody should pay for, and two levels of indirection is where the
guesses start.

Verify: three incidents against one server; opening the third shows the other
two.

### 5 — Import

A CSV import behind `ci.manage`: map columns to fields, match on
`externalSource` + `externalId`, report created / updated / skipped, and never
delete. Re-runnable is the requirement — an import that can only be run once is
a one-off migration, not a feed.

Verify: run the same file twice; the second run updates and creates nothing.

## Out of scope

Discovery, software inventory, licence compliance counting, contracts and
warranty tracking, a topology diagram, and impact analysis deeper than one hop.
Barcode or QR labelling is a good idea and belongs in its own plan.
