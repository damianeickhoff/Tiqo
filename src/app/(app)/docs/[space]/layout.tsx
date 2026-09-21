import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canEditDocs } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { daysUntilReview, isStale } from "@/lib/docs";
import { DocTree } from "@/components/docs/doc-tree";

/**
 * A shelf and everything on it.
 *
 * The tree is the layout rather than the page, so moving between documents
 * leaves the rail alone — it is the one thing on the screen somebody is using
 * to navigate, and redrawing it under the pointer on every click is how a
 * sidebar loses its place.
 */
export default async function SpaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ space: string }>;
}) {
  const { space: key } = await params;
  const [user, t] = await Promise.all([requireUser(), getMessages()]);

  const space = await prisma.docSpace.findUnique({
    where: { key: key.toUpperCase() },
    select: {
      id: true,
      key: true,
      name: true,
      color: true,
      team: { select: { name: true } },
      docs: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          parentId: true,
          position: true,
          archivedAt: true,
          reviewDays: true,
          reviewedAt: true,
          createdAt: true,
        },
      },
    },
  });
  if (!space) notFound();

  const canEdit = canEditDocs(user);
  // Archived pages stay reachable by their address but leave the rail: the
  // point of archiving is that nobody follows them by accident.
  const shown = space.docs.filter((doc) => !doc.archivedAt);
  const behind = shown.filter((doc) => isStale(doc)).length;

  return (
    <div className="doc-shell lg:grid lg:min-h-[calc(100vh-var(--bar))] lg:grid-cols-[264px_minmax(0,1fr)]">
      {/* `top-0` rather than the bar's height: the desk scrolls inside a pane
          that already begins under the bar, so offsetting by it again pushed
          the rail down a bar's worth on any page long enough to scroll and
          left a strip of the wrong colour above it. */}
      <aside className="doc-tree bg-bg flex flex-col gap-3 px-4 py-4 lg:sticky lg:top-0 lg:h-[calc(100vh-var(--bar))]">
        <Link
          href="/docs"
          className="text-text-3 hover:text-text -ml-1 inline-flex items-center gap-1 text-sm font-medium transition-colors"
        >
          <ChevronLeft size={13} />
          {t.docs.allSpaces}
        </Link>

        {/* The shelf, said once at the top of its own rail: which one, who
            answers for it, how much is on it and how much of that is behind. */}
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold"
            style={{
              background: `color-mix(in oklab, ${space.color} 16%, transparent)`,
              color: `color-mix(in oklab, ${space.color} 70%, var(--text))`,
            }}
          >
            {space.key.slice(0, 3)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base leading-tight font-semibold">
              {space.name}
            </span>
            <span className="text-text-3 block truncate text-xs">
              {[
                space.team?.name ?? t.docs.wholeDesk,
                t.docs.pages(shown.length),
                behind ? t.docs.staleN(behind) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </div>

        <div className="min-h-0 flex-1">
          <DocTree
            spaceId={space.id}
            spaceKey={space.key}
            canEdit={canEdit}
            docs={shown.map((doc) => ({
              id: doc.id,
              slug: doc.slug,
              title: doc.title,
              summary: doc.summary,
              parentId: doc.parentId,
              position: doc.position,
              archivedAt: doc.archivedAt,
              // Worked out here, once, where there is a clock: the rail is a
              // client component and a date read during its render is a
              // hydration mismatch waiting for midnight.
              reviewIn: daysUntilReview(doc),
            }))}
          />
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
