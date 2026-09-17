import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { dateLocaleOf, getClock, getMessages, getSettings } from "@/lib/settings";
import { describeHours } from "@/lib/clock";
import { excerptOf } from "@/lib/docs";
import { StatusRing } from "@/components/tickets/glyphs";
import { Reference } from "@/components/tickets/ticket-row";
import { liveAnnouncements, longestWait, typicalReplyMinutes } from "@/lib/portal";
import { heatOf, shortAge, shortSpan } from "@/lib/tickets";
import { PortalHero, type HeroCards } from "@/components/portal/portal-hero";
import { PortalShelf, type ShelfItem } from "@/components/portal/portal-shelf";
import { PortalDeskCard } from "@/components/portal/portal-desk-card";
import {
  Announcement,
  AnswerRow,
  BandHeader,
  ServiceCard,
  Tile,
} from "@/components/portal/portal-pieces";
import { ApprovalNudge, WaitingBanner } from "@/components/portal/waiting-banner";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getSettings()).portalTitle };
}

/** The shelf on the front page: five sections and "Browse everything". */
const SHELF_PLACES = 5;

/**
 * The front page is a list of bands, in the order an admin put them, rather
 * than a fixed layout. A desk that leads with an outage notice, a desk that
 * leads with its catalogue and a desk that leads with search are all normal —
 * and none of them should need a developer.
 *
 * The bands render into the round-12 layout: the hero and the shelf across the
 * top, then a 2:1 grid. A band that takes the whole row in the page builder
 * takes both columns here; the person's own requests and the desk card sit in
 * the right column; everything else runs down the left.
 */
export default async function PortalHome() {
  const user = await requireUser();
  const [settings, clock, blocks, t] = await Promise.all([
    getSettings(),
    getClock(),
    prisma.portalBlock.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
      select: {
        id: true,
        kind: true,
        title: true,
        subtitle: true,
        limit: true,
        categoryId: true,
        span: true,
      },
    }),
    getMessages(),
  ]);

  // Marking a status "show on the portal" is a promise that those requests
  // turn up here. A laid-out front page that has no band for them would break
  // it silently, so one is added at the end rather than the setting doing
  // nothing — an admin who wants it somewhere else adds it in the page builder
  // and this stops.
  const flagged = await prisma.status.count({ where: { showOnPortal: true } });
  const laidOut =
    flagged > 0 && blocks.length > 0 && !blocks.some((block) => block.kind === "MY_REQUESTS")
      ? [
          ...blocks,
          {
            id: "requests",
            kind: "MY_REQUESTS" as const,
            title: null,
            subtitle: null,
            limit: 3,
            categoryId: null,
            span: 3,
          },
        ]
      : blocks;

  // A portal nobody has laid out yet still has to work: these are the bands a
  // service portal has when nobody has expressed an opinion.
  const bands =
    laidOut.length > 0
      ? laidOut
      : ([
          { id: "d1", kind: "HERO", limit: null, categoryId: null, span: 6 },
          { id: "d2", kind: "ANNOUNCEMENTS", limit: null, categoryId: null, span: 6 },
          { id: "d3", kind: "CATEGORIES", limit: 8, categoryId: null, span: 6 },
          { id: "d4", kind: "FEATURED_FORMS", limit: 6, categoryId: null, span: 6 },
          { id: "d5", kind: "ARTICLES", limit: 4, categoryId: null, span: 3 },
          { id: "d6", kind: "MY_REQUESTS", limit: 3, categoryId: null, span: 3 },
        ].map((band) => ({ ...band, title: null, subtitle: null })) as typeof blocks);

  // The catalogue band directly under the hero is the shelf; anywhere else it
  // is the list it always was.
  const heroAt = bands.findIndex((band) => band.kind === "HERO");
  const shelfAt =
    heroAt >= 0 && bands[heroAt + 1]?.kind === "CATEGORIES" && !bands[heroAt + 1]?.categoryId
      ? heroAt + 1
      : -1;

  // The one thing on the front page addressed to this person by name: the desk
  // has asked them something and is waiting. It goes at the top of the grid,
  // so it is met before the catalogue rather than under it.
  const waiting = await longestWait(user.id);

  // The other thing that is stopped on them. The shell puts this over the bar
  // on every other page; here it belongs under the search with its sibling.
  const approval = await prisma.approval.findFirst({
    where: { approverId: user.id, state: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, ticket: { select: { reference: true, title: true } } },
  });

  /* ------------------------------------------------------------ the top */

  let top: ReactNode = null;

  if (heroAt >= 0) {
    // Four quick starts under the search: the sections that lead the shelf.
    const leading = await leadingSections();
    const hours = describeHours(clock.hours);
    const reply = await typicalReplyMinutes();
    const line = [
      hours.open === null ? null : `${hours.days} ${hours.range}`,
      reply === null
        ? null
        : `${t.portal.typicalReply.toLowerCase()} ${shortSpan(reply * 60_000, t)}`,
    ]
      .filter(Boolean)
      .join(" · ");

    const [cards, totals] = await Promise.all([heroCards(user.id, clock), shelfTotals()]);

    top = (
      <>
        <PortalHero
          firstName={user.name.split(" ")[0]!}
          welcome={settings.portalWelcome}
          starts={leading.slice(0, 4)}
          desk={{ open: hours.open, line }}
          cards={cards}
        />
        {shelfAt >= 0 ? (
          <PortalShelf items={leading} totalItems={totals.items} totalSections={totals.sections} />
        ) : null}
      </>
    );
  }

  /* ----------------------------------------------------------- the grid */

  // What is theirs goes in the right column whatever position it was given —
  // "Your requests" beside the page is what the band means. Everything else
  // keeps the order the admin put it in, and a band given the whole row in the
  // page builder takes both columns.
  const column: { node: ReactNode; full: boolean }[] = [];
  const mine: ReactNode[] = [];

  for (const [index, band] of bands.entries()) {
    if (band.kind === "HERO" || index === shelfAt) continue;
    const node = await renderBand(band, { user, flagged, locale: dateLocaleOf(settings), t });
    if (!node) continue;
    if (band.kind === "MY_REQUESTS") mine.push(node);
    else column.push({ node, full: band.span >= 6 });
  }

  // A full-width band interrupts the two-column stretch rather than jumping to
  // the end of the page: the stream is cut into runs at each of them, and the
  // right column rides alongside the first narrow run. There is always at least
  // one, empty or not, because the desk card has to land somewhere.
  const runs: { full: boolean; items: ReactNode[] }[] = [];
  for (const item of column) {
    const last = runs.at(-1);
    if (item.full || !last || last.full) runs.push({ full: item.full, items: [item.node] });
    else last.items.push(item.node);
  }
  if (!runs.some((run) => !run.full)) runs.unshift({ full: false, items: [] });
  const asideAt = runs.findIndex((run) => !run.full);

  return (
    <>
      {top}
      <div className="portal-wrap flex flex-col gap-12 pt-12 pb-16">
        {approval ? (
          <ApprovalNudge
            reference={approval.ticket.reference}
            title={approval.ticket.title}
            since={approval.createdAt}
          />
        ) : null}

        {waiting ? (
          <WaitingBanner
            href={`/portal/requests/${waiting.number}`}
            who={waiting.assignee.name}
            reference={waiting.reference}
            title={waiting.title}
            since={waiting.since}
          />
        ) : null}

        {runs.map((run, index) =>
          index === asideAt ? (
            <div
              key={index}
              className="grid grid-cols-1 gap-x-11 gap-y-12 lg:grid-cols-[minmax(0,1fr)_400px]"
            >
              <div className="flex min-w-0 flex-col gap-12">
                {run.items.map((node, at) => (
                  <div key={at} className="min-w-0">
                    {node}
                  </div>
                ))}
              </div>

              {/* Below lg the two columns become one and this simply comes
                  last: a requester on a phone wants the catalogue first and
                  the opening hours after it. */}
              <aside className="flex flex-col gap-[22px]">
                {mine.map((node, at) => (
                  <div key={at}>{node}</div>
                ))}
                <PortalDeskCard />
              </aside>
            </div>
          ) : (
            <div key={index} className="flex min-w-0 flex-col gap-12">
              {run.items.map((node, at) => (
                <div key={at} className="min-w-0">
                  {node}
                </div>
              ))}
            </div>
          ),
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ data */

/**
 * The sections that lead the front page, in the order an admin put them on
 * the shelf. A catalogue where nobody has chosen yet leads with the first
 * five by position, so a fresh instance has a shelf on day one.
 */
async function leadingSections(): Promise<ShelfItem[]> {
  const select = {
    slug: true,
    name: true,
    icon: true,
    color: true,
    _count: {
      select: { forms: { where: { isActive: true } }, articles: { where: { isPublished: true } } },
    },
    children: {
      where: { isActive: true },
      select: {
        _count: {
          select: {
            forms: { where: { isActive: true } },
            articles: { where: { isPublished: true } },
          },
        },
      },
    },
  } as const;

  let rows = await prisma.portalCategory.findMany({
    where: { isActive: true, parentId: null, leadsPortal: { not: null } },
    orderBy: { leadsPortal: "asc" },
    take: SHELF_PLACES,
    select,
  });
  if (rows.length === 0) {
    rows = await prisma.portalCategory.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { position: "asc" },
      take: SHELF_PLACES,
      select,
    });
  }

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    color: row.color,
    count:
      row._count.forms +
      row._count.articles +
      row.children.reduce((sum, child) => sum + child._count.forms + child._count.articles, 0),
  }));
}

/** What "Browse everything" leads to, counted. */
async function shelfTotals() {
  const [forms, articles, sections] = await Promise.all([
    prisma.portalForm.count({ where: { isActive: true } }),
    prisma.portalArticle.count({ where: { isPublished: true } }),
    prisma.portalCategory.count({ where: { isActive: true, parentId: null } }),
  ]);
  return { items: forms + articles, sections };
}

/**
 * The three cards floating on the hero: this person's newest open request,
 * their newest settled one, and the last thing the desk said to them. Each is
 * null when there is nothing, and the hero shows an example in its place.
 */
async function heroCards(userId: string, clock: Awaited<ReturnType<typeof getClock>>) {
  const [open, resolved, reply] = await Promise.all([
    prisma.ticket.findFirst({
      where: { reporterId: userId, status: { is: { settles: false } } },
      orderBy: { createdAt: "desc" },
      select: {
        title: true,
        type: true,
        priority: true,
        createdAt: true,
        resolvedAt: true,
        closedAt: true,
        pausedMinutes: true,
        pausedSince: true,
        status: { select: { id: true, name: true, color: true, settles: true, pausesClock: true } },
        assignee: { select: { name: true } },
        comments: {
          where: { isInternal: false, stepId: null, authorId: { not: userId } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    prisma.ticket.findFirst({
      where: { reporterId: userId, status: { is: { settles: true } } },
      orderBy: [{ resolvedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      select: { title: true },
    }),
    prisma.comment.findFirst({
      where: {
        ticket: { reporterId: userId },
        isInternal: false,
        stepId: null,
        authorId: { not: userId },
      },
      orderBy: { createdAt: "desc" },
      select: { body: true, author: { select: { name: true, avatarVariant: true } } },
    }),
  ]);

  const cards: HeroCards = {
    open: open
      ? {
          title: open.title,
          status: open.status,
          who: open.assignee?.name ?? null,
          repliedAge: open.comments[0] ? shortAge(open.comments[0].createdAt) : null,
          heat: heatOf(open, clock),
        }
      : null,
    resolved,
    reply: reply
      ? {
          who: reply.author.name,
          avatarVariant: reply.author.avatarVariant,
          quote: `“${excerptOf(reply.body, 110)}”`,
        }
      : null,
  };
  return cards;
}

/* ----------------------------------------------------------------- bands */

type Band = {
  id: string;
  kind:
    | "HERO"
    | "ANNOUNCEMENTS"
    | "CATEGORIES"
    | "FEATURED_FORMS"
    | "ARTICLES"
    | "MY_REQUESTS"
    | "RICH_TEXT";
  title: string | null;
  subtitle: string | null;
  limit: number | null;
  categoryId: string | null;
  span: number;
};

async function renderBand(
  band: Band,
  {
    user,
    flagged,
    locale,
    t,
  }: {
    user: { id: string };
    flagged: number;
    locale: string;
    t: Awaited<ReturnType<typeof getMessages>>;
  },
): Promise<ReactNode> {
  const heading = { title: band.title, subtitle: band.subtitle };

  if (band.kind === "ANNOUNCEMENTS") {
    const notices = await liveAnnouncements(false);
    if (notices.length === 0) return null;
    return (
      <section className="space-y-3">
        {notices.map((notice) => (
          <Announcement
            key={notice.id}
            title={notice.title}
            body={notice.body}
            tone={notice.tone}
            endsAt={notice.endsAt}
            locale={locale}
          />
        ))}
      </section>
    );
  }

  if (band.kind === "CATEGORIES") {
    const categories = await prisma.portalCategory.findMany({
      where: { isActive: true, parentId: band.categoryId },
      orderBy: { position: "asc" },
      take: band.limit ?? 8,
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        icon: true,
        color: true,
        _count: { select: { forms: true, articles: true } },
      },
    });
    if (categories.length === 0) return null;

    return (
      <section>
        <BandHeader
          title={heading.title || t.portal.browse}
          subtitle={heading.subtitle || t.portal.browseBlurb}
        />
        {/* A list, not tiles: each subject gets a full line for what it
            covers, and the eye runs down one column. */}
        <ul className="pcard p-1.5">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/portal/c/${category.slug}`}
                className="group hover:bg-surface-2 flex items-center gap-4 rounded-xl px-3 py-3 transition-colors"
              >
                <Tile icon={category.icon} color={category.color} />
                <span className="min-w-0 flex-1">
                  <span className="text-md block font-semibold">{category.name}</span>
                  {category.description ? (
                    <span className="text-text-2 mt-0.5 block truncate text-base">
                      {category.description}
                    </span>
                  ) : null}
                </span>
                <span className="text-text-3 shrink-0 font-mono text-xs">
                  {t.portal.itemCount(category._count.forms + category._count.articles)}
                </span>
                <ArrowRight size={14} className="text-text-3 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (band.kind === "FEATURED_FORMS") {
    const forms = await prisma.portalForm.findMany({
      // Featured first, and everything else behind them. A desk that has not
      // picked its favourites still has a catalogue, and a band that showed
      // nothing at all left a hole in the front page nobody could explain.
      where: { isActive: true, ...(band.categoryId ? { categoryId: band.categoryId } : {}) },
      orderBy: [{ isFeatured: "desc" }, { position: "asc" }],
      take: band.limit ?? 6,
      select: {
        id: true,
        slug: true,
        name: true,
        summary: true,
        icon: true,
        color: true,
        category: { select: { name: true } },
      },
    });
    if (forms.length === 0) return null;

    return (
      <section>
        <BandHeader
          title={heading.title || t.portal.popular}
          subtitle={heading.subtitle || t.portal.popularBlurb}
          href="/portal/search"
          linkLabel={t.portal.allServices}
        />
        <ul
          className={cn(
            "grid gap-4 sm:grid-cols-2",
            band.span >= 6 ? "lg:grid-cols-4" : "lg:grid-cols-3",
          )}
        >
          {forms.map((form) => (
            <li key={form.id}>
              <ServiceCard
                href={`/portal/f/${form.slug}`}
                title={form.name}
                summary={form.summary}
                icon={form.icon}
                color={form.color}
                meta={form.category?.name}
              />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (band.kind === "ARTICLES") {
    const articles = await prisma.portalArticle.findMany({
      where: {
        isPublished: true,
        ...(band.categoryId ? { categoryId: band.categoryId } : {}),
      },
      orderBy: [{ isFeatured: "desc" }, { views: "desc" }],
      take: band.limit ?? 4,
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        body: true,
        category: { select: { name: true } },
      },
    });
    if (articles.length === 0) return null;

    return (
      <section>
        <BandHeader
          title={heading.title || t.portal.answers}
          subtitle={heading.subtitle || t.portal.answersBlurb}
          href="/portal/answers"
          linkLabel={t.portal.allAnswers}
        />
        <div className="pcard grid gap-0 p-1.5 sm:grid-cols-2">
          {articles.map((article) => (
            <AnswerRow
              key={article.id}
              href={`/portal/kb/${article.slug}`}
              title={article.title}
              summary={article.summary}
              meta={[
                article.category?.name,
                t.portal.minRead(
                  Math.max(1, Math.round(article.body.trim().split(/\s+/).length / 200)),
                ),
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </div>
      </section>
    );
  }

  if (band.kind === "MY_REQUESTS") {
    // Which states are worth telling the requester about is the desk's
    // call, taken per status in Settings. Until a desk has taken it —
    // no status carries the flag — everything still open is shown, so
    // the band works on day one rather than sitting empty.
    const mine = await prisma.ticket.findMany({
      where: {
        reporterId: user.id,
        status: { is: flagged > 0 ? { showOnPortal: true } : { settles: false } },
      },
      orderBy: { createdAt: "desc" },
      take: band.limit ?? 3,
      select: {
        id: true,
        number: true,
        reference: true,
        title: true,
        createdAt: true,
        status: { select: { id: true, name: true, color: true, settles: true, pausesClock: true } },
      },
    });
    if (mine.length === 0) return null;

    const open = await prisma.ticket.count({
      where: { reporterId: user.id, status: { is: { settles: false } } },
    });

    return (
      <section className="pcard">
        {/* One name, always: this is the person's own list, and the rows that
            are waiting on them say so themselves with a pill. A card that
            renamed itself to "Waiting for your reply" made the other rows in
            it look like a mistake. */}
        <div className="flex items-center justify-between gap-3 px-[22px] pt-[18px] pb-3">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">
            {heading.title || t.portal.yourRequests}
          </h2>
          <Link
            href="/portal/requests"
            className="text-brand-deep text-sm font-semibold hover:underline"
          >
            {t.portal.openCount(open)}
          </Link>
        </div>
        <ul>
          {mine.map((ticket) => (
            <li key={ticket.id} className="border-line border-t">
              <Link
                href={`/portal/requests/${ticket.number}`}
                className="hover:bg-surface-2 flex items-center gap-3 px-[22px] py-[13px] transition-colors"
              >
                {ticket.status ? <StatusRing status={ticket.status} /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium">{ticket.title}</span>
                  <span className="text-text-3 mt-px flex items-center gap-2 text-[12.5px]">
                    <Reference reference={ticket.reference} className="text-[11.5px]" />
                    <span>· {t.common.ago(shortAge(ticket.createdAt, undefined, t))}</span>
                    {/* The same tag as on My requests: the two lists show
                        the same rows, and somebody who has learnt what this
                        pill means on one page should not have to learn it
                        again on the other. */}
                    {!ticket.status?.settles && ticket.status?.pausesClock ? (
                      <span className="bg-brand text-brand-fg inline-flex h-[21px] items-center rounded-full px-2 text-[11.5px] font-semibold whitespace-nowrap">
                        {t.portal.waitingOnYou}
                      </span>
                    ) : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/portal/requests"
          className="border-line text-text-2 hover:text-text flex items-center gap-1.5 border-t px-[22px] py-3.5 text-[13.5px] font-semibold transition-colors"
        >
          {t.portal.myRequests}
          <ArrowRight size={13} />
        </Link>
      </section>
    );
  }

  if (band.kind === "RICH_TEXT" && (band.title || band.subtitle)) {
    return (
      <section className="pcard p-6">
        {band.title ? (
          <h2 className="text-[24px] font-semibold tracking-[-0.025em]">{band.title}</h2>
        ) : null}
        {band.subtitle ? (
          <p className="text-text-2 text-md mt-2 leading-relaxed whitespace-pre-wrap">
            {band.subtitle}
          </p>
        ) : null}
      </section>
    );
  }

  return null;
}
