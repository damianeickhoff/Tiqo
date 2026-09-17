# Documentation

An internal place for the desk to write down how things work: runbooks,
procedures, "what to do when the VPN box does the thing", the standing
arrangement with a supplier. Tiqo has no such place today.

Read [conventions.md](conventions.md) first.

## This is not the portal knowledge base

`PortalArticle` exists and is easy to mistake for this. It is not. Every column
on it — `slug`, `isFeatured`, `position`, `views`, votes, translations,
`isPublished` — is there because a *requester* is going to find it instead of
raising a ticket. Its job is deflection.

A document is read by an operator, repeatedly, usually under pressure. That
makes four things different:

| | Portal answer | Document |
| --- | --- | --- |
| Reader | a requester, once | an operator, often, in a hurry |
| Shape | one page under a category | a tree, long, cross-linked |
| Lifecycle | published or not | owned, reviewed on a date, superseded |
| Stale means | mild annoyance | somebody follows the wrong steps at 02:00 |

So: a separate space, sharing the editor and the reference system, with one
crossover — **publish this document as a portal answer** — rather than one
content type wearing two hats.

## Decisions already made

**Spaces, then a tree inside each.** Flat lists stop working at about forty
documents, and a tag cloud is not navigation. A space belongs to a team.

**The team on a space says who answers for it, not who may read it.** This plan
originally wanted the team to be the default reader; the implementation declined
that on purpose (`src/lib/permissions.ts`), and the decision stands. A document
is written for the desk to read, and a runbook nobody can find is a runbook
nobody follows — on a desk this size, a fourth check between a person and the
page that says what to do at two in the morning costs far more than it protects.
Reading is `doc.view`, writing is `doc.edit`, and managing shelves is
`doc.manage`. If a desk ever needs a private shelf, that is a different feature
with its own plan, not a quiet reinterpretation of this field.

**Every document has an owner and a review interval.** This is the whole
difference between documentation and a pile of notes. A document past its review
date says so, on itself and in a list the owner can see. Nothing is hidden or
deleted for being stale — it is labelled, because a stale runbook is still
better than none and pretending otherwise gets people to stop writing.

**Revisions are kept, in full.** A document is a set of instructions somebody
will follow; "what did this say last week" has an answer. Store the previous
body on every save. This is cheap and it is the feature people miss most in
tools that skip it.

**Markdown, in the editor that already exists.** `MarkdownEditor`,
`src/lib/markdown-doc.ts`, `src/components/markdown.tsx`. No second editor, no
rich-text-versus-markdown decision to make twice.

**Documents join the reference system.** `src/lib/references.ts` and
`record-references.ts` already turn a typed reference into a chip and write the
trail at both ends. A document that mentions `INC-2709 0001` appears in that
ticket's history, and a ticket that mentions a document appears on the document.
This is the single highest-value hour in the plan — do not leave it to a later
phase.

**Drafting follows the house rule.** The editor holds a draft; Save writes it
and creates the revision; Cancel abandons it. Nothing autosaves. Publishing,
archiving and reordering are list-level commands and are immediate.

## Schema

```prisma
/// A shelf. Documents need somewhere to belong before they need a hierarchy,
/// and "whose is this" is the question a flat wiki can never answer.
model DocSpace {
  id          String  @id @default(cuid())
  key         String  @unique
  name        String
  description String?
  icon        String?
  color       String  @default("#febe2e")
  position    Int     @default(0)

  /// The team that answers for what is written here. Null means the whole
  /// desk, which is the right default for the handful of pages everybody needs.
  teamId String?
  team   Team?   @relation(fields: [teamId], references: [id], onDelete: SetNull)

  docs Doc[]
  createdAt DateTime @default(now())
}

model Doc {
  id      String @id @default(cuid())
  slug    String
  title   String
  /// A sentence for the list and for search results, so a tree of thirty
  /// documents can be read without opening any of them.
  summary String?
  body    String @default("")

  spaceId String
  space   DocSpace @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  /// The tree. Deleting a parent takes its children: a runbook's sub-pages are
  /// not documents that happen to sit nearby.
  parentId String?
  parent   Doc?    @relation("DocTree", fields: [parentId], references: [id], onDelete: Cascade)
  children Doc[]   @relation("DocTree")
  position Int     @default(0)

  /// Who answers for it, and how long it may go untouched before it is
  /// suspect. Zero means "does not go stale", for the pages that genuinely
  /// do not.
  ownerId        String?
  owner          User?   @relation("DocOwner", fields: [ownerId], references: [id], onDelete: SetNull)
  reviewDays     Int     @default(180)
  /// Set when somebody says the content is still right — which is not the same
  /// as somebody editing it, and not the same as `updatedAt`.
  reviewedAt     DateTime?

  /// Archived rather than deleted. A procedure that was replaced is the first
  /// thing wanted when the replacement turns out to be wrong.
  archivedAt DateTime?

  /// The portal answer this was published as, if it was. Kept so the two can
  /// be told apart and so re-publishing updates rather than duplicates.
  articleId String?        @unique
  article   PortalArticle? @relation(fields: [articleId], references: [id], onDelete: SetNull)

  revisions DocRevision[]

  createdById String?
  createdBy   User?   @relation("DocAuthor", fields: [createdById], references: [id], onDelete: SetNull)
  updatedById String?
  updatedBy   User?   @relation("DocEditor", fields: [updatedById], references: [id], onDelete: SetNull)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([spaceId, slug])
  @@index([spaceId, parentId, position])
}

/// What the document said before this save. Written on every save, never
/// edited. The note is optional and usually empty — most edits explain
/// themselves, and a required one produces "update".
model DocRevision {
  id     String @id @default(cuid())
  docId  String
  doc    Doc    @relation(fields: [docId], references: [id], onDelete: Cascade)
  title  String
  body   String
  note   String?
  authorId String?
  author   User?  @relation(fields: [authorId], references: [id], onDelete: SetNull)
  createdAt DateTime @default(now())

  @@index([docId, createdAt])
}
```

Permissions to add: `doc.view`, `doc.edit`, `doc.manage` (spaces, archiving,
publishing to the portal), group `docs`.

Migration name: `docs`.

## Phases

### 1 — Spaces and the tree

`src/app/(app)/docs/` — a list of spaces, then a space page with its tree in a
rail and the selected document beside it. Space CRUD in
`src/app/(app)/settings/docs` behind `doc.manage`.

Verify: create two spaces, nest three levels of documents, reorder them, and see
the order hold after a reload.

### 2 — Read and write

The document page: title, summary, owner, review state, body. Edit puts the page
into a draft — title, summary and body all editable — with Save and Cancel.
Save writes the revision first, then the document, in one transaction.

A History tab listing revisions with author and time, each opening read-only,
and a Restore that writes the old body as a *new* revision rather than deleting
what came after.

Verify: three edits produce three revisions; restoring the first gives four.

### 3 — References both ways

Extend `src/lib/references.ts` with a document reference kind, and
`record-references.ts` so a document mentioned in a comment lands in the
ticket's trail and vice versa. Add documents to the reference picker and to
`src/lib/actions/search.ts` so the existing search finds them.

Verify: type a document reference into a ticket comment; the chip renders, the
ticket's history records it, and the document shows the ticket under "referenced
by".

### 4 — Review state

- a document past `reviewedAt + reviewDays` shows a Stale marker on itself and
  in every list;
- a **Still correct** button on the document sets `reviewedAt` — one click, no
  edit required, because the cost of confirming has to be lower than the cost of
  ignoring;
- a dashboard widget (`src/lib/dashboard-widgets.ts`) listing what the viewer
  owns that has gone stale.

Verify: set a document's interval to zero days, reload, see it marked; press the
button, see it clear.

### 5 — Publish to the portal

`doc.manage` gets a Publish action creating or updating a `PortalArticle` from
the document — title, summary, body, a category picked at publish time. The link
is kept in `articleId`, so the document page shows where it is published and
publishing again updates rather than duplicating.

The portal article remains editable on its own. They diverge, and that is
correct: what you tell a requester is shorter than what you tell an engineer.
Show "published from a document" on the article's admin page so the divergence
is not a surprise.

Verify: publish, edit the document, publish again, and confirm one article with
updated content — not two.

## Out of scope

Real-time collaborative editing, comments on documents, attachments on documents
(revisit once [attachments.md](attachments.md) has landed), per-document
permissions beyond the space's team, export to PDF, and templates. Templates in
particular can wait until there are enough documents to see a pattern worth
templating.
