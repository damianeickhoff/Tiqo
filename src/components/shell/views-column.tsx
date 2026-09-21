"use client";

import Link from "next/link";
import { Fragment } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One entry in the column.
 *
 * `href` makes it a link and `onSelect` makes it a button; give it one or the
 * other. `icon` is a drawn glyph rather than a name, so the column never has to
 * know which icon set a page draws from. `count` is the number on the right in
 * mono — `null` or left out means the view has no number worth showing, which
 * is different from nought. `action` is a control that sits on the right edge
 * and appears on hover, which is where forgetting a saved view lives.
 */
export type ViewItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number | null;
  href?: string;
  onSelect?: () => void;
  active?: boolean;
  action?: React.ReactNode;
};

/** A run of entries under a small-caps heading. The heading may be left out. */
export type ViewGroup = { id: string; heading?: string; items: ViewItem[] };

/**
 * The views column: the questions a page can be asked, as a list you stand in.
 *
 * 200px on the ground beside the sheet — no card of its own, because it is the
 * ground the sheet sits on. The view you are in is a white pill with the card
 * shadow; everything else is quiet. Below `lg` the same entries become one
 * horizontal chip strip above the sheet, because a 200px column on a phone is
 * half the screen.
 *
 * Props:
 *   label    — what the nav is called to a screen reader ("Views").
 *   groups   — the headings and their entries, in the order they are drawn.
 *   save     — the quiet last row with a plus, when the page can keep views.
 *   children — drawn after the save row; where a naming form goes while it is
 *              open (pass `save` as undefined for as long as it is).
 *   footer   — pinned to the foot of the column, for a page that has one fact
 *              about the whole list rather than about any one view. Hidden
 *              below `lg`, where the column is a chip strip with no foot.
 */
export function ViewsColumn({
  label,
  groups,
  save,
  children,
  footer,
  className,
}: {
  label: string;
  groups: ViewGroup[];
  save?: { label: string; onSelect: () => void };
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "shrink-0 max-lg:overflow-x-auto lg:flex lg:w-[200px] lg:flex-col lg:overflow-y-auto lg:pt-1 lg:pl-6",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 px-5 py-2 lg:block lg:space-y-0.5 lg:p-0">
        {groups.map((group, index) => (
          <Fragment key={group.id}>
            {group.heading ? (
              <p className={cn("label px-2.5 pb-1.5 max-lg:hidden", index === 0 ? "pt-0" : "pt-3")}>
                {group.heading}
              </p>
            ) : null}
            {group.items.map((item) => (
              <Entry key={item.id} item={item} />
            ))}
          </Fragment>
        ))}

        {save ? (
          <button type="button" onClick={save.onSelect} className={cn(ROW, "text-text-3")}>
            <span aria-hidden className="flex size-[15px] shrink-0 items-center justify-center">
              <Plus size={14} strokeWidth={2.5} />
            </span>
            <span className="min-w-0 truncate">{save.label}</span>
          </button>
        ) : null}

        {children}
      </div>

      {footer ? <div className="mt-auto pt-4 max-lg:hidden">{footer}</div> : null}
    </nav>
  );
}

/**
 * One row's shape, shared by the entries and the save row: a chip below `lg`,
 * a 30px row in the column above it.
 */
const ROW =
  "flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors " +
  "lg:h-[30px] lg:w-full lg:rounded-[10px] lg:px-2.5";

function Entry({ item }: { item: ViewItem }) {
  const className = cn(
    ROW,
    item.active
      ? "bg-surface text-text shadow-[var(--highlight)]"
      : "text-text-2 hover:text-text lg:hover:bg-surface-2",
    item.action && "lg:pr-7",
  );

  const inside = (
    <>
      {item.icon ? (
        <span
          aria-hidden
          className={cn(
            "flex size-[15px] shrink-0 items-center justify-center",
            item.active ? "text-text-2" : "text-text-3",
          )}
        >
          {item.icon}
        </span>
      ) : null}
      <span className="min-w-0 truncate">{item.label}</span>
      {item.count === null || item.count === undefined ? null : (
        <span className="text-text-3 tnum ml-auto shrink-0 pl-2 font-mono text-[11px]">
          {item.count}
        </span>
      )}
    </>
  );

  return (
    <div className="group/view relative flex lg:block">
      {item.href ? (
        <Link
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={className}
        >
          {inside}
        </Link>
      ) : (
        <button
          type="button"
          aria-current={item.active ? "page" : undefined}
          onClick={item.onSelect}
          className={className}
        >
          {inside}
        </button>
      )}
      {item.action ? (
        <span className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity group-hover/view:opacity-100 focus-within:opacity-100 max-lg:hidden">
          {item.action}
        </span>
      ) : null}
    </div>
  );
}
