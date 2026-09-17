"use client";

import type { ReactNode } from "react";
import {
  ColumnHandle,
  SortHeader,
  useResizableColumns,
  type SortDir,
} from "@/components/table/resizable-columns";
import { CI_ROW } from "@/lib/ci-columns";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/** One column at the top of the register: what it is called, how wide it starts,
 *  and where pressing it goes — or nothing, where it cannot be ordered by. */
export type CiHead = { id: string; label: string; width: number; href?: string };

/**
 * The register's headings, and the widths every row underneath is drawn to.
 *
 * The one client piece of a table that is otherwise rendered on the server: the
 * rows are content and belong there, but a width somebody is dragging is not
 * content. So the frame owns the widths, writes them onto itself as custom
 * properties, and the server-rendered rows read `--ci-cols` through `CI_ROW`
 * without knowing anything about it.
 *
 * `columns` and `defaults` are rebuilt on every render rather than memoised,
 * which is safe because the store behind `useResizableColumns` caches the
 * widths on its first read and hands the same object back afterwards — and it
 * is what lets the column set change under it when somebody ticks a new one.
 * A column the store has never seen falls back to the width its kind starts at,
 * here and in the drag.
 */
export function CiTableFrame({
  storeKey,
  name,
  heads,
  sort,
  dir,
  selectAll,
  children,
}: {
  /// Which table's widths these are — one set per type, so a register of
  /// laptops and a register of licences are not fighting over the same numbers.
  storeKey: string;
  name: CiHead;
  heads: CiHead[];
  sort: string;
  dir: SortDir;
  /// The tick in the heading. Handed in because only the register that offers
  /// selection knows the ids on this page.
  selectAll: ReactNode;
  children: ReactNode;
}) {
  const t = useMessages();

  // Ids stay themselves — an attribute column really is called `attr:serial`.
  // Spelling one for CSS is the primitive's job, and `gridTemplate` comes back
  // already written in whatever it spelled them as.
  const all = [name, ...heads];
  const columns = all.map((head) => head.id);
  const defaults = Object.fromEntries(all.map((head) => [head.id, head.width]));

  const {
    style: widths,
    gridTemplate,
    container,
    onResizeStart,
    reset,
  } = useResizableColumns({
    key: storeKey,
    columns,
    defaults,
  });

  const style = {
    ...widths,
    // The tick column, then the columns themselves. Nothing after them: what
    // the columns do not use stays empty, the way a spreadsheet leaves it,
    // rather than being handed to a track nobody asked for.
    "--ci-cols": `1rem ${gridTemplate}`,
  } as React.CSSProperties;

  return (
    <div ref={container} className="w-fit min-w-full" style={style}>
      <div className={cn(CI_ROW, "border-line bg-bg text-text-3 sticky top-0 z-10 border-b py-2")}>
        {selectAll}
        {all.map((head) => (
          // Never `overflow-hidden`: the grab strip hangs into the gap beside
          // the heading, and a cell that clips its own overflow clips the strip
          // away — which looks like a handle and cannot be picked up.
          <span key={head.id} className="label relative min-w-0">
            {head.href ? (
              <SortHeader
                field={head.id}
                sort={sort}
                dir={dir}
                label={head.label}
                href={head.href}
              />
            ) : (
              <span className="block truncate">{head.label}</span>
            )}
            <ColumnHandle
              onResizeStart={onResizeStart(head.id)}
              onReset={() => reset(head.id)}
              label={t.tickets.resizeColumn}
              title={t.tickets.resizeHint}
            />
          </span>
        ))}
      </div>

      {children}
    </div>
  );
}
