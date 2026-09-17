"use client";

import { createContext, useContext, useMemo } from "react";
import { ColumnHandle, useResizableColumns } from "@/components/table/resizable-columns";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * The queue's columns, and how wide each of them is.
 *
 * The behaviour is the shared one — `useResizableColumns` — so the queue, the
 * asset register and the template list all resize the same way. What is here is
 * only what is particular to this table: which columns it has and what they are
 * worth to start with.
 *
 * Every column has a width, the subject included. It used to be the one that
 * took whatever the others left, which made it the narrowest column on a wide
 * screen, gave it no edge anybody could drag, and turned every other drag into
 * a negotiation with it. Now it is a column like the rest, and a table too wide
 * for its frame scrolls sideways instead of squeezing somebody's titles.
 *
 * Widths reach the rows as CSS custom properties on the list's own container
 * rather than as props: the rows are server-rendered, and a value only CSS
 * needs is no reason to ship them to the browser.
 */
const QUEUE = [
  "reference",
  "subject",
  "plan",
  "status",
  "priority",
  "requester",
  "assignee",
  "replies",
  "created",
  "due",
  "left",
] as const;

export type ColumnKey = (typeof QUEUE)[number];

/**
 * Where each column starts, in pixels.
 *
 * Together with the gaps and the row's own padding these come to a little under
 * the width of the queue on a 1440 screen with the rail open, so a desk that
 * has dragged nothing sees the whole table and no scrollbar. Widen one and the
 * table starts to scroll, which is the honest answer — the alternative was
 * taking the pixels off the subject without being asked.
 */
const DEFAULTS: Record<ColumnKey, number> = {
  // A whole reference, because it is the thing people quote at each other and
  // half of one is no use to anybody.
  reference: 104,
  // Long enough for a real sentence, because it is the one cell anybody reads
  // rather than scans.
  subject: 340,
  plan: 44,
  status: 84,
  // Wide enough for the word above it. A column whose heading reads "P…" is a
  // column nobody can sort by on purpose.
  priority: 64,
  // Room for a face and the name beside it: both people columns say who, not
  // just which of eight drawings — see `ticket-row`.
  requester: 80,
  assignee: 80,
  replies: 52,
  created: 64,
  due: 64,
  left: 44,
};

/**
 * How far any column may be dragged — one pair of limits for all of them.
 *
 * A range per column meant this file deciding what a reference or a name is
 * worth to a desk it has never seen, and each of those guesses was a drag that
 * stopped before the reader wanted it to. The floor is only what keeps a
 * squeezed column grabbable; the ceiling is far enough out to be somebody's
 * deliberate choice rather than a wall.
 */
const MIN = 32;
const MAX = 640;

/** The key the widths are stored under, and what `resetColumns` is given. */
export const QUEUE_COLUMNS_KEY = "queue";

/**
 * The drag, offered to the headings.
 *
 * The header strip is rendered by a server component inside this one, so it
 * cannot be handed the callbacks as props — a function does not survive the
 * crossing. Context is how the strip's handles reach the table they belong to.
 */
type Resize = {
  onResizeStart: (id: ColumnKey) => (event: React.PointerEvent) => void;
  reset: (id: ColumnKey) => void;
};

const ResizeContext = createContext<Resize | null>(null);

/**
 * The frame the queue is read through.
 *
 * It is the scroller for both axes, which is what lets the headings stay put
 * while the rows scroll under them *and* the whole table slide sideways when
 * the columns come to more than the pane. Two scrollers — the page for down,
 * this for across — cannot do that: a header sticking to the top of a page that
 * is not the thing scrolling is a header that never moves at the moment you
 * need it to.
 *
 * `className` is how a page says how tall it is. The queue page gives it the
 * rest of the screen; a dashboard card gives it nothing and lets it be as tall
 * as its rows.
 */
export function TicketTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { style, container, onResizeStart, reset } = useResizableColumns({
    key: QUEUE_COLUMNS_KEY,
    columns: QUEUE,
    defaults: DEFAULTS,
    min: MIN,
    max: MAX,
  });

  const resize = useMemo(() => ({ onResizeStart, reset }), [onResizeStart, reset]);

  return (
    <ResizeContext.Provider value={resize}>
      <div
        ref={container}
        data-columns
        className={cn("@container overflow-auto", className)}
        style={style}
      >
        {/* As wide as the columns come to, and never narrower than the frame:
            what the columns do not use stays empty on the right rather than
            being handed to whichever column happens to be flexible. */}
        <div className="w-max min-w-full">{children}</div>
      </div>
    </ResizeContext.Provider>
  );
}

/**
 * The grab strip on a column's right edge.
 *
 * Every column's handle is its own trailing edge, the way a spreadsheet does
 * it: the boundary you grab is the one that moves, and the column it belongs to
 * is the one on its left. The edge used to depend on whether the column was
 * pinned left or right, which was true of the old layout and unlearnable.
 */
export function Resizer({ column }: { column: ColumnKey }) {
  const t = useMessages();
  const resize = useContext(ResizeContext);
  if (!resize) return null;

  return (
    <ColumnHandle
      label={t.tickets.resizeColumn}
      title={t.tickets.resizeHint}
      onResizeStart={resize.onResizeStart(column)}
      onReset={() => resize.reset(column)}
    />
  );
}
