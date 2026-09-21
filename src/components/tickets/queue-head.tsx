"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, Columns3, RotateCcw } from "lucide-react";
import { DEFAULT_DIR, DEFAULT_SORT, QUEUE_SORTS, type QueueSort } from "@/lib/tickets";
import { nextSort, type SortDir } from "@/components/table/sort";
import { resetColumns } from "@/components/table/resizable-columns";
import { QUEUE_COLUMNS_KEY } from "@/components/tickets/ticket-table";
import { matchView } from "@/components/tickets/queue-views";
import { useMessages } from "@/components/shell/instance-context";
import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The queue's head, on the ground above the sheet.
 *
 * The title, then what is being looked at in mono — the view's name and how
 * many rows it holds — then the two things you can do to the table itself. It
 * reads the address rather than being told, because the view and the order are
 * both in it and a second copy handed down as props would be a second thing to
 * keep in step.
 */
export function QueueHead({ total }: { total: number }) {
  const t = useMessages();
  const params = useSearchParams();
  const view = matchView(new URLSearchParams(params.toString()));

  return (
    <div className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2 lg:px-6">
      <h1 className="text-lg leading-tight font-semibold tracking-[-0.01em]">{t.tickets.title}</h1>
      <p className="text-text-3 tnum font-mono text-xs">
        {`${view ? t.tickets[view.label] : t.tickets.viewFiltered} · ${total}`}
      </p>
      <div className="ml-auto flex items-center gap-2">
        <ColumnsMenu />
        <SortMenu />
      </div>
    </div>
  );
}

/** What a column is called where it is picked as an order rather than read as
 *  a heading — the same words either way. */
function sortLabel(field: QueueSort, t: Messages) {
  switch (field) {
    case "reference":
      return t.tickets.colReference;
    case "subject":
      return t.tickets.colSubject;
    case "status":
      return t.ticket.status;
    case "priority":
      return t.ticket.priority;
    case "requester":
      return t.tickets.colRequester;
    case "assignee":
      return t.tickets.colAssignee;
    case "replies":
      return t.tickets.colReplies;
    case "created":
      return t.tickets.colCreated;
    case "due":
      return t.tickets.colDue;
    case "left":
      return t.tickets.colLeft;
  }
}

/**
 * The order, where somebody who cannot see the column can still set it.
 *
 * The headings remain the quick way; this is the same act for a column that is
 * off the edge of a narrow table, and it toggles the same way — picking the
 * order you are already in turns it round.
 */
function SortMenu() {
  const t = useMessages();
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  const sort = QUEUE_SORTS.find((field) => field === params.get("sort")) ?? DEFAULT_SORT;
  const dir: SortDir =
    params.get("dir") === "asc" ? "asc" : params.get("dir") === "desc" ? "desc" : DEFAULT_DIR;

  function pick(field: QueueSort) {
    const next = nextSort(field, sort, dir);
    const query = new URLSearchParams(params.toString());
    query.set("sort", next.sort);
    query.set("dir", next.dir);
    // A reorder starts again at the first page: page four of the old order is
    // not page four of the new one.
    query.delete("page");
    setOpen(false);
    router.push(`/tickets?${query.toString()}`);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="text-text-2 hover:text-text bg-surface rounded-control flex h-8 items-center gap-1.5 border border-transparent px-2.5 text-sm font-medium whitespace-nowrap shadow-[var(--highlight)] transition-colors"
      >
        {`${t.tickets.sortBy}: ${sortLabel(sort, t)}`}
        <ChevronDown size={13} strokeWidth={2} className="text-text-3" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="animate-rise bg-surface rounded-card absolute right-0 z-50 mt-2 w-52 p-1 shadow-[var(--shadow-float)]"
          >
            {QUEUE_SORTS.map((field) => (
              <button
                key={field}
                type="button"
                role="menuitem"
                onClick={() => pick(field)}
                className={cn(
                  "hover:bg-surface-2 rounded-control flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-base font-medium transition-colors",
                  field === sort ? "text-text" : "text-text-2",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{sortLabel(field, t)}</span>
                {field === sort ? (
                  dir === "asc" ? (
                    <ArrowUp size={13} className="text-text-3" />
                  ) : (
                    <ArrowDown size={13} className="text-text-3" />
                  )
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * What can be done to the columns themselves.
 *
 * One item so far, and it is the one a drag needs behind it: a double-click on
 * a handle puts that column back, and this puts all of them back for somebody
 * who has dragged the table somewhere they cannot read.
 */
function ColumnsMenu() {
  const t = useMessages();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="text-text-2 hover:text-text bg-surface rounded-control flex h-8 items-center gap-1.5 border border-transparent px-2.5 text-sm font-medium whitespace-nowrap shadow-[var(--highlight)] transition-colors"
      >
        <Columns3 size={13} strokeWidth={2} />
        {t.tickets.columns}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="animate-rise bg-surface rounded-card absolute right-0 z-50 mt-2 w-52 p-1 shadow-[var(--shadow-float)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                resetColumns(QUEUE_COLUMNS_KEY);
                setOpen(false);
              }}
              className="hover:bg-surface-2 rounded-control flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-base font-medium transition-colors"
            >
              <RotateCcw size={14} className="text-text-3" />
              {t.tickets.resetColumns}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
