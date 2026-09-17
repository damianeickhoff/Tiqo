import Link from "next/link";
import { CircleAlert } from "lucide-react";
import type { CiLifecycle } from "@/generated/prisma/enums";
import { getMessages, getSettings, dateLocaleOf } from "@/lib/settings";
import { readAttribute, type FieldSpec } from "@/lib/cmdb";
import { attrKeyOf, columnWidth, CI_ROW, NAME_WIDTH } from "@/lib/ci-columns";
import { CiTableFrame } from "@/components/cmdb/ci-table-frame";
import { CiGlyph } from "@/components/cmdb/ci-glyph";
import { CiAllCheck, CiRowCheck } from "@/components/cmdb/ci-selection";
import { cn } from "@/lib/utils";

export type CiTableRow = {
  id: string;
  name: string;
  lifecycle: CiLifecycle;
  attributes: unknown;
  typeId: string;
  type: { name: string; color: string; icon: string | null };
  team: { name: string; color: string } | null;
  openTickets: number;
};

/**
 * Names for the ids an attribute can hold.
 *
 * A `USER` attribute stores an account id and an `ITEM` one stores an asset id;
 * neither is worth showing. Resolved once for the whole page and handed down,
 * rather than a lookup per cell — fifty rows of five columns is two queries, not
 * two hundred and fifty.
 */
export type CiLookups = { people: Record<string, string>; items: Record<string, string> };

/**
 * Every type's attributes, by the id of the type that has them.
 *
 * A column is offered across all the types at once, so the same key can be a
 * date on one of them and a line of text on another — and can be nothing at all
 * on a third. Which it is here is decided by the row, not by the heading.
 */
export type CiFieldsByType = Record<string, FieldSpec[]>;

/** The field this column means *for this row*, or nothing where the row's type
 *  has no such attribute — which is what leaves the cell empty. */
export function ciFieldOf(
  fieldsByType: CiFieldsByType,
  typeId: string,
  column: string,
): FieldSpec | undefined {
  const key = attrKeyOf(column);
  if (!key) return undefined;
  return fieldsByType[typeId]?.find((field) => field.key === key);
}

/** What a column is called at the top of it: the attribute's own label where it
 *  has one, and the shared word where it does not. */
export function ciHeading(
  column: string,
  fields: FieldSpec[],
  t: Awaited<ReturnType<typeof getMessages>>,
): string {
  const key = attrKeyOf(column);
  if (key) return fields.find((field) => field.key === key)?.label ?? key;
  if (column === "type") return t.cmdb.type;
  if (column === "lifecycle") return t.cmdb.lifecycle;
  if (column === "team") return t.cmdb.team;
  return t.cmdb.openHeading;
}

/**
 * Which headings are worth pressing.
 *
 * Name, type and lifecycle always; an attribute only where the answer means
 * something in an order — a date and a number do, a paragraph of free text and
 * a yes-or-no do not. Sorting by "which of these is ticked" is a filter dressed
 * as a sort, and the filter bar already has one.
 */
function ciSortable(column: string, fields: FieldSpec[]): boolean {
  const key = attrKeyOf(column);
  if (!key) return column === "type" || column === "lifecycle";
  const kind = fields.find((field) => field.key === key)?.kind;
  return kind === "DATE" || kind === "NUMBER";
}

/**
 * The register, in whichever columns this person keeps.
 *
 * A grid rather than a table element: the columns here are not a fixed set
 * somebody chose once, they are whatever the types record, and each of them is
 * a width the reader is allowed to change. A table's own layout algorithm has
 * opinions about that which cannot be overruled.
 *
 * The headings and the widths belong to the frame, which is the only part of
 * this that has to run in the browser.
 */
export async function CiTable({
  items,
  storeKey,
  columns,
  fields,
  fieldsByType,
  lookups,
  sort,
  dir,
  sortHref,
}: {
  items: CiTableRow[];
  storeKey: string;
  columns: string[];
  /// The columns' own specs, for the headings and for what may be sorted on.
  fields: FieldSpec[];
  fieldsByType: CiFieldsByType;
  lookups: CiLookups;
  /// Which column the list is in the order of, and which way.
  sort: string;
  dir: "asc" | "desc";
  /// Where pressing a heading goes. Built by the page, which is the only thing
  /// that knows what else is in the URL.
  sortHref: (column: string) => string;
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
      name={{ id: "name", label: t.cmdb.name, width: NAME_WIDTH, href: sortHref("name") }}
      heads={columns.map((column) => {
        const key = attrKeyOf(column);
        return {
          id: column,
          label: ciHeading(column, fields, t),
          width: columnWidth(column, key ? byKey.get(key) : undefined),
          href: ciSortable(column, fields) ? sortHref(column) : undefined,
        };
      })}
      sort={sort}
      dir={dir}
      /* The tick is drawn whether or not anything can be edited: the checkbox
         comes back null outside a register that offers selection, so the track
         simply stands empty. */
      selectAll={<CiAllCheck ids={items.map((item) => item.id)} label={t.cmdb.selectPage} />}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(CI_ROW, "border-line hover:bg-surface-2 border-b transition-colors")}
        >
          <CiRowCheck id={item.id} label={t.cmdb.selectRow(item.name)} />
          <Link
            href={`/cmdb/${item.id}`}
            className={cn(
              "flex min-w-0 items-center gap-2.5 py-2",
              // Retired is a footnote, not a warning: still legible, done
              // competing with the things still in service.
              item.lifecycle === "RETIRED" && "opacity-55",
            )}
          >
            <CiGlyph icon={item.type.icon} color={item.type.color} />
            <span className="truncate text-base font-medium">{item.name}</span>
          </Link>

          {columns.map((column) => (
            <span key={column} className="text-text-2 min-w-0 truncate py-2 text-base">
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
            </span>
          ))}
        </div>
      ))}
    </CiTableFrame>
  );
}

export function CiCell({
  column,
  item,
  field,
  lookups,
  dateFormat,
  unset,
  lifeLabel,
  openLabel,
}: {
  column: string;
  item: CiTableRow;
  field: FieldSpec | undefined;
  lookups: CiLookups;
  dateFormat: Intl.DateTimeFormat;
  unset: string;
  lifeLabel: string;
  openLabel: string;
}) {
  if (column === "type") return <>{item.type.name}</>;
  if (column === "lifecycle") return <>{lifeLabel}</>;

  if (column === "team") {
    if (!item.team) return <span className="text-text-3">{unset}</span>;
    return (
      <span
        className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
        style={{
          background: `color-mix(in oklab, ${item.team.color} 16%, transparent)`,
          color: `color-mix(in oklab, ${item.team.color} 70%, var(--text))`,
        }}
      >
        {item.team.name}
      </span>
    );
  }

  if (column === "tickets") {
    if (item.openTickets === 0) return <span className="text-text-3">{unset}</span>;
    return (
      <span
        className="text-negative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: "color-mix(in oklab, var(--negative) 12%, transparent)" }}
      >
        <CircleAlert size={11} strokeWidth={2.5} />
        {openLabel}
      </span>
    );
  }

  if (!field) return <span className="text-text-3">{unset}</span>;

  const value = readAttribute(field, item.attributes);
  if (value === null) return <span className="text-text-3">{unset}</span>;

  switch (field.kind) {
    case "BOOLEAN":
      return <>{value === true ? "✓" : "—"}</>;
    case "DATE": {
      // A date that will not parse is shown as it was written rather than as
      // "Invalid Date": an import that put something odd in the column is
      // something somebody should be able to see and fix.
      const when = new Date(String(value));
      return <>{Number.isNaN(when.getTime()) ? String(value) : dateFormat.format(when)}</>;
    }
    case "USER":
      return <>{lookups.people[String(value)] ?? <span className="text-text-3">{unset}</span>}</>;
    case "ITEM": {
      const name = lookups.items[String(value)];
      if (!name) return <span className="text-text-3">{unset}</span>;
      return (
        <Link href={`/cmdb/${value}`} className="hover:underline">
          {name}
        </Link>
      );
    }
    default:
      return <>{String(value)}</>;
  }
}
