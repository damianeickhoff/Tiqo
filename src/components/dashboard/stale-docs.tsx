import Link from "next/link";
import { BookText } from "lucide-react";
import { getMessages } from "@/lib/settings";
import { daysUntilReview, docHref } from "@/lib/docs";

export type StaleDoc = {
  id: string;
  slug: string;
  title: string;
  reviewDays: number;
  reviewedAt: Date | null;
  createdAt: Date;
  space: { key: string; color: string };
};

/**
 * What this person owns that has gone past its review date.
 *
 * Owning a runbook is a promise to keep it true, and a promise nobody is
 * reminded of is a promise nobody keeps. Overdue longest first, because that is
 * the one most likely to be wrong — not the one most recently written.
 */
export async function StaleDocs({ docs }: { docs: StaleDoc[] }) {
  const t = await getMessages();

  // One line, not the full dashed panel. The big empty state is a page's answer
  // to having nothing in it; inside a dashboard widget four rows high it is a
  // void with a sentence floating in the middle.
  if (docs.length === 0) {
    return <p className="text-text-3 px-4 py-3 text-base">{t.dashboard.docReviewEmpty}</p>;
  }

  return (
    <ul className="divide-line divide-y">
      {docs.map((doc) => {
        const overdue = -(daysUntilReview(doc) ?? 0);

        return (
          <li key={doc.id}>
            <Link
              href={docHref(doc.space.key, doc.slug)}
              className="hover:bg-surface-2 flex items-start gap-2.5 px-4 py-2.5 transition-colors"
            >
              <BookText size={14} className="text-text-3 mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span
                    className="shrink-0 font-mono text-xs"
                    style={{ color: `color-mix(in oklab, ${doc.space.color} 70%, var(--text))` }}
                  >
                    {doc.space.key}
                  </span>
                  <span className="min-w-0 truncate text-base font-medium">{doc.title}</span>
                </span>
                <span className="text-text-2 mt-0.5 block truncate text-sm">
                  {t.docs.overdueBy(Math.max(1, overdue))}
                </span>
              </span>
              <span className="text-negative mt-0.5 shrink-0 text-xs font-semibold">
                {t.docs.stale}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
