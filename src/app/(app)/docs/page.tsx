import type { Metadata } from "next";
import Link from "next/link";
import { BookText, ChevronRight, Pencil, Plus, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canEditDocs, canManageDocs } from "@/lib/permissions";
import { dateLocaleOf, getMessages, getSettings } from "@/lib/settings";
import { daysUntilReview, docHref, isStale, spaceHref } from "@/lib/docs";
import { PageHeader } from "@/components/shell/page-header";
import { ReviewChip, StaleDot } from "@/components/docs/review-chip";
import { DocSearch } from "@/components/docs/doc-search";
import { NewPageButton } from "@/components/docs/new-page-button";
import { PinButton } from "@/components/docs/pin-button";
import { StillCorrectButton } from "@/components/docs/doc-actions";
import { Avatar } from "@/components/avatar";
import { Card, CardHeader, EmptyState, buttonClass } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.docs.title };
}

/**
 * The front of the documentation.
 *
 * Search first, because that is what people arrive with: somebody standing
 * here is nearly always after one page they half remember, and the shelves are
 * for the other times. Then the three questions in the order they are had —
 * what do I keep coming back to, what is there, and what has gone stale.
 */
export default async function DocsPage() {
  const user = await requireUser();
  const [t, settings] = await Promise.all([getMessages(), getSettings()]);
  const manage = canManageDocs(user);
  const edit = canEditDocs(user);

  const [spaces, everything, recent, pinned] = await Promise.all([
    prisma.docSpace.findMany({
      orderBy: { position: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        color: true,
        team: { select: { name: true } },
      },
    }),
    // Every live page, once. Staleness is `reviewedAt` plus a per-page interval
    // and no `where` clause can do that arithmetic, so the counts on the shelf
    // cards, the desk-wide total and the owner's own list are all worked out
    // here from one pass rather than from a query per shelf.
    prisma.doc.findMany({
      where: { archivedAt: null },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        spaceId: true,
        ownerId: true,
        reviewDays: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
        space: { select: { key: true } },
      },
    }),
    prisma.doc.findMany({
      where: { archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        updatedAt: true,
        reviewDays: true,
        reviewedAt: true,
        createdAt: true,
        updatedBy: { select: { name: true, avatarVariant: true } },
        space: { select: { key: true, color: true } },
      },
    }),
    prisma.docStar.findMany({
      where: { userId: user.id, doc: { is: { archivedAt: null } } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        doc: {
          select: { id: true, slug: true, title: true, space: { select: { key: true } } },
        },
      },
    }),
  ]);

  const stale = everything.filter((doc) => isStale(doc));
  const mine = stale.filter((doc) => doc.ownerId === user.id);
  const owners = new Set(stale.map((doc) => doc.ownerId).filter(Boolean));
  const when = new Intl.DateTimeFormat(dateLocaleOf(settings), { day: "numeric", month: "short" });

  return (
    <>
      <PageHeader
        title={t.docs.title}
        actions={
          <>
            {manage ? (
              <Link href="/settings/docs" className={buttonClass("outline", "sm")}>
                <Plus size={13} />
                {t.docs.newSpace}
              </Link>
            ) : null}
            {edit ? <NewPageButton spaces={spaces} /> : null}
          </>
        }
        showBlurb
      >
        <span className="tnum">
          {[
            t.docs.spaceCount(spaces.length),
            t.docs.pages(everything.length),
            t.docs.staleCount(stale.length),
          ].join(" · ")}
        </span>
      </PageHeader>

      <div className="px-5 py-5 lg:px-6">
        <DocSearch>
          {spaces.length === 0 ? (
            <EmptyState
              title={t.docs.noSpacesTitle}
              // Somebody who can make one is told how; somebody who cannot is
              // told that nobody has, rather than being sent to a page they
              // would be refused at.
              body={manage ? t.docs.noSpacesBody : t.docs.noSpacesReader}
              action={
                manage ? (
                  <Link href="/settings/docs" className={buttonClass("primary", "sm")}>
                    {t.docs.addSpace}
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <>
              {pinned.length > 0 ? (
                <section>
                  <h2 className="label mb-2 flex items-center gap-2">
                    {t.docs.pinnedByYou}
                    <span className="text-text-3 text-sm font-normal tracking-normal normal-case">
                      {t.docs.pinnedBlurb}
                    </span>
                  </h2>
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {pinned.map(({ doc }) => (
                      <li key={doc.id} className="min-w-0">
                        {/* The card is the link and the pin is a button on
                            top of it: unpinning a page from the list that
                            names it should not mean opening it first. */}
                        <Card
                          interactive
                          className="relative flex items-center gap-2.5 px-3.5 py-2.5 whitespace-nowrap"
                        >
                          <BookText size={14} className="text-brand-deep shrink-0" />
                          <Link
                            href={docHref(doc.space.key, doc.slug)}
                            className="min-w-0 flex-1 truncate text-base font-medium after:absolute after:inset-0"
                          >
                            {doc.title}
                          </Link>
                          <span className="text-text-3 shrink-0 font-mono text-xs">
                            {doc.space.key}
                          </span>
                          <span className="relative z-10 flex">
                            <PinButton docId={doc.id} pinned variant="mark" />
                          </span>
                        </Card>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section>
                <h2 className="label mb-2">{t.docs.spaces}</h2>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {spaces.map((space) => {
                    const pages = everything.filter((doc) => doc.spaceId === space.id);
                    const behind = pages.filter((doc) => isStale(doc)).length;
                    const touched = pages[0]?.updatedAt;

                    return (
                      <li key={space.id} className="min-w-0">
                        <Link href={spaceHref(space.key)} className="block h-full">
                          <Card interactive className="flex h-full flex-col gap-2.5 px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <span
                                aria-hidden
                                className="flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold"
                                style={{
                                  background: `color-mix(in oklab, ${space.color} 16%, transparent)`,
                                  color: `color-mix(in oklab, ${space.color} 70%, var(--text))`,
                                }}
                              >
                                {space.key.slice(0, 3)}
                              </span>
                              {/* The whole width of the card. The shelf's
                                  state used to sit on this line and squeezed
                                  it hard enough that four cards across read
                                  "The whole desk · 3 pa…" — so it has moved
                                  down to the foot, where the other thing that
                                  is true of the shelf rather than of its name
                                  already lives. */}
                              <span className="min-w-0 flex-1">
                                {/* Wrapped rather than cut: a shelf is known
                                    by its name, and "How the de…" is not one. */}
                                <span className="text-md line-clamp-2 block leading-tight font-semibold">
                                  {space.name}
                                </span>
                                <span className="text-text-3 block truncate text-sm">
                                  {space.team?.name ?? t.docs.wholeDesk} ·{" "}
                                  {t.docs.pages(pages.length)}
                                </span>
                              </span>
                            </div>

                            {space.description ? (
                              <p className="text-text-2 line-clamp-2 flex-1 text-base leading-relaxed">
                                {space.description}
                              </p>
                            ) : (
                              <span className="flex-1" />
                            )}

                            <p className="text-text-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                              <span className="min-w-0 truncate">
                                {touched
                                  ? t.docs.updatedWhen(when.format(touched))
                                  : t.docs.emptyBody}
                              </span>
                              {behind > 0 ? (
                                <span className="text-negative ml-auto shrink-0 rounded-full bg-[color-mix(in_oklab,var(--negative)_12%,transparent)] px-2 py-0.5 text-xs font-medium">
                                  {t.docs.staleN(behind)}
                                </span>
                              ) : (
                                <span className="text-positive ml-auto shrink-0 text-xs font-medium">
                                  {t.docs.allCurrent}
                                </span>
                              )}
                            </p>
                          </Card>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,25rem)]">
                <Card className="flex flex-col overflow-hidden">
                  <CardHeader title={t.docs.recentlyUpdated} />
                  {recent.length === 0 ? (
                    <p className="text-text-3 px-4 pb-4 text-base">{t.docs.nothingRecent}</p>
                  ) : (
                    <ul className="divide-line divide-y">
                      {recent.map((doc) => (
                        <li key={doc.id}>
                          <Link
                            href={docHref(doc.space.key, doc.slug)}
                            className="hover:bg-surface-2 flex items-start gap-2.5 px-4 py-2.5 transition-colors"
                          >
                            <span
                              aria-hidden
                              className="mt-1.5 size-2 shrink-0 rounded-full"
                              style={{ background: doc.space.color }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex min-w-0 items-baseline gap-2">
                                <span className="min-w-0 truncate text-base font-medium">
                                  {doc.title}
                                </span>
                                <StaleDot days={daysUntilReview(doc)} />
                              </span>
                              {doc.summary ? (
                                <span className="text-text-2 mt-0.5 block truncate text-sm">
                                  {doc.summary}
                                </span>
                              ) : null}
                            </span>

                            {doc.updatedBy ? (
                              <Avatar
                                name={doc.updatedBy.name}
                                variant={doc.updatedBy.avatarVariant}
                                size={20}
                                className="mt-0.5 shrink-0"
                              />
                            ) : null}
                            <span className="text-text-3 tnum mt-1 shrink-0 text-xs">
                              {when.format(doc.updatedAt)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card className="flex flex-col overflow-hidden">
                  <CardHeader
                    title={t.docs.needsReview}
                    hint={mine.length ? t.docs.yoursCount(mine.length) : undefined}
                  />
                  {mine.length === 0 ? (
                    <p className="text-text-3 px-4 pb-4 text-base">{t.docs.nothingStale}</p>
                  ) : (
                    <ul className="divide-line divide-y">
                      {mine.slice(0, 5).map((doc) => (
                        <li key={doc.id} className="flex items-center gap-2 px-4 py-2.5">
                          <span className="min-w-0 flex-1">
                            <Link
                              href={docHref(doc.space.key, doc.slug)}
                              className="hover:text-brand-deep block truncate text-base font-medium transition-colors"
                            >
                              {doc.title}
                            </Link>
                            <ReviewChip
                              days={daysUntilReview(doc)}
                              size="sm"
                              className="mt-0.5 -ml-2 bg-transparent px-2"
                            />
                          </span>
                          {/* Confirming has to be cheaper than ignoring, and
                              that means it has to be possible from the list
                              that names it rather than only on the page. */}
                          <StillCorrectButton docId={doc.id} />
                          <Link
                            href={`${docHref(doc.space.key, doc.slug)}?edit=1`}
                            title={t.docs.edit}
                            aria-label={t.docs.edit}
                            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-8 shrink-0 items-center justify-center transition-colors"
                          >
                            <Pencil size={13} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* The desk's total under your own, because the person who
                      runs the reviews is rarely the person who owns the page. */}
                  <div className="border-line text-text-2 mt-auto flex flex-wrap items-center gap-2 border-t px-4 py-2.5 text-base">
                    <Users size={14} className="text-text-3 shrink-0" />
                    {t.docs.acrossTheDesk(stale.length, owners.size)}
                    {manage ? (
                      <Link
                        href="/docs/review"
                        className="text-brand-deep ml-auto inline-flex items-center gap-1 text-sm font-medium hover:underline"
                      >
                        {t.docs.reviewQueue}
                        <ChevronRight size={12} />
                      </Link>
                    ) : null}
                  </div>
                </Card>
              </div>
            </>
          )}
        </DocSearch>
      </div>
    </>
  );
}
