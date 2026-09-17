/**
 * The dashboard someone arranged for themselves.
 *
 * Everything below the four headline counts, the queue table and the queue
 * itself is a widget: present or absent, in whatever order and at whatever
 * width its owner wants. The fixed pieces are the ones a service desk cannot be
 * run without — what there is, whose it is, and what is on fire — and making
 * those optional would let someone build a dashboard that tells them nothing.
 *
 * The stored value is a list of `id:span` pairs, so the *order* is the
 * arrangement, the number is the width and absence is the hiding. A widget
 * nobody has heard of (renamed, retired) simply drops out on read rather than
 * breaking the page.
 */

export const WIDGETS = [
  "approvals",
  "docReview",
  "expiring",
  "replyTime",
  "categories",
  "throughput",
  "recent",
  "volume",
  "compliance",
  "pipeline",
  "priority",
  "ageing",
  "workload",
] as const;

export type WidgetId = (typeof WIDGETS)[number];

/** One widget on the page: which it is, and how many of the twelve it takes. */
export type Placed = { id: WidgetId; span: number };

/** How wide each one wants to be before anybody has dragged it. */
export const WIDGET_SPAN: Record<WidgetId, number> = {
  approvals: 5,
  docReview: 5,
  expiring: 5,
  replyTime: 7,
  categories: 5,
  throughput: 7,
  recent: 5,
  volume: 12,
  compliance: 4,
  pipeline: 4,
  priority: 4,
  ageing: 4,
  workload: 4,
};

/** Narrower than a third of the row and a chart is a smudge. */
export const MIN_SPAN = 3;
export const MAX_SPAN = 12;

/**
 * What a new account sees: the four that answer "how are we doing today", and
 * the one that answers "is anything waiting on me". A decision nobody has
 * noticed is the most expensive kind of waiting there is, and a widget somebody
 * has to go and add is one most people never find.
 */
export const DEFAULT_WIDGETS: Placed[] = [
  "approvals",
  "replyTime",
  "categories",
  "throughput",
  "recent",
].map((id) => ({ id: id as WidgetId, span: WIDGET_SPAN[id as WidgetId] }));

const KNOWN = new Set<string>(WIDGETS);

export function clampSpan(span: number) {
  if (!Number.isFinite(span)) return MIN_SPAN;
  return Math.min(MAX_SPAN, Math.max(MIN_SPAN, Math.round(span)));
}

/**
 * The stored string, as a list. Unknown ids are dropped and duplicates
 * collapsed, so a hand-edited or out-of-date value degrades to something
 * sensible instead of rendering twice or crashing.
 *
 * `id` on its own is still read: that is what every row held before widths were
 * a thing anybody could change, and it means "however wide it wants to be".
 */
export function readWidgets(stored: string | null | undefined): Placed[] {
  if (stored === null || stored === undefined) return DEFAULT_WIDGETS;

  const seen = new Set<string>();
  const chosen: Placed[] = [];
  for (const raw of stored.split(",")) {
    const [name, width] = raw.trim().split(":");
    const id = name?.trim() ?? "";
    if (!KNOWN.has(id) || seen.has(id)) continue;
    seen.add(id);
    chosen.push({
      id: id as WidgetId,
      span: width === undefined ? WIDGET_SPAN[id as WidgetId] : clampSpan(Number(width)),
    });
  }
  // An empty string is a deliberate "show me nothing", which is allowed — it is
  // only an *unset* value that means "you have never chosen".
  return chosen;
}

export function writeWidgets(chosen: Placed[]): string {
  return chosen
    .filter((one) => KNOWN.has(one.id))
    .map((one) => `${one.id}:${clampSpan(one.span)}`)
    .join(",");
}
