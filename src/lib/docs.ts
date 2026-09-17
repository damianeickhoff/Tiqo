/**
 * Documentation: the parts both halves of the app have to agree on.
 *
 * A document is not a portal answer. The portal exists so a requester finds a
 * page instead of raising a ticket; this exists so an operator finds the right
 * steps at two in the morning. That difference is why there is a review date
 * here and a vote count there, and it is the only thing this file is about.
 */

/** Where one document lives. Two segments: the shelf, then the page. The slug
 *  follows the title, and every slug the page has worn stays on it and
 *  redirects here, so a rename moves the address without breaking a link. */
export function docHref(spaceKey: string, slug: string) {
  return `/docs/${spaceKey}/${slug}`;
}

export function spaceHref(key: string) {
  return `/docs/${key}`;
}

/* ----------------------------------------------------------------- review -- */

/**
 * How long a document may go unconfirmed. Offered as a handful of intervals
 * rather than a free number: the difference between 90 and 100 days is not a
 * decision anybody has, and a list is one click where a box is a guess.
 */
export const REVIEW_INTERVALS = [0, 30, 90, 180, 365] as const;

/** The day this document stops being trustworthy, or null if it never does. */
export function reviewDueAt(doc: {
  reviewDays: number;
  reviewedAt: Date | null;
  createdAt: Date;
}): Date | null {
  if (doc.reviewDays <= 0) return null;

  // `reviewedAt` is set when somebody says the content is still right, and by
  // nothing else — editing a page is not the same as having read all of it. A
  // document that has never been confirmed runs its clock from the day it was
  // written, which is the last moment anybody vouched for it.
  const from = doc.reviewedAt ?? doc.createdAt;
  return new Date(from.getTime() + doc.reviewDays * 24 * 60 * 60 * 1000);
}

/**
 * Past its review date.
 *
 * Nothing is ever hidden or deleted for being stale — it is labelled. A stale
 * runbook is still better than no runbook, and a system that punishes people
 * for having written something teaches them not to write anything.
 */
export function isStale(
  doc: { reviewDays: number; reviewedAt: Date | null; createdAt: Date },
  now = new Date(),
) {
  const due = reviewDueAt(doc);
  return due !== null && due.getTime() <= now.getTime();
}

/** Days until review, negative once it is overdue. Null when it never goes
 *  stale, so a caller can tell "fine for a year" from "never expires". */
export function daysUntilReview(
  doc: { reviewDays: number; reviewedAt: Date | null; createdAt: Date },
  now = new Date(),
): number | null {
  const due = reviewDueAt(doc);
  if (!due) return null;
  return Math.round((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * What a search over documentation looks at.
 *
 * The body as well as the title, which is the whole point of a document:
 * people look for the error message, not for the name somebody filed it under.
 * Archived pages are left out — they are kept so a link still resolves, not so
 * they compete in search.
 *
 * Here rather than in either caller because the top bar and the documentation
 * home ask the same question, and a search that finds a page in one place and
 * not the other is a search nobody trusts.
 */
export function docSearchWhere(query: string) {
  const like = { contains: query, mode: "insensitive" as const };
  return { archivedAt: null, OR: [{ title: like }, { summary: like }, { body: like }] };
}

/* -------------------------------------------------------------- the words -- */

/**
 * The headings a page can be jumped to by, in the order they appear.
 *
 * Read from the Markdown rather than from the rendered page: the outline is
 * drawn on the server, above the body, and waiting for the browser to render
 * the article before its own table of contents can exist is a page that jumps
 * once on every load.
 *
 * Fenced code is skipped — a `#` at the start of a line in a shell sample is a
 * comment, not a heading.
 */
export function headingsIn(body: string) {
  const found: { id: string; text: string; level: number }[] = [];
  let fenced = false;
  const used = new Map<string, number>();

  for (const line of body.split("\n")) {
    if (line.startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;

    const match = /^(#{2,3})\s+(.{1,120})$/.exec(line.trim());
    if (!match) continue;

    const text = match[2]!.replace(/[*_`]/g, "").trim();
    const base = slugOf(text);
    // Two sections called "What to do" are a real thing in a long runbook, and
    // two links to the same anchor would both land on the first.
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);

    found.push({ id: seen ? `${base}-${seen + 1}` : base, text, level: match[1]!.length });
  }

  return found;
}

function slugOf(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "section"
  );
}

/** Roughly how long this takes to read, in minutes. Two hundred words a minute
 *  and never less than one: a page that says "0 min read" says nothing. */
export function readMinutes(body: string) {
  return Math.max(1, Math.round(body.trim().split(/\s+/).filter(Boolean).length / 200));
}

/* ------------------------------------------------------------ preferences -- */

/** How one person likes the documentation drawn. Both halves have a default,
 *  so a person who has never said anything is never asked. */
export type DocPrefs = { shelf: "cards" | "list"; reading: boolean };

const DOC_PREFS: DocPrefs = { shelf: "cards", reading: false };

export function readDocPrefs(stored: string | null | undefined): DocPrefs {
  if (!stored) return DOC_PREFS;
  try {
    const parsed = JSON.parse(stored) as Partial<DocPrefs>;
    return {
      shelf: parsed.shelf === "list" ? "list" : "cards",
      reading: parsed.reading === true,
    };
  } catch {
    // A preference nobody can read is a preference nobody had. It is not worth
    // failing a page over.
    return DOC_PREFS;
  }
}

export function writeDocPrefs(stored: string | null | undefined, patch: Partial<DocPrefs>) {
  return JSON.stringify({ ...readDocPrefs(stored), ...patch });
}

/* ------------------------------------------------------------------- tree -- */

/** The columns anything tree-shaped needs, whatever else it carries. */
export type TreeRow = {
  id: string;
  parentId: string | null;
  position: number;
  title: string;
};

export type TreeNode<T extends TreeRow> = T & { depth: number; children: TreeNode<T>[] };

/**
 * The flat rows, nested.
 *
 * Built in one pass over a list already ordered by position: the rail draws
 * thirty documents and doing it with a query per level would be thirty
 * round trips for a sidebar. A row whose parent is missing — archived, or
 * filtered out of this list — is treated as a root rather than dropped, because
 * a document nobody can see in the tree is a document nobody can get to.
 */
export function buildTree<T extends TreeRow>(rows: T[]): TreeNode<T>[] {
  const nodes = new Map<string, TreeNode<T>>();
  for (const row of rows) nodes.set(row.id, { ...row, depth: 0, children: [] });

  const roots: TreeNode<T>[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    const parent = row.parentId ? nodes.get(row.parentId) : undefined;
    if (parent) {
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** The tree flattened back out, in reading order. What a rail draws, and what
 *  a "where does this go" picker offers. */
export function flattenTree<T extends TreeRow>(nodes: TreeNode<T>[]): TreeNode<T>[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}

/**
 * A document and everything under it.
 *
 * What the parent picker has to refuse: filing a page under one of its own
 * children would cut the branch off the tree entirely, and it would still be in
 * the database answering to nothing.
 */
export function subtreeIds(rows: TreeRow[], rootId: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    children.set(row.parentId, [...(children.get(row.parentId) ?? []), row.id]);
  }

  const found = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    for (const child of children.get(queue.shift()!) ?? []) {
      if (found.has(child)) continue;
      found.add(child);
      queue.push(child);
    }
  }
  return found;
}

/** The chain from the root down to this document, itself last. The breadcrumb,
 *  and the only thing that says where a deep page actually sits. */
export function ancestorsOf<T extends TreeRow>(rows: T[], id: string): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const chain: T[] = [];

  let current = byId.get(id);
  while (current) {
    chain.unshift(current);
    // A cycle cannot be written through the app, but a hand-edited row should
    // not hang the page that reads it.
    if (chain.length > 20) break;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

/* ------------------------------------------------------------------ slugs -- */

/**
 * How long a document's opening reads before the tree stops being scannable.
 * Used where a summary is missing and the body has to stand in for one.
 */
export function excerptOf(body: string, max = 160) {
  const text = body
    // Anything that is punctuation rather than words: fences, headings, list
    // bullets, and the address half of a link.
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[>#\-*\s]+/gm, " ")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}
