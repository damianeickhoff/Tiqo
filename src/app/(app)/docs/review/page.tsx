import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageDocs } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { daysUntilReview, docHref, isStale } from "@/lib/docs";
import { PageHeader } from "@/components/shell/page-header";
import { ReviewChip } from "@/components/docs/review-chip";
import { StillCorrectButton } from "@/components/docs/doc-actions";
import { Avatar } from "@/components/avatar";
import { Card, EmptyState } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.docs.reviewQueue };
}

/**
 * Every page on the desk that is past its date, by owner.
 *
 * The home page answers "what of mine has gone stale"; this answers the other
 * question, which belongs to whoever runs the reviews: where is the writing
 * drifting, and who has stopped answering for theirs. Grouped by owner rather
 * than by shelf because the conversation that follows is with a person.
 *
 * Behind `doc.manage`, since it is a list of other people's lapses.
 */
export default async function ReviewQueuePage() {
  const user = await requireUser();
  if (!canManageDocs(user)) notFound();

  const t = await getMessages();

  const pages = await prisma.doc.findMany({
    where: { archivedAt: null, reviewDays: { gt: 0 } },
    // Longest unconfirmed first, which is the same order as worst first.
    orderBy: { reviewedAt: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      reviewDays: true,
      reviewedAt: true,
      createdAt: true,
      owner: { select: { id: true, name: true, avatarVariant: true } },
      space: { select: { key: true, name: true, color: true } },
    },
  });

  // The arithmetic no `where` clause can do, then one group per owner in the
  // order the worst page in each puts them.
  const stale = pages.filter((page) => isStale(page));
  const groups = new Map<
    string,
    { name: string; owner: (typeof stale)[number]["owner"]; pages: typeof stale }
  >();
  for (const page of stale) {
    const key = page.owner?.id ?? "";
    const group = groups.get(key);
    if (group) group.pages.push(page);
    else
      groups.set(key, {
        name: page.owner?.name ?? t.docs.noOwner,
        owner: page.owner,
        pages: [page],
      });
  }

  return (
    <>
      <PageHeader
        title={t.docs.reviewQueue}
        actions={
          <Link
            href="/docs"
            className="text-text-3 hover:text-text inline-flex items-center gap-1 text-sm font-medium transition-colors"
          >
            <ChevronLeft size={13} />
            {t.docs.title}
          </Link>
        }
        showBlurb
      >
        {t.docs.reviewQueueBlurb}
      </PageHeader>

      <div className="space-y-4 px-5 py-5 lg:px-6">
        {stale.length === 0 ? (
          <EmptyState title={t.docs.nothingStaleDesk} body={t.docs.nothingStaleDeskBody} />
        ) : (
          [...groups.values()].map((group) => (
            <Card key={group.owner?.id ?? "none"} className="overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-2.5">
                {group.owner ? (
                  <Avatar
                    name={group.owner.name}
                    variant={group.owner.avatarVariant}
                    size={22}
                    className="shrink-0"
                  />
                ) : null}
                <span className="text-base font-semibold">{group.name}</span>
                <span className="text-text-3 ml-auto text-sm">
                  {t.docs.staleCount(group.pages.length)}
                </span>
              </div>

              <ul className="divide-line divide-y">
                {group.pages.map((page) => (
                  <li key={page.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: page.space.color }}
                    />
                    <Link
                      href={docHref(page.space.key, page.slug)}
                      className="hover:text-brand-deep min-w-0 flex-1 truncate text-base font-medium transition-colors"
                    >
                      {page.title}
                    </Link>
                    <span className="text-text-3 hidden shrink-0 text-sm sm:block">
                      {page.space.name}
                    </span>
                    <ReviewChip days={daysUntilReview(page)} size="sm" />
                    <StillCorrectButton docId={page.id} />
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
