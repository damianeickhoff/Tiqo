import Link from "next/link";
import { dateLocaleOf, getMessages, getSettings } from "@/lib/settings";
import { CiGlyph } from "@/components/cmdb/ci-glyph";
import { EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

/** One date on one asset that is about to come round. */
export type ExpiringRow = {
  id: string;
  name: string;
  /// The field's own label — "Warranty until", "Expires on" — because which
  /// date it is matters as much as when it is.
  label: string;
  /// As stored: an ISO day. Parsed here rather than by the query, so the count
  /// of days left is worked out in the reader's own timezone.
  value: string;
  icon: string | null;
  color: string;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * What runs out in the next month.
 *
 * Every DATE attribute of every type, because a desk does not think in types
 * when it asks this: a warranty, a certificate and a licence all end, and the
 * one that catches somebody out is whichever was not on the screen they were
 * looking at. Nothing retired — an asset that is out of service has no dates
 * left worth chasing.
 */
export async function ExpiringSoon({ rows }: { rows: ExpiringRow[] }) {
  const [t, settings] = await Promise.all([getMessages(), getSettings()]);

  if (rows.length === 0) {
    return (
      <div className="px-5 pb-5">
        <EmptyState title={t.dashboard.expiringEmpty} body="" />
      </div>
    );
  }

  const dateFormat = new Intl.DateTimeFormat(dateLocaleOf(settings), {
    day: "numeric",
    month: "short",
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <ul className="divide-line divide-y">
      {rows.map((row) => {
        const due = new Date(`${row.value}T00:00:00`);
        const days = Math.round((due.getTime() - today.getTime()) / DAY);

        return (
          <li key={`${row.id}:${row.label}`}>
            <Link
              href={`/cmdb/${row.id}`}
              className="hover:bg-surface-2 flex items-center gap-2.5 px-4 py-2.5 transition-colors"
            >
              <CiGlyph icon={row.icon} color={row.color} size={14} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-base font-medium">{row.name}</span>
                <span className="text-text-3 block truncate text-sm">{row.label}</span>
              </span>
              <span
                className={cn(
                  "tnum shrink-0 text-right font-mono text-xs",
                  // The last week is the one somebody can still do something
                  // about; everything further out is a date, not a warning.
                  days <= 7 ? "text-negative font-semibold" : "text-text-3",
                )}
              >
                <span className="block">{dateFormat.format(due)}</span>
                <span className="block">{t.dashboard.expiringIn(days)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
