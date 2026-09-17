"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { clearColumnWidths, readColumnWidths, writeColumnWidths } from "@/lib/ui-preferences";
import { nextSort, type SortDir } from "@/components/table/sort";
import { cn } from "@/lib/utils";

/*
 * The parts every table on the desk shares: columns you can drag the edge of,
 * and headings you can order by.
 *
 * Three lists want the same two behaviours — the ticket queue, the asset
 * register, the mail templates — and three copies of a pointer-drag is three
 * chances for one of them to feel different from the others. Nothing here knows
 * what a ticket is, and nothing here reads the dictionary: labels arrive as
 * props so a table can name its own handles.
 *
 * The model is the spreadsheet's, because that is the one everybody already
 * knows: every column has a width of its own, the handle on a column's right
 * edge belongs to that column, dragging it right makes it wider and left makes
 * it narrower, and nothing else on the row moves. A table wider than its frame
 * scrolls sideways; a table narrower than its frame leaves the rest of the
 * frame empty rather than stretching somebody's column to fill it.
 */

export type { SortDir };

type Drag<K extends string> = {
  id: K;
  /// Where the pointer was when it went down, and how wide the column was then.
  /// Everything during the drag is measured from these rather than from the
  /// last move, so a fast pointer cannot accumulate rounding and drift off the
  /// boundary it is holding.
  x: number;
  width: number;
  min: number;
  /// The width the last pointer move asked for, waiting for its frame.
  latest: number | null;
};

/**
 * A column id as a custom property name can spell it.
 *
 * An id is the caller's own — an attribute column is `attr:serial`, because
 * that is what it is called everywhere else — and a colon is not something a
 * custom property may contain. One invalid declaration takes the whole style
 * attribute with it, so the spelling happens here rather than in every caller.
 */
const cssName = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "-");

/** The custom property a column's width is published under. */
export const columnVar = (id: string) => `--col-${cssName(id)}`;

/**
 * One table's widths, as a store rather than as state synced from an effect.
 *
 * The server has no browser to ask, so it renders the defaults; the stored
 * widths arrive on the client's own first snapshot. `useSyncExternalStore` is
 * the shape React has for exactly this, and it does it without an effect that
 * sets state on mount. Keyed, because two tables on one page are two stores.
 */
type Store = { widths: Record<string, number> | null; listeners: Set<() => void> };

const stores = new Map<string, Store>();

function storeOf(key: string) {
  let store = stores.get(key);
  if (!store) {
    store = { widths: null, listeners: new Set() };
    stores.set(key, store);
  }
  return store;
}

function announce(store: Store) {
  for (const listener of store.listeners) listener();
}

/**
 * Every column of one table back to the width it was born at.
 *
 * Exported on its own rather than only from the hook because the control that
 * offers it is rarely inside the table — on the queue it is a menu up in the
 * filter bar — and a table's widths belong to the table's key, not to whoever
 * happens to be rendering it.
 */
export function resetColumns(key: string) {
  const store = storeOf(key);
  store.widths = null;
  clearColumnWidths(key);
  announce(store);
}

/** Nothing stored yet — one object, because a snapshot React caches may not be
 *  a new one every time it is asked for. */
const EMPTY: Record<string, number> = {};

/**
 * How wide each column of a table is, remembered per reader.
 *
 * Widths reach the cells as CSS custom properties on the container rather than
 * as props: the rows may well be server-rendered, and a number only CSS needs
 * is no reason to ship them to the browser. It is also what makes the drag feel
 * like a drag — see `onResizeStart`.
 *
 * `columns` and `defaults` may be rebuilt on every render — a register whose
 * column set is somebody's choice does exactly that. The store caches the
 * widths on its first read, so a column it has never seen falls back to its
 * default here and in the drag.
 */
export function useResizableColumns<K extends string>({
  key,
  columns,
  defaults,
  min = 24,
  max = 640,
}: {
  key: string;
  columns: readonly K[];
  defaults: Record<K, number>;
  /// One floor for every column, or a floor per column for a table where a
  /// date and a subject line are not worth the same squeeze.
  min?: number | Partial<Record<K, number>>;
  max?: number;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const drag = useRef<Drag<K> | null>(null);
  const frame = useRef(0);

  const floorOf = useCallback((id: K) => (typeof min === "number" ? min : (min[id] ?? 24)), [min]);

  const subscribe = useCallback(
    (listener: () => void) => {
      const store = storeOf(key);
      store.listeners.add(listener);
      return () => void store.listeners.delete(listener);
    },
    [key],
  );

  const snapshot = useCallback(() => {
    const store = storeOf(key);
    store.widths ??= (readColumnWidths(key) ?? {}) as Record<string, number>;
    return store.widths;
  }, [key]);

  const server = useCallback(() => EMPTY, []);

  const stored = useSyncExternalStore(subscribe, snapshot, server);

  /** What every column is actually worth right now: what was stored for it, or
   *  what it starts at. */
  const widths = useMemo(
    () =>
      Object.fromEntries(
        columns.map((id) => {
          const found = stored[id];
          return [id, typeof found === "number" ? found : defaults[id]];
        }),
      ) as Record<K, number>,
    [columns, defaults, stored],
  );

  const put = useCallback(
    (id: K, width: number) => {
      const store = storeOf(key);
      const next = { ...snapshot(), [id]: width };
      store.widths = next;
      writeColumnWidths(key, next);
      announce(store);
    },
    [key, snapshot],
  );

  /**
   * The drag itself, and the reason it feels like a spreadsheet rather than
   * like a form: while the pointer is down nothing re-renders. The width goes
   * straight onto the container as a custom property inside an animation frame,
   * so the boundary is repainted with the pointer instead of a render behind
   * it. React hears about it once, when the pointer comes up.
   */
  const onResizeStart = useCallback(
    (id: K) => (event: React.PointerEvent) => {
      event.preventDefault();
      const node = container.current;
      if (!node) return;

      drag.current = {
        id,
        x: event.clientX,
        width: widths[id] ?? defaults[id],
        min: floorOf(id),
        latest: null,
      };

      // The cursor belongs to the whole window for the length of the drag: the
      // pointer leaves the four-pixel strip within the first frame, and a
      // cursor that changes back mid-drag reads as the drag having stopped.
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const move = (moved: PointerEvent) => {
        const from = drag.current;
        if (!from) return;
        // The handle is the column's right edge, so the column grows by exactly
        // what the pointer has travelled — no more, and nothing else moves.
        const wanted = from.width + (moved.clientX - from.x);
        from.latest = Math.round(Math.min(max, Math.max(from.min, wanted)));
        if (frame.current) return;
        frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          const now = drag.current;
          if (now?.latest) node.style.setProperty(columnVar(now.id), `${now.latest}px`);
        });
      };

      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        if (frame.current) {
          cancelAnimationFrame(frame.current);
          frame.current = 0;
        }
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        const from = drag.current;
        drag.current = null;
        if (from?.latest && from.latest !== from.width) put(from.id, from.latest);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [widths, defaults, floorOf, max, put],
  );

  /** One column back to what it was born as — the way out of a drag that went
   *  somewhere useless, without taking the other nine with it. */
  const reset = useCallback(
    (id: K) => {
      container.current?.style.removeProperty(columnVar(id));
      put(id, defaults[id]);
    },
    [put, defaults],
  );

  /** All of them, for the menu that offers it. */
  const resetAll = useCallback(() => {
    for (const id of columns) container.current?.style.removeProperty(columnVar(id));
    resetColumns(key);
  }, [columns, key]);

  const style = useMemo(
    () =>
      Object.fromEntries(
        columns.map((id) => [columnVar(id), `${widths[id]}px`]),
      ) as React.CSSProperties,
    [columns, widths],
  );

  /** The tracks, for a table laid out as a grid. Each one reads the same custom
   *  property the drag writes, so a grid follows the pointer like everything
   *  else. */
  const gridTemplate = useMemo(
    () => columns.map((id) => `var(${columnVar(id)})`).join(" "),
    [columns],
  );

  return { widths, style, gridTemplate, container, onResizeStart, reset, resetAll };
}

/**
 * The grab strip on a column's right edge.
 *
 * A hairline that only shows itself under the pointer: a list is read far more
 * often than it is rearranged, and a row of visible handles would put furniture
 * above every table. It straddles the gap so there is something to aim at
 * without stealing pixels from either heading, and it is taller than the text
 * for the same reason — a strip one line high is a target you miss.
 *
 * The clipping rule for whoever renders it: `overflow: hidden` on the cell trims
 * the strip away, which is how a row of handles ends up looking present and
 * being ungrabbable. Clip the text inside the cell, never the cell.
 */
export function ColumnHandle({
  onResizeStart,
  onReset,
  label,
  title,
  className,
}: {
  onResizeStart: (event: React.PointerEvent) => void;
  onReset: () => void;
  label: string;
  title?: string;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title={title}
      onPointerDown={(event) => {
        setDragging(true);
        onResizeStart(event);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onDoubleClick={() => onReset()}
      className={cn(
        "absolute top-1/2 -right-2 z-20 h-9 w-4 -translate-y-1/2 cursor-col-resize touch-none select-none",
        "after:bg-brand after:absolute after:inset-y-2 after:left-1/2 after:w-0.5 after:rounded-full after:opacity-0 after:transition-opacity",
        dragging ? "after:opacity-100" : "hover:after:opacity-100",
        className,
      )}
    />
  );
}

/**
 * A heading that orders the table by its own column.
 *
 * Takes an `href` where the order lives in the URL — so it composes with
 * whatever else the address is filtering by, and survives being shared — and an
 * `onChange` where the table sorts its own rows in the browser. One of the two,
 * never both.
 *
 * The `href` is the address a click should land on, worked out with `nextSort`,
 * rather than a function of it: a server component may not hand a client one a
 * function, and the header of a server-rendered table is exactly where this is
 * used. `onChange` has no such problem and is given the next order itself.
 *
 * The arrow only appears on the column actually in force. A row of ten arrows
 * saying "you could sort by this" is ten marks that mean nothing, and the one
 * that means something is then indistinguishable.
 */
export function SortHeader<F extends string>({
  field,
  sort,
  dir,
  label,
  align = "left",
  href,
  onChange,
  className,
}: {
  field: F;
  sort: string | undefined;
  dir: SortDir | undefined;
  label: string;
  align?: "left" | "right";
  href?: string;
  onChange?: (next: { sort: F; dir: SortDir }) => void;
  className?: string;
}) {
  const active = sort === field;
  const Arrow = active && dir === "desc" ? ArrowDown : ArrowUp;

  const inner = (
    <>
      <span className="truncate">{label}</span>
      {active ? <Arrow size={11} strokeWidth={2.5} className="shrink-0" /> : null}
    </>
  );

  const classes = cn(
    "flex w-full items-center gap-1 transition-colors",
    align === "right" ? "justify-end" : "justify-start",
    active ? "text-text" : "hover:text-text",
    className,
  );

  return href ? (
    <Link href={href} className={classes}>
      {inner}
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => onChange?.(nextSort(field, sort, dir))}
      className={classes}
    >
      {inner}
    </button>
  );
}
