"use client";

import { useRef, useState, useTransition } from "react";
import { Check, GripVertical, LayoutGrid, RotateCcw, X } from "lucide-react";
import { saveDashboard } from "@/lib/actions/dashboard";
import {
  DEFAULT_WIDGETS,
  MAX_SPAN,
  MIN_SPAN,
  clampSpan,
  writeWidgets,
  type Placed,
  type WidgetId,
} from "@/lib/dashboard-widgets";
import { Button } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * The dashboard, arranged by hand.
 *
 * Reading a dashboard and rearranging one are different activities, so they are
 * different modes: normally every card is a card, with its links and its
 * charts. Press Arrange and the same cards grow a grip and a right-hand edge to
 * pull, and nothing inside them is clickable — a page where dragging and
 * clicking share the same pixels gets one of them wrong every time.
 *
 * The cards themselves are rendered on the server and handed over as nodes:
 * this file decides where they go, and knows nothing about what is in them.
 */
export function DashboardGrid({
  arrangement,
  names,
  cards,
}: {
  arrangement: Placed[];
  names: Record<WidgetId, string>;
  cards: Record<WidgetId, React.ReactNode>;
}) {
  const t = useMessages();
  const [layout, setLayout] = useState(arrangement);
  const [arranging, setArranging] = useState(false);

  // Adding or removing a widget happens in a dialog somewhere else on the page,
  // and comes back as a new arrangement on this prop. Without this the state
  // set on mount would go on winning and the change would only show up after a
  // reload — adjusted during render rather than in an effect, which is the
  // shape React asks for when state has to follow a prop.
  const [sent, setSent] = useState(arrangement);
  if (sent !== arrangement) {
    setSent(arrangement);
    setLayout(arrangement);
  }

  const [held, setHeld] = useState<WidgetId | null>(null);
  const [, startTransition] = useTransition();

  // The arrangement as it was when this session of dragging began, so Cancel
  // has something to go back to.
  const before = useRef(arrangement);

  function commit(next: Placed[]) {
    setLayout(next);
    startTransition(() => void saveDashboard(writeWidgets(next)));
  }

  function reorder(from: WidgetId, to: WidgetId) {
    if (from === to) return;
    const at = layout.findIndex((one) => one.id === from);
    const onto = layout.findIndex((one) => one.id === to);
    if (at < 0 || onto < 0) return;
    const next = [...layout];
    const [moved] = next.splice(at, 1);
    next.splice(onto, 0, moved!);
    setLayout(next);
  }

  function resize(id: WidgetId, span: number) {
    setLayout((current) =>
      current.map((one) => (one.id === id ? { ...one, span: clampSpan(span) } : one)),
    );
  }

  if (layout.length === 0) {
    return (
      <p className="border-line text-text-3 rounded-card text-md border border-dashed px-4 py-10 text-center">
        {t.dashboard.nothingShown}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {arranging ? (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                before.current = layout;
                commit(layout);
                setArranging(false);
              }}
            >
              <Check size={14} strokeWidth={2.5} />
              {t.common.done}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setLayout(before.current);
                setArranging(false);
              }}
            >
              <X size={14} />
              {t.common.cancel}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setLayout(DEFAULT_WIDGETS)}
            >
              <RotateCcw size={13} />
              {t.dashboard.resetLayout}
            </Button>

            <p className="text-text-3 ml-auto text-sm">{t.dashboard.arrangeHint}</p>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              before.current = layout;
              setArranging(true);
            }}
            className="text-text-2 hover:bg-surface-3 hover:text-text ml-auto inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-base font-medium transition-colors"
          >
            <LayoutGrid size={14} />
            {t.dashboard.arrange}
          </button>
        )}
      </div>

      {/* Twelve columns, so a widget can ask for a third, a half or the lot
          and the row still closes. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {layout.map((one) => (
          <div
            key={one.id}
            style={{ gridColumn: `span ${one.span}` }}
            draggable={arranging}
            onDragStart={(event) => {
              setHeld(one.id);
              event.dataTransfer.effectAllowed = "move";
              // Firefox will not start a drag without something on the payload.
              event.dataTransfer.setData("text/plain", one.id);
            }}
            onDragEnd={() => {
              setHeld(null);
              commit(layout);
            }}
            onDragOver={(event) => {
              if (!arranging || !held) return;
              event.preventDefault();
              reorder(held, one.id);
            }}
            className={cn("relative", arranging && "cursor-grab", held === one.id && "opacity-40")}
          >
            {/* In arrange mode the card is a tile, not a page: the pointer
                shield stops a drag from ending as a click on whatever link
                happened to be under it. */}
            <div className={cn(arranging && "pointer-events-none select-none")}>
              {cards[one.id]}
            </div>

            {arranging ? (
              <>
                <span
                  aria-hidden
                  className="border-brand/45 pointer-events-none absolute inset-0 rounded-[var(--radius-card)] border-2 border-dashed"
                />

                <span className="bg-surface border-line text-text-2 absolute top-2 left-2 flex items-center gap-1 rounded-full border py-1 pr-2 pl-1.5 text-xs font-medium shadow-[var(--shadow-sm)]">
                  <GripVertical size={12} />
                  {names[one.id]}
                </span>

                <ResizeEdge
                  span={one.span}
                  onResize={(span) => resize(one.id, span)}
                  onDone={() => commit(layout)}
                />
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The right-hand edge of a card, pulled to change how many columns it takes.
 *
 * It measures the grid it is in rather than assuming a column width: the row is
 * twelve of whatever the page is wide, and that changes with the sidebar.
 */
function ResizeEdge({
  span,
  onResize,
  onDone,
}: {
  span: number;
  onResize: (span: number) => void;
  onDone: () => void;
}) {
  const t = useMessages();
  const from = useRef<{ x: number; span: number; column: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={t.dashboard.cardWidth}
      title={t.dashboard.cardWidth}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);

        const grid = event.currentTarget.closest(".grid");
        const width = grid?.getBoundingClientRect().width ?? 0;
        // Eleven gaps of 16px between twelve columns.
        from.current = { x: event.clientX, span, column: (width - 11 * 16) / 12 + 16 };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (!from.current) return;
        const moved = (event.clientX - from.current.x) / Math.max(1, from.current.column);
        onResize(from.current.span + moved);
      }}
      onPointerUp={() => {
        from.current = null;
        setDragging(false);
        onDone();
      }}
      className={cn(
        "absolute inset-y-3 -right-2 z-20 w-4 cursor-col-resize",
        "after:bg-brand after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:rounded-full after:transition-opacity",
        dragging ? "after:opacity-100" : "after:opacity-40 hover:after:opacity-100",
      )}
    >
      {dragging ? (
        <span className="bg-brand text-bg absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-1.5 py-0.5 font-mono text-xs font-semibold">
          {Math.min(MAX_SPAN, Math.max(MIN_SPAN, span))}
        </span>
      ) : null}
    </span>
  );
}
