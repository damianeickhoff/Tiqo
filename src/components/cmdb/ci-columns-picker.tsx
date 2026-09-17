"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Columns3 } from "lucide-react";
import { saveCiColumns } from "@/lib/actions/cmdb";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type ColumnChoice = { id: string; label: string };

/**
 * Which columns this view shows.
 *
 * Every attribute the type defines is offered, which is the point — a register
 * that can record a warranty date and not show it is a register somebody keeps
 * a spreadsheet beside. The name is not in the list: it is the row's subject,
 * and a table whose rows cannot be identified is not a table.
 *
 * Ticking writes immediately. It is a verb on its own, and the preference lives
 * on the account rather than in the browser for the same reason the dashboard's
 * does — a register somebody arranged should follow them to the next machine.
 */
export function CiColumnsPicker({
  typeKey,
  available,
  chosen,
}: {
  typeKey: string;
  available: ColumnChoice[];
  chosen: string[];
}) {
  const t = useMessages();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // The server's list is the truth; this is only what it looks like while the
  // save is in flight. Mirroring the prop into state instead would leave a stale
  // copy behind whenever the page revalidated under it.
  const [picked, showPicked] = useOptimistic(chosen);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  function toggle(id: string) {
    // Kept in the order the type defines rather than the order they were
    // ticked, so the table does not rearrange itself under somebody.
    const next = picked.includes(id)
      ? picked.filter((kept) => kept !== id)
      : available
          .filter((column) => column.id === id || picked.includes(column.id))
          .map((c) => c.id);
    startTransition(async () => {
      showPicked(next);
      await saveCiColumns(typeKey, next);
    });
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(
          "bg-surface text-text-2 hover:text-text flex h-8 items-center gap-1.5 rounded-full border border-transparent px-2.5 text-sm font-medium shadow-[var(--highlight)] transition-colors",
          pending && "opacity-60",
        )}
      >
        <Columns3 size={13} />
        {t.cmdb.columns}
      </button>

      {open ? (
        <div className="animate-rise bg-surface rounded-card absolute right-0 z-30 mt-1 max-h-[60vh] w-60 overflow-y-auto p-1 shadow-[var(--shadow-float)]">
          {available.length === 0 ? (
            <p className="text-text-3 px-2.5 py-3 text-sm">{t.cmdb.noColumns}</p>
          ) : (
            available.map((column) => (
              <label
                key={column.id}
                className="hover:bg-surface-2 rounded-control flex cursor-pointer items-center gap-2.5 px-2.5 py-1.5 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={picked.includes(column.id)}
                  onChange={() => toggle(column.id)}
                  className="accent-brand size-4 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate text-base">{column.label}</span>
              </label>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
