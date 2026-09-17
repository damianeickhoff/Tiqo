import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { dateLocaleOf, getClock, getMessages, getSettings } from "@/lib/settings";
import { describeHours } from "@/lib/clock";
import { StatusRing } from "@/components/tickets/glyphs";
import { HeatSpine } from "@/components/tickets/indicators";
import { Reference } from "@/components/tickets/ticket-row";
import { liveAnnouncements, longestWait, typicalReplyMinutes } from "@/lib/portal";
import { Clock } from "lucide-react";
import { shortAge, shortSpan } from "@/lib/tickets";
import { PortalSearch } from "@/components/portal/portal-search";
import {
  Announcement,
  ArticleCard,
  BandHeader,
  ServiceCard,
  WaitingBanner,
} from "@/components/portal/portal-pieces";
import { PortalIcon } from "@/components/portal/portal-icon";
import { ArrowRight } from "lucide-react";
import { SignalField } from "@/components/shell/signal-field";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
/**
 * The page is six columns wide and a band takes between two and all six, as the
 * designer left it. Below md everything is one column: a third of a phone is
 * not a column, it is a margin.
 */
const SPAN: Record<number, string> = {
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
};

const span = (columns: number) => SPAN[columns] ?? SPAN[6]!;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getSettings()).portalTitle };
}

/**
 * The front page is a list of bands, in the order an admin put them, rather
 * than a fixed layout. A desk that leads with an outage notice, a desk that
 * leads with its catalogue and a desk that leads with search are all normal —
 * and none of them should need a developer.
 *
 * Every band is rendered from one kit of cards, so the page reads as one thing.
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
            limit: 5,
            categoryId: null,
            span: 6,
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

  // The one thing on the front page addressed to this person by name: the desk
  // has asked them something and is waiting. It goes where the page turns from
  // greeting to browsing, so it is met before the catalogue rather than under it.
  const waiting = await longestWait(user.id);

  const bannerAt = (() => {
    const catalogue = bands.findIndex((band) => band.kind === "CATEGORIES");
    if (catalogue >= 0) return catalogue;
    const hero = bands.findIndex((band) => band.kind === "HERO");
    return hero >= 0 ? hero + 1 : 0;
  })();

  const rendered: ReactNode[] = bands.map(async (band) => {
    const heading = { title: band.title, subtitle: band.subtitle };

    if (band.kind === "HERO") {
      // Four quick starts under the search: the top-level sections of the
      // catalogue, so the common asks are one click before anyone types.
      const starts = await prisma.portalCategory.findMany({
        where: { isActive: true, parentId: null },
        orderBy: { position: "asc" },
        take: 4,
        select: { id: true, slug: true, name: true, icon: true },
      });
      const hours = describeHours(clock.hours);
      const reply = await typicalReplyMinutes();
      return (
        <div key={band.id} className={cn("space-y-4", span(band.span))}>
          {/* The hero is a band on the brand wash: greeting, welcome and
                  the search on the left, the desk own graphic — a queue rising
                  toward its target — fading in from the right. */}
          <section
            className="rounded-panel relative border px-6 py-8 sm:px-8 sm:py-10"
            style={{
              background: "var(--brand-wash)",
              borderColor: "color-mix(in oklab, var(--brand) 22%, transparent)",
            }}
          >
            {/* The clipping belongs to the graphic, not to the band. It is
                here so the bars stop at the rounded corners; on the section it
                also swallowed the search results, which hang below the band by
                design. */}
            <div aria-hidden className="rounded-panel absolute inset-0 overflow-hidden">
              <div
                className="text-text pointer-events-none absolute inset-y-0 right-0 hidden w-[52%] opacity-90 md:block"
                style={{
                  maskImage: "linear-gradient(90deg, transparent, #000 40%)",
                  WebkitMaskImage: "linear-gradient(90deg, transparent, #000 40%)",
                }}
              >
                <SignalField bars={44} height="100%" target={0.66} />
              </div>
            </div>
            <div className="relative max-w-xl">
              <h1 className="text-2xl leading-[1.1] font-semibold tracking-[-0.03em] sm:text-3xl">
                {t.portal.greeting(user.name.split(" ")[0]!)}
              </h1>
              <p className="text-text-2 text-md mt-2 max-w-[48ch]">{settings.portalWelcome}</p>
              <div className="mt-5">
                <PortalSearch />
              </div>
              {starts.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {starts.map((start) => (
                    <Link
                      key={start.id}
                      href={`/portal/c/${start.slug}`}
                      className="border-line bg-surface text-text-2 hover:border-line-strong hover:text-text inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-base font-medium shadow-[var(--highlight)] transition-colors"
                    >
                      <PortalIcon name={start.icon} size={15} />
                      {start.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
          {/* What the desk itself is doing: whether it is open, until when,
              and how long an answer usually takes. The one thing a requester
              wants to know before deciding between a form and the phone.

              One line, not two cards: "usually answered in four hours" is the
              subtitle the opening hours were missing, and once it sits there
              the second card has nothing left to say. */}
          <div className="card flex items-center gap-3.5 px-5 py-4">
            <span
              aria-hidden
              className="rounded-control flex size-9 shrink-0 items-center justify-center"
              style={{
                background:
                  hours.open === false
                    ? "var(--surface-3)"
                    : "color-mix(in oklab, var(--positive) 14%, transparent)",
                color: hours.open === false ? "var(--text-3)" : "var(--positive)",
              }}
            >
              <Clock size={17} />
            </span>

            <span className="min-w-0">
              <span className="label block">{t.portal.openingHours}</span>
              <span className="text-md mt-0.5 block truncate font-semibold">
                {hours.open === null
                  ? t.portal.alwaysOpen
                  : hours.open
                    ? t.portal.openUntil(hours.range.split("–")[1] ?? hours.range)
                    : `${hours.days} ${hours.range}`}
              </span>
              <span className="text-text-3 block text-sm">
                {reply === null
                  ? t.portal.noTypicalReply
                  : `${t.portal.typicalReply} ${shortSpan(reply * 60_000, t)}`}
              </span>
            </span>
          </div>
        </div>
      );
    }

    if (band.kind === "ANNOUNCEMENTS") {
      const notices = await liveAnnouncements(false);
      if (notices.length === 0) return null;
      return (
        <section key={band.id} className={cn("space-y-2.5", span(band.span))}>
          {notices.map((notice) => (
            <Announcement
              key={notice.id}
              title={notice.title}
              body={notice.body}
              tone={notice.tone}
              endsAt={notice.endsAt}
              locale={dateLocaleOf(settings)}
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
        <section key={band.id} className={span(band.span)}>
          <BandHeader
            title={heading.title || t.portal.browse}
            subtitle={heading.subtitle || t.portal.browseBlurb}
          />
          {/* A list, not tiles: each subject gets a full line for what it
                  covers, and the eye runs down one column. */}
          <ul className="divide-line divide-y">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/portal/c/${category.slug}`}
                  className="group hover:bg-surface-2 rounded-control -mx-2 flex items-center gap-4 px-2 py-3.5 transition-[background-color]"
                >
                  <span
                    aria-hidden
                    className="rounded-control flex size-10 shrink-0 items-center justify-center"
                    style={{
                      background: `color-mix(in oklab, ${category.color} 15%, transparent)`,
                      color: category.color,
                    }}
                  >
                    <PortalIcon name={category.icon} size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="group-hover:text-brand-deep text-md block font-semibold transition-colors">
                      {category.name}
                    </span>
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
        where: {
          isActive: true,
          ...(band.categoryId ? { categoryId: band.categoryId } : { isFeatured: true }),
        },
        orderBy: { position: "asc" },
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
        <section key={band.id} className={span(band.span)}>
          <BandHeader
            title={heading.title || t.portal.popular}
            subtitle={heading.subtitle}
            href="/portal/search"
            linkLabel={t.portal.allServices}
          />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          views: true,
          category: { select: { name: true } },
        },
      });
      if (articles.length === 0) return null;

      return (
        <section key={band.id} className={cn("animate-rise", span(band.span))}>
          <BandHeader
            title={heading.title || t.portal.answers}
            subtitle={heading.subtitle || t.portal.answersBlurb}
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {articles.map((article) => (
              <li key={article.id}>
                <ArticleCard
                  href={`/portal/kb/${article.slug}`}
                  title={article.title}
                  summary={article.summary}
                  meta={article.category?.name}
                />
              </li>
            ))}
          </ul>
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
          type: true,
          title: true,
          createdAt: true,
          // What the spine needs to know how far along the run this is: the
          // priority's target for tickets that have one, the due date for the
          // rest, and the settled stamps so a finished ticket stops burning.
          priority: true,
          dueDate: true,
          resolvedAt: true,
          closedAt: true,
          pausedMinutes: true,
          pausedSince: true,
          status: {
            select: { id: true, name: true, color: true, settles: true, pausesClock: true },
          },
        },
      });
      if (mine.length === 0) return null;

      return (
        <section key={band.id} className={cn("animate-rise", span(band.span))}>
          {/* Two different bands wearing one name would be a lie: with statuses
                  chosen for the portal these really are the ones waiting on the
                  person reading them, and without that choice it is simply
                  everything they have open. */}
          <BandHeader
            title={heading.title || (flagged > 0 ? t.portal.waitingOnYou : t.portal.yourOpen)}
            subtitle={heading.subtitle || (flagged > 0 ? t.portal.waitingOnYouBlurb : undefined)}
            href="/portal/requests"
            linkLabel={t.portal.myRequests}
          />
          <Card className="overflow-hidden">
            <ul className="divide-line divide-y">
              {mine.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/portal/requests/${ticket.number}`}
                    className="hover:bg-surface-2 flex items-center gap-3 px-4 py-3 transition-[background-color]"
                  >
                    {/* The same burn-down bar the rest of the app shows, for
                        the same reason it is on My requests: these are the same
                        rows, and one of them should not be reading differently. */}
                    <HeatSpine ticket={ticket} />

                    <Reference reference={ticket.reference} className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-md truncate font-medium">{ticket.title}</span>
                        {/* The same tag as on My requests: the two lists show
                            the same rows, and somebody who has learnt what this
                            pill means on one page should not have to learn it
                            again on the other. */}
                        {!ticket.status?.settles && ticket.status?.pausesClock ? (
                          <span className="tag text-brand-deep shrink-0 bg-[var(--brand-tint)]">
                            {t.portal.waitingOnYou}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-text-3 text-sm">
                        {t.common.ago(shortAge(ticket.createdAt, undefined, t))}
                      </span>
                    </span>
                    {ticket.status ? (
                      <span className="text-text-2 flex shrink-0 items-center gap-1.5 text-sm">
                        <StatusRing status={ticket.status} />
                        {ticket.status.name}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      );
    }

    if (band.kind === "RICH_TEXT" && (band.title || band.subtitle)) {
      return (
        <section key={band.id} className={cn("animate-rise", span(band.span))}>
          <Card className="p-6">
            {band.title ? (
              <h2 className="text-lg font-bold tracking-[-0.02em]">{band.title}</h2>
            ) : null}
            {band.subtitle ? (
              <p className="text-text-2 text-md mt-2 leading-relaxed whitespace-pre-wrap">
                {band.subtitle}
              </p>
            ) : null}
          </Card>
        </section>
      );
    }

    return null;
  });

  if (waiting) {
    rendered.splice(
      bannerAt,
      0,
      <div key="waiting" className="md:col-span-6">
        <WaitingBanner
          href={`/portal/requests/${waiting.number}`}
          who={waiting.assignee.name}
          reference={waiting.reference}
          title={waiting.title}
          since={waiting.since}
        />
      </div>,
    );
  }

  return <div className="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-6">{rendered}</div>;
}
