import Link from "next/link";
import { getMessages, getSettings, dateLocaleOf } from "@/lib/settings";
import type { FieldSpec } from "@/lib/cmdb";
import { attrKeyOf, columnWidth, CI_ROW } from "@/lib/ci-columns";
import { CiTableFrame } from "@/components/cmdb/ci-table-frame";
import { CiGlyph } from "@/components/cmdb/ci-glyph";
import { LifecyclePill } from "@/components/cmdb/ci-lifecycle";
import { CiAllCheck, CiRowCheck } from "@/components/cmdb/ci-selection";
import {
  CiCell,
  ciFieldOf,
  ciHeading,
  type CiFieldsByType,
  type CiLookups,
  type CiTableRow,
} from "@/components/cmdb/ci-table";
import { cn } from "@/lib/utils";

export type CiSplitRow = CiTableRow & {
  /// The serial or the model, under the name. What a person says next after the
  /// name, and the difference between forty rows called LT-something and forty
  /// laptops you can tell apart.
  subtitle: string | null;
};

/** Narrower than in List, because the pane beside it is the thing being read
 *  and the name still has a second line under it. */
const SPLIT_NAME_WIDTH = 240;

/**
 * The register beside a pane, in the columns this person keeps.
 *
 * The same choice as List, from the same picker: which columns are worth their
 * width is a thing about the reader and the type, not about which shape the
 * register happens to be in — and a column that disappeared on the way into
 * Split was a column somebody had to switch shapes to see. Where the set is
 * wider than the pane the rows scroll sideways rather than dropping what will
 * not fit, because a hidden column is one nobody can find again.
 */
export async function CiSplitTable({
  items,
  storeKey,
  columns,
  fields,
  fieldsByType,
  lookups,
  peek,
  rowHref,
}: {
  items: CiSplitRow[];
  storeKey: string;
  columns: string[];
  fields: FieldSpec[];
  fieldsByType: CiFieldsByType;
  lookups: CiLookups;
  /// Which row the pane is showing.
  peek: string | null;
  rowHref: (id: string) => string;
}) {
  const [t, settings] = await Promise.all([getMessages(), getSettings()]);
  const dateFormat = new Intl.DateTimeFormat(dateLocaleOf(settings), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const byKey = new Map(fields.map((field) => [field.key, field]));

  return (
    <CiTableFrame
      storeKey={storeKey}
      name={{ id: "name", label: t.cmdb.name, width: SPLIT_NAME_WIDTH }}
      heads={columns.map((column) => {
        const key = attrKeyOf(column);
        return {
          id: column,
          label: ciHeading(column, fields, t),
          width: columnWidth(column, key ? byKey.get(key) : undefined),
        };
      })}
      /* Nothing to sort by from here: in Split the heading row is a ruler for
         the pane's list, and the order is the one the register was opened in.
         Pressing a heading to reorder is what List is for. */
      sort=""
      dir="asc"
      selectAll={<CiAllCheck ids={items.map((item) => item.id)} label={t.cmdb.selectPage} />}
    >
      <ul>
        {items.map((item) => {
          const on = item.id === peek;
          return (
            <li key={item.id} className="border-line relative border-b">
              {on ? (
                <i
                  aria-hidden
                  className="bg-brand absolute top-2 bottom-2 left-0 z-10 w-0.5 rounded-r-sm"
                />
              ) : null}
              <div
                className={cn(
                  CI_ROW,
                  "transition-colors",
                  on ? "bg-[var(--brand-tint)]" : "hover:bg-surface-2",
                )}
              >
                <CiRowCheck id={item.id} label={t.cmdb.selectRow(item.name)} />
                <Link
                  href={rowHref(item.id)}
                  scroll={false}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "flex min-w-0 items-center gap-3 py-2",
                    item.lifecycle === "RETIRED" && "opacity-55",
                  )}
                >
                  <CiGlyph icon={item.type.icon} color={item.type.color} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-base font-semibold">{item.name}</span>
                    {item.subtitle ? (
                      <span className="text-text-3 block truncate font-mono text-xs">
                        {item.subtitle}
                      </span>
                    ) : null}
                  </span>
                </Link>

                {columns.map((column) => (
                  <span key={column} className="text-text-2 min-w-0 truncate py-2 text-base">
                    {/* Lifecycle keeps its pill here. In a register read one row
                        at a time it is the state you glance at rather than read,
                        and a word in the same grey as the rest is not a glance. */}
                    {column === "lifecycle" ? (
                      <LifecyclePill
                        lifecycle={item.lifecycle}
                        label={t.cmdb.life[item.lifecycle]}
                      />
                    ) : (
                      <CiCell
                        column={column}
                        item={item}
                        field={ciFieldOf(fieldsByType, item.typeId, column)}
                        lookups={lookups}
                        dateFormat={dateFormat}
                        unset={t.cmdb.unset}
                        lifeLabel={t.cmdb.life[item.lifecycle]}
                        openLabel={t.cmdb.openTickets(item.openTickets)}
                      />
                    )}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </CiTableFrame>
  );
}
