import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Settings } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canEditDocs, canManageDocs } from "@/lib/permissions";
import { dateLocaleOf, getMessages, getSettings } from "@/lib/settings";
import {
  ancestorsOf,
  daysUntilReview,
  docHref,
  excerptOf,
  isStale,
  readDocPrefs,
  reviewDueAt,
} from "@/lib/docs";
import { ReviewChip } from "@/components/docs/review-chip";
import { ShelfBar, type ShelfShow, type ShelfSort } from "@/components/docs/shelf-bar";
import { PinButton } from "@/components/docs/pin-button";
import { AddPage } from "@/components/docs/doc-tree";
import { Avatar } from "@/components/avatar";
import { Card, EmptyState, buttonClass } from "@/components/ui";

type Params = Promise<{ space: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { space } = await params;
  const found = await prisma.docSpace.findUnique({
    where: { key: space.toUpperCase() },
    select: { name: true },
  });
  return { title: found?.name ?? "" };
}

/**
 * The shelf itself: what is on it, and what state the writing is in.
 *
 * The tree in the rail is for getting somewhere; this is the version somebody
 * reads. Every page on the shelf, not only the top-level ones — a runbook's
 * sub-pages are the steps of the runbook and they go stale on their own — with
 * the four questions a shelf is actually asked as chips over the top.
 */
export default async function SpacePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { space: key } = await params;
  const query = await searchParams;
  const show = (asOne(query.show) ?? "all") as ShelfShow;
  const sort = (asOne(query.sort) ?? "updated") as ShelfSort;
  const ownerId = asOne(query.owner) ?? "";

  const [user, t, settings] = await Promise.all([requireUser(), getMessages(), getSettings()]);

  const [space, preference] = await Promise.all([
    prisma.docSpace.findUnique({
      where: { key: key.toUpperCase() },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
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
            updatedAt: true,
            archivedAt: true,
            reviewDays: true,
            reviewedAt: true,
            createdAt: true,
            ownerId: true,
            owner: { select: { id: true, name: true, avatarVariant: true } },
            stars: { where: { userId: user.id }, select: { userId: true } },
          },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { docPrefs: true } }),
  ]);
  if (!space) notFound();

  const view = readDocPrefs(preference?.docPrefs).shelf;
  const live = space.docs.filter((doc) => !doc.archivedAt);

  const counts = {
    all: live.length,
    stale: live.filter((doc) => isStale(doc)).length,
    mine: live.filter((doc) => doc.ownerId === user.id).length,
    archived: space.docs.length - live.length,
  };

  const owners = [
    ...new Map(
      space.docs.filter((doc) => doc.owner).map((doc) => [doc.owner!.id, doc.owner!]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const shown = (show === "archived" ? space.docs.filter((doc) => doc.archivedAt) : live)
    .filter((doc) => (show === "stale" ? isStale(doc) : true))
    .filter((doc) => (show === "mine" ? doc.ownerId === user.id : true))
    .filter((doc) => (ownerId ? doc.ownerId === ownerId : true))
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "review") {
        // Soonest due first, and pages that never go stale last — they have no
        // date, so putting them among the dated ones invents one.
        const left = reviewDueAt(a)?.getTime() ?? Infinity;
        const right = reviewDueAt(b)?.getTime() ?? Infinity;
        return left - right;
      }
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

  // The first line of a page that never got a summary, fetched only for the
  // handful of cards that need one.
  const unsummarised = shown.filter((doc) => !doc.summary).map((doc) => doc.id);
  const excerpts = new Map(
    unsummarised.length
      ? (
          await prisma.doc.findMany({
            where: { id: { in: unsummarised } },
            select: { id: true, body: true },
          })
        ).map((doc) => [doc.id, excerptOf(doc.body)])
      : [],
  );
  const when = new Intl.DateTimeFormat(dateLocaleOf(settings), { day: "numeric", month: "short" });

  // Where each page sits. The shelf lists the whole tree flat — deliberately,
  // because a runbook's sub-pages go stale on their own and belong in these
  // lists — but a card that says only "Restarting the concentrator" reads as a
  // page of its own, and the rail beside it is meanwhile showing it two levels
  // down. So each one carries the chain above it.
  const under = new Map(
    space.docs
      .filter((doc) => doc.parentId)
      .map((doc) => [
        doc.id,
        ancestorsOf(space.docs, doc.id)
          .slice(0, -1)
          .map((step) => step.title)
          .join(" › "),
      ]),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 px-5 pt-5 lg:px-8">
        <span
          aria-hidden
          className="rounded-panel flex size-11 shrink-0 items-center justify-center font-mono text-xs font-semibold"
          style={{
            background: `color-mix(in oklab, ${space.color} 16%, transparent)`,
            color: `color-mix(in oklab, ${space.color} 70%, var(--text))`,
          }}
        >
          {space.key.slice(0, 3)}
        </span>
        <div className="min-w-0">
          <h1 className="text-lg leading-tight font-semibold tracking-[-0.01em]">{space.name}</h1>
          <p className="text-text-2 mt-0.5 text-base">
            {space.description}
            <span className="text-text-3">
              {space.description ? " · " : ""}
              {space.team?.name ?? t.docs.wholeDesk} · {t.docs.pages(counts.all)}
            </span>
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {canManageDocs(user) ? (
            <Link href="/settings/docs" className={buttonClass("outline", "sm")}>
              <Settings size={13} />
              {t.docs.spaceSettings}
            </Link>
          ) : null}
          {canEditDocs(user) ? (
            <div className="w-40">
              <AddPage spaceId={space.id} parentId={null} full />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <ShelfBar counts={counts} owners={owners} view={view} />
      </div>

      <div className="px-5 py-5 lg:px-8">
        {shown.length === 0 ? (
          counts.all === 0 ? (
            <EmptyState
              title={t.docs.emptyTitle}
              body={t.docs.emptyBody}
              action={
                canEditDocs(user) ? (
                  <div className="w-full max-w-xs">
                    <AddPage spaceId={space.id} parentId={null} full />
                  </div>
                ) : undefined
              }
            />
          ) : (
            <p className="border-line text-text-3 rounded-card border border-dashed px-4 py-10 text-center text-base">
              {t.docs.noneMatchHere}
            </p>
          )
        ) : view === "cards" ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((doc) => (
              <li key={doc.id} className="min-w-0">
                {/* The whole card opens the page. The title is still the only
                    link — it simply reaches over the card it is on — so the
                    pin beside it stays a button rather than becoming a control
                    buried inside a link. */}
                <Card interactive className="relative flex h-full flex-col gap-2 px-4 py-3.5">
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      {under.has(doc.id) ? (
                        <span className="text-text-3 block truncate text-xs">
                          {under.get(doc.id)}
                        </span>
                      ) : null}
                      <Link
                        href={docHref(space.key, doc.slug)}
                        className="text-md hover:text-brand-deep block font-semibold transition-colors after:absolute after:inset-0"
                      >
                        {doc.title}
                      </Link>
                    </span>
                    <span className="relative z-10 flex">
                      <PinButton docId={doc.id} pinned={doc.stars.length > 0} variant="mark" />
                    </span>
                  </div>

                  <p className="text-text-2 line-clamp-2 flex-1 text-base leading-relaxed">
                    {doc.summary ?? excerpts.get(doc.id)}
                  </p>

                  <div className="text-text-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    {doc.owner ? (
                      <>
                        <Avatar
                          name={doc.owner.name}
                          variant={doc.owner.avatarVariant}
                          size={18}
                          className="shrink-0"
                        />
                        <span className="truncate">{doc.owner.name.split(" ")[0]}</span>
                        <span aria-hidden>·</span>
                      </>
                    ) : null}
                    <span>{when.format(doc.updatedAt)}</span>
                    <ReviewChip days={daysUntilReview(doc)} size="sm" className="ml-auto" />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="card divide-line divide-y overflow-hidden">
            {shown.map((doc) => (
              <li
                key={doc.id}
                className="hover:bg-surface-2 relative flex items-center gap-2.5 px-4 py-2.5 transition-colors"
              >
                <span className="relative z-10 flex">
                  <PinButton docId={doc.id} pinned={doc.stars.length > 0} variant="mark" />
                </span>
                <span className="min-w-0 flex-1">
                  <Link
                    href={docHref(space.key, doc.slug)}
                    className="hover:text-brand-deep block truncate text-base font-medium transition-colors after:absolute after:inset-0"
                  >
                    {under.has(doc.id) ? (
                      <span className="text-text-3 font-normal">{under.get(doc.id)} › </span>
                    ) : null}
                    {doc.title}
                  </Link>
                  <span className="text-text-3 block truncate text-sm">
                    {doc.summary ?? excerpts.get(doc.id)}
                  </span>
                </span>
                {doc.owner ? (
                  <Avatar
                    name={doc.owner.name}
                    variant={doc.owner.avatarVariant}
                    size={20}
                    className="shrink-0"
                  />
                ) : null}
                <span className="text-text-3 tnum hidden shrink-0 text-xs sm:block">
                  {when.format(doc.updatedAt)}
                </span>
                <ReviewChip days={daysUntilReview(doc)} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/** One value out of a search parameter that could have arrived twice. */
function asOne(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
