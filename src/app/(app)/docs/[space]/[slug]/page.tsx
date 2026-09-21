import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Archive, ChevronRight, Link2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canEditDocs, canManageDocs, can } from "@/lib/permissions";
import { dateLocaleOf, getMessages, getSettings } from "@/lib/settings";
import { docReviewDefaults } from "@/lib/doc-sweep";
import {
  ancestorsOf,
  daysUntilReview,
  docHref,
  headingsIn,
  isStale,
  readDocPrefs,
  readMinutes,
  reviewDueAt,
  spaceHref,
} from "@/lib/docs";
import { Avatar } from "@/components/avatar";
import { PersonLink } from "@/components/person-link";
import { ReferenceChip } from "@/components/reference-chip";
import { AttachmentList } from "@/components/tickets/attachment-list";
import { PanelCard } from "@/components/tickets/panel-card";
import { DocArticle } from "@/components/docs/doc-editor";
import { DocCare } from "@/components/docs/doc-care";
import { DocHistory } from "@/components/docs/doc-history";
import { DocMenu } from "@/components/docs/doc-actions";
import { PublishedCard } from "@/components/docs/doc-published";
import { PinButton } from "@/components/docs/pin-button";
import { ReadingModeButton } from "@/components/docs/reading-mode";
import { ReviewChip } from "@/components/docs/review-chip";
import { TopBarBreadcrumb } from "@/components/shell/topbar-breadcrumb";

type Params = Promise<{ space: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { space, slug } = await params;
  const doc = await prisma.doc.findFirst({
    where: { slug, space: { is: { key: space.toUpperCase() } } },
    select: { title: true },
  });
  return { title: doc?.title ?? "" };
}

/**
 * One page of documentation.
 *
 * The words get the width; everything that is true *about* the page — who owns
 * it, when it was last confirmed, what points at it, what it said before —
 * goes in a rail beside them. A runbook is read under pressure, and the first
 * thing that must be readable is the runbook. Reading mode takes the rail away
 * entirely, for the times when that is still not enough.
 */
export default async function DocPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { space: spaceKey, slug } = await params;
  const query = await searchParams;
  const [user, t, settings, defaults] = await Promise.all([
    requireUser(),
    getMessages(),
    getSettings(),
    docReviewDefaults(),
  ]);

  const doc = await prisma.doc.findFirst({
    where: { slug, space: { is: { key: spaceKey.toUpperCase() } } },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      body: true,
      parentId: true,
      ownerId: true,
      reviewDays: true,
      reviewedAt: true,
      staleSnoozedTo: true,
      archivedAt: true,
      articleId: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { id: true, name: true, avatarVariant: true } },
      updatedBy: { select: { name: true, avatarVariant: true } },
      article: {
        select: {
          id: true,
          title: true,
          isPublished: true,
          updatedAt: true,
          categoryId: true,
          category: { select: { name: true } },
        },
      },
      space: {
        select: { id: true, key: true, name: true, portalCategoryId: true },
      },
      stars: { where: { userId: user.id }, select: { userId: true } },
      children: {
        where: { archivedAt: null },
        orderBy: { position: "asc" },
        select: { id: true, slug: true, title: true, summary: true },
      },
      attachments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          size: true,
          createdAt: true,
          uploadedById: true,
          uploadedBy: { select: { name: true } },
        },
      },
      revisions: {
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          note: true,
          createdAt: true,
          author: { select: { name: true, avatarVariant: true } },
        },
      },
    },
  });
  if (!doc) {
    // An address this page used to answer to. Renaming a page rewrites its
    // slug, and the link somebody left in a ticket last year has to land
    // somewhere better than a 404 — so the old address forwards to the new one
    // rather than the page pretending never to have had it.
    const renamed = await prisma.doc.findFirst({
      where: { pastSlugs: { has: slug }, space: { is: { key: spaceKey.toUpperCase() } } },
      select: { slug: true, space: { select: { key: true } } },
    });
    if (renamed) redirect(docHref(renamed.space.key, renamed.slug));
    notFound();
  }

  const canEdit = canEditDocs(user);
  const canManage = canManageDocs(user);

  const [preference, siblings, spaces, people, sections, incoming] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { docPrefs: true } }),
    prisma.doc.findMany({
      where: { spaceId: doc.space.id },
      orderBy: { position: "asc" },
      select: { id: true, slug: true, title: true, parentId: true, position: true },
    }),
    // Every shelf, so the care card can offer a move. Ordered the way the
    // documentation index orders them.
    canEdit
      ? prisma.docSpace.findMany({
          orderBy: { position: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    canEdit
      ? prisma.user.findMany({
          where: {
            isActive: true,
            role: { is: { OR: [{ isMaster: true }, { permissions: { has: "doc.edit" } }] } },
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    // Only needed to publish, and only somebody who may publish is offered it.
    canManage && can(user, "settings.tickets")
      ? prisma.portalCategory.findMany({
          where: { isActive: true },
          orderBy: { position: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    // The other half of every reference written at this page. Deduplicated on
    // the address: the same ticket naming a runbook in five comments is one
    // thing relying on it, not five.
    prisma.activity.findMany({
      where: { docId: doc.id, type: "REFERENCED" },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, field: true, oldValue: true, link: true },
    }),
  ]);

  const reading = readDocPrefs(preference?.docPrefs).reading;

  // The chain down to this page, without the page itself — it is the last
  // crumb, and it is not a link.
  const trail = ancestorsOf(siblings, doc.id).slice(0, -1);

  const referrers = [
    ...new Map(
      incoming.filter((row) => row.link && row.oldValue).map((row) => [row.link!, row]),
    ).values(),
  ];

  // How far the portal answer has fallen behind the page it came from. Counted
  // rather than shown as a date, because "one revision behind" is a size and
  // "9 September" is a fact somebody then has to compare with another one.
  const behind = doc.article
    ? await prisma.docRevision.count({
        where: { docId: doc.id, createdAt: { gt: doc.article.updatedAt } },
      })
    : 0;

  const reviewIn = daysUntilReview(doc);
  const outline = headingsIn(doc.body);
  const when = new Intl.DateTimeFormat(dateLocaleOf(settings), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const breadcrumb = (
    <nav className="text-text-3 flex min-w-0 flex-wrap items-center gap-1 text-sm">
      <Link href={spaceHref(doc.space.key)} className="hover:text-text transition-colors">
        {doc.space.name}
      </Link>
      {trail.map((step) => (
        <span key={step.id} className="flex items-center gap-1">
          <ChevronRight size={12} aria-hidden />
          <Link
            href={docHref(doc.space.key, step.slug)}
            className="hover:text-text transition-colors"
          >
            {step.title}
          </Link>
        </span>
      ))}
      <ChevronRight size={12} aria-hidden />
      <span className="text-text-2 font-medium">{doc.title}</span>
    </nav>
  );

  const rail = (
    <aside className="flex min-w-0 flex-col gap-3 px-5 py-6 lg:px-6 xl:px-3">
      {/* The page's own headings used to open this rail. They are on the page
          now, hovering in its corner: an index is the one thing here that is
          used *while* reading, and it had been sharing a column with who owns
          the page and what it said last March. */}

      {/* Hidden rather than disabled on an archived page: there is nothing
          to own, review or move about a page that is out of the tree, and
          the action refuses it anyway. */}
      {doc.archivedAt ? null : (
        <DocCare
          docId={doc.id}
          ownerId={doc.ownerId}
          owner={doc.owner}
          reviewDays={doc.reviewDays}
          reviewedAt={doc.reviewedAt}
          reviewDueAt={reviewDueAt(doc)}
          reviewIn={reviewIn}
          parentId={doc.parentId}
          parentTitle={trail.at(-1)?.title ?? null}
          spaceId={doc.space.id}
          spaces={spaces}
          people={people}
          siblings={siblings}
          canEdit={canEdit}
          isStale={isStale(doc)}
          snoozedTo={
            doc.staleSnoozedTo && doc.staleSnoozedTo > new Date() ? doc.staleSnoozedTo : null
          }
        />
      )}

      {doc.article ? (
        <PublishedCard
          docId={doc.id}
          articleId={doc.article.id}
          articleTitle={doc.article.title}
          categoryId={doc.article.categoryId}
          categoryName={doc.article.category?.name ?? null}
          publishedOn={when.format(doc.article.updatedAt)}
          isLive={doc.article.isPublished}
          behind={behind}
          canManage={canManage}
        />
      ) : null}

      <PanelCard title={t.docs.referencedBy}>
        {referrers.length === 0 ? (
          <p className="text-text-3 px-3.5 py-3 text-sm">{t.docs.noReferences}</p>
        ) : (
          <ul className="divide-line divide-y">
            {referrers.map((row) => (
              <li key={row.id} className="flex items-center gap-2 px-3.5 py-2">
                <Link2 size={12} className="text-text-3 shrink-0" />
                <ReferenceChip
                  href={row.link!}
                  label={row.oldValue!}
                  kind={
                    row.field === "project" ? "project" : row.field === "doc" ? "doc" : "ticket"
                  }
                  tone="plain"
                />
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      {/* Beside the page rather than under it: a diagram belongs to the
          runbook, and a runbook read under pressure should not end in a list
          of files somebody has to scroll past the procedure to reach. */}
      {doc.attachments.length > 0 ? (
        <PanelCard title={t.docs.files}>
          <div className="px-3.5 py-2">
            <AttachmentList
              attachments={doc.attachments}
              viewerId={user.id}
              canModerate={canEdit}
              body={doc.body}
            />
          </div>
        </PanelCard>
      ) : null}

      <DocHistory
        revisions={doc.revisions}
        canEdit={canEdit && !doc.archivedAt}
        currentAuthor={doc.updatedBy?.name ?? null}
        currentAt={doc.updatedAt}
        compareHref={`${docHref(doc.space.key, doc.slug)}/compare`}
      />
    </aside>
  );

  return (
    <>
      <TopBarBreadcrumb reference={doc.space.key} title={doc.title} />

      {doc.archivedAt ? (
        <p className="bg-surface-2 text-text-2 flex items-center gap-2 px-5 py-2.5 text-base lg:px-8">
          <Archive size={14} className="text-text-3 shrink-0" />
          {t.docs.archivedNote}
        </p>
      ) : null}

      <div className={reading ? "" : "xl:grid xl:grid-cols-[minmax(0,1fr)_288px]"}>
        {/* A page being read or written is one object, so it is one sheet on
            the work area's ground. The rail beside it stays cards. */}
        <div className="sheet m-3 min-w-0">
          <DocArticle
            docId={doc.id}
            docPath={docHref(doc.space.key, doc.slug)}
            title={doc.title}
            summary={doc.summary}
            body={doc.body}
            updatedAt={doc.updatedAt.toISOString()}
            canEdit={canEdit && !doc.archivedAt}
            openEditor={asOne(query.edit) === "1"}
            reviewByDefault={defaults.editCountsAsReview}
            breadcrumb={breadcrumb}
            reading={reading}
            outline={outline}
            actions={
              <>
                <PinButton docId={doc.id} pinned={doc.stars.length > 0} />
                <ReadingModeButton reading={reading} />
              </>
            }
            menu={
              <DocMenu
                docId={doc.id}
                title={doc.title}
                spaceHref={spaceHref(doc.space.key)}
                isArchived={Boolean(doc.archivedAt)}
                publishedAs={
                  doc.article
                    ? {
                        categoryId: doc.article.categoryId,
                        isLive: doc.article.isPublished,
                      }
                    : null
                }
                sections={sections}
                proposedCategoryId={doc.space.portalCategoryId}
                canManage={canManage}
              />
            }
            meta={
              <>
                <ReviewChip days={reviewIn} />
                {doc.owner ? (
                  <span className="text-text-2 flex items-center gap-1.5 text-sm">
                    <Avatar name={doc.owner.name} variant={doc.owner.avatarVariant} size={20} />
                    <PersonLink id={doc.owner.id} name={doc.owner.name} />
                  </span>
                ) : (
                  <span className="text-text-3 text-sm">{t.docs.unowned}</span>
                )}
                <span className="text-text-3 text-sm">
                  {doc.updatedBy
                    ? t.docs.updatedByWhen(doc.updatedBy.name, when.format(doc.updatedAt))
                    : t.docs.updatedWhen(when.format(doc.updatedAt))}
                </span>
                <span className="text-text-3 text-sm">
                  {t.docs.readTime(readMinutes(doc.body))}
                </span>
              </>
            }
            below={
              // The pages underneath this one, in the body rather than only on
              // the rail: a runbook's sub-pages are its later steps, and the end
              // of the page is where somebody is when they need the next one.
              doc.children.length > 0 ? (
                <section className="border-line mt-8 border-t pt-5">
                  <h2 className="label mb-3">{t.docs.subpages(doc.children.length)}</h2>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {doc.children.map((child) => (
                      <li key={child.id} className="min-w-0">
                        <Link
                          href={docHref(doc.space.key, child.slug)}
                          className="card card-interactive block px-3.5 py-2.5"
                        >
                          <span className="block truncate text-base font-medium">
                            {child.title}
                          </span>
                          {child.summary ? (
                            <span className="text-text-3 mt-0.5 block truncate text-sm">
                              {child.summary}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null
            }
          />
        </div>

        {reading ? null : rail}
      </div>
    </>
  );
}

/** One value out of a search parameter that could have arrived twice. */
function asOne(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
