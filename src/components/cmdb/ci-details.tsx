import Link from "next/link";
import { readAttribute, type FieldSpec, type Lifespan } from "@/lib/cmdb";
import { cn } from "@/lib/utils";

/** What the ids inside an asset's attributes are called. Resolved once by the
 *  page and handed down, rather than a lookup per cell. */
export type CiNames = { people: Record<string, string>; items: Record<string, string> };

/**
 * One attribute, as it reads rather than as it is stored.
 *
 * The same renderer on the item page and in the register's pane, because a
 * serial number that is monospaced in one place and not in the other is two
 * different serial numbers to look at.
 */
export function CiValue({
  field,
  attributes,
  names,
  dateFormat,
  unset,
  yes,
  no,
}: {
  field: FieldSpec;
  attributes: unknown;
  names: CiNames;
  dateFormat: Intl.DateTimeFormat;
  unset: string;
  yes: string;
  no: string;
}) {
  const value = readAttribute(field, attributes);
  if (value === null) return <span className="text-text-3">{unset}</span>;

  switch (field.kind) {
    case "BOOLEAN":
      return <>{value === true ? yes : no}</>;
    case "DATE": {
      // A date that will not parse is shown as it was written rather than as
      // "Invalid Date": an import that put something odd in the column is
      // something somebody should be able to see and fix.
      const when = new Date(String(value));
      return (
        <span className="tnum font-mono text-sm">
          {Number.isNaN(when.getTime()) ? String(value) : dateFormat.format(when)}
        </span>
      );
    }
    case "NUMBER":
      return <span className="tnum font-mono text-sm">{String(value)}</span>;
    case "USER":
      return <>{names.people[String(value)] ?? <span className="text-text-3">{unset}</span>}</>;
    case "ITEM": {
      const name = names.items[String(value)];
      if (!name) return <span className="text-text-3">{unset}</span>;
      return (
        <Link href={`/cmdb/${value}`} className="hover:text-brand-deep font-medium">
          {name}
        </Link>
      );
    }
    default:
      return <>{String(value)}</>;
  }
}

/** One label and one value, the shape both the pane and the item page use. */
export function CiRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-3 py-1", className)}>
      <span className="text-text-3 truncate text-sm">{label}</span>
      <span className="min-w-0 text-base">{children}</span>
    </div>
  );
}

/**
 * How much cover is left, as a bar.
 *
 * The bar is the point: "11 Mar 2027" is a date somebody has to do arithmetic
 * on, and half a bar with a marker in the middle of it is the same fact already
 * worked out. Past the end it fills and turns, because an expired warranty is
 * not a small number, it is a different situation.
 */
export function WarrantyBar({
  span,
  dateFormat,
  remaining,
  now = new Date(),
}: {
  span: Lifespan;
  dateFormat: Intl.DateTimeFormat;
  /// "18 months left", "overdue by 20 days" — worked out by the caller, which is
  /// the half that needs the dictionary.
  remaining: string;
  now?: Date;
}) {
  const end = Date.parse(span.to.value);
  const start = span.from ? Date.parse(span.from.value) : end - YEAR;
  const done =
    Number.isNaN(end) || Number.isNaN(start) ? 0 : (now.getTime() - start) / (end - start);
  const used = Math.max(0, Math.min(1, done));
  const lapsed = done >= 1;

  return (
    <div>
      <div className="text-text-3 flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate">{span.from?.label}</span>
        <span className="truncate">{span.to.label}</span>
      </div>
      <div className="tnum mt-0.5 flex items-baseline justify-between gap-2 font-mono text-sm">
        <span className="whitespace-nowrap">
          {span.from ? dateFormat.format(new Date(span.from.value)) : null}
        </span>
        <span className="whitespace-nowrap">{dateFormat.format(new Date(span.to.value))}</span>
      </div>
      <div className="bg-surface-3 relative mt-2 h-1.5 overflow-hidden rounded-full">
        <i
          className="block h-full rounded-full"
          style={{
            width: `${used * 100}%`,
            background: lapsed ? "var(--negative)" : "var(--positive)",
          }}
        />
      </div>
      <p className={cn("mt-1.5 text-xs", lapsed ? "text-negative" : "text-text-3")}>{remaining}</p>
    </div>
  );
}

const YEAR = 365 * 24 * 60 * 60 * 1000;
