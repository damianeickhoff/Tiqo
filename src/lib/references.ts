/**
 * References between things.
 *
 * A reference is stored as an ordinary Markdown link — `[#INC-2609 0011](/tickets/13)`,
 * `[#INF](/projects/INF)`, `[@sam](/people/cmt…)`. Three reasons it is not a
 * token of its own:
 *
 *   · it renders and links with no lookup at all, so a thread of fifty comments
 *     does not become fifty queries;
 *   · the text stays readable if it is ever exported, quoted or emailed;
 *   · a reference to something later deleted degrades to a dead link rather
 *     than to a token nothing can resolve.
 *
 * What is *not* free is the trail — "who referred what" has to be worked out
 * from the body when it is saved, which is what `referencesIn` is for.
 */

export type ReferenceKind = "ticket" | "project" | "user" | "doc" | "asset";

export type Reference = { kind: ReferenceKind; id: string; label: string; href: string };

/**
 * `[label](/tickets/12)`, `[label](/projects/INF)`, `[label](/people/abc)`,
 * `[label](/docs/OPS/vpn-box)`, `[label](/cmdb/abc)`.
 *
 * A document takes two segments where everything else takes one: its address is
 * the shelf it stands on and its own name, and neither half identifies it
 * alone. The shape is checked below rather than in the pattern, so a malformed
 * address degrades to an ordinary link instead of to half a reference.
 */
const LINK =
  /\[([^\]]{1,120})\]\(\/(tickets|projects|people|docs|cmdb)\/([A-Za-z0-9_-]{1,60}(?:\/[A-Za-z0-9_-]{1,80})?)\)/g;

const KIND: Record<string, ReferenceKind> = {
  tickets: "ticket",
  projects: "project",
  people: "user",
  docs: "doc",
  cmdb: "asset",
};

/**
 * Every distinct thing a piece of text points at.
 *
 * Deduplicated: naming the same ticket three times in one comment is one
 * reference, not three lines in the history.
 */
export function referencesIn(body: string): Reference[] {
  const found = new Map<string, Reference>();

  for (const match of body.matchAll(LINK)) {
    const kind = KIND[match[2]!];
    if (!kind) continue;

    const id = match[3]!;
    // Exactly one shape per kind: a document is a space and a slug, everything
    // else is a single identifier. Anything else is somebody's own link that
    // happens to start with one of our words.
    if ((kind === "doc") !== id.includes("/")) continue;

    const key = `${kind}:${id}`;
    if (!found.has(key)) {
      found.set(key, { kind, id, label: match[1]!, href: `/${match[2]}/${id}` });
    }
  }

  return [...found.values()];
}

/**
 * What a reference reads as inside a sentence.
 *
 * A document keeps its own title with nothing in front of it: "INC-2609 0011"
 * and "INF" are codes that need a sigil to be read as names, and "Restarting
 * the VPN concentrator" is already a name.
 *
 * One function for both the plain-text editor and the document one, because a
 * reference that reads differently depending on which box it was written in is
 * two references.
 */
export function referenceLabel(reference: { kind: ReferenceKind; label: string }) {
  const sigil = reference.kind === "user" ? "@" : reference.kind === "doc" ? "" : "#";
  return `${sigil}${reference.label}`;
}

/** How a reference is written into the text someone is typing. */
export function referenceMarkdown(reference: { kind: ReferenceKind; href: string; label: string }) {
  return `[${referenceLabel(reference)}](${reference.href})`;
}

/**
 * The word being typed at the caret, if it started with `#` or `@`.
 *
 * Returns where it starts so the caller can replace exactly that run when a
 * suggestion is chosen.
 *
 * One space is allowed inside the run, because a reference in this app has one
 * in it — "INC-2609 0011". It is only allowed after something has been typed,
 * so "we need # more" stays prose rather than becoming a search; and the run is
 * bounded, so a stray hash never turns the rest of a paragraph into a query.
 */
export function triggerAt(text: string, caret: number) {
  const upto = text.slice(0, caret);
  const match = /(^|[\s(])([#@])((?:[^\s#@]{1,30}(?:\s[^\s#@]{0,20})?)?)$/.exec(upto);
  if (!match) return null;

  return {
    sigil: match[2] as "#" | "@",
    query: match[3] ?? "",
    from: caret - (match[3]?.length ?? 0) - 1,
    to: caret,
  };
}

/**
 * A ticket reference as it is written down: `INC-2609 0011`.
 *
 * Distinctive enough to find in ordinary prose, which is what makes it safe to
 * pick up without a `#` in front of it. A project key or a username is not —
 * "INF" and "sam" are words — so those are only recognised with their sigil.
 */
const BARE_TICKET = /(?<![\w#[])#?([A-Z]{3}-\d{4} \d{4})\b/g;
const BARE_PROJECT = /(?<![\w[])#([A-Z][A-Z0-9]{1,9})\b/g;
const BARE_USER = /(?<![\w[])@([a-zA-Z0-9._-]{2,40})\b/g;

/** One thing found in the text that could be turned into a reference. */
export type Mentioned = { kind: ReferenceKind; needle: string; from: number; to: number };

/**
 * Everything in a piece of text that looks like a reference but has not been
 * made into one — someone pasting a ticket number rather than picking it from
 * the list.
 *
 * Runs already inside a link, a code span or a fenced block are left alone: a
 * reference that is already a reference must not be wrapped twice, and text
 * shown as code is being quoted rather than pointed at.
 */
export function looseReferencesIn(text: string): Mentioned[] {
  const skip = protectedRanges(text);
  const inside = (from: number, to: number) =>
    skip.some(([start, end]) => from < end && to > start);

  const found: Mentioned[] = [];
  const scan = (pattern: RegExp, kind: ReferenceKind) => {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const from = match.index!;
      const to = from + match[0].length;
      if (inside(from, to)) continue;
      found.push({ kind, needle: match[1]!, from, to });
    }
  };

  scan(BARE_TICKET, "ticket");
  scan(BARE_PROJECT, "project");
  scan(BARE_USER, "user");

  // Left to right, so replacing them back to front keeps every offset valid.
  return found.sort((a, b) => a.from - b.from);
}

/** Spans of the text that are already a link, a code span or a fenced block. */
function protectedRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  for (const pattern of [/\[[^\]]*\]\([^)\s]*\)/g, /`[^`]*`/g, /```[\s\S]*?(?:```|$)/g]) {
    for (const match of text.matchAll(pattern)) {
      ranges.push([match.index!, match.index! + match[0].length]);
    }
  }
  return ranges;
}

/** Puts a resolved reference back into the text in place of what was typed. */
export function replaceRange(text: string, from: number, to: number, replacement: string) {
  return `${text.slice(0, from)}${replacement}${text.slice(to)}`;
}
