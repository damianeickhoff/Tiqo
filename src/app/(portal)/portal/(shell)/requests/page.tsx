import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MessageSquare, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMessages } from "@/lib/settings";
import { shortAge } from "@/lib/tickets";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/ui";
import { HeatSpine } from "@/components/tickets/indicators";
import { StatusRing } from "@/components/tickets/glyphs";
import { Reference } from "@/components/tickets/ticket-row";
import { RequestFilters } from "@/components/portal/request-filters";
import { longestWait } from "@/lib/portal";
import { WaitingBanner } from "@/components/portal/portal-pieces";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).portal.myRequests };
}

type SearchParams = Promise<{ q?: string; show?: string }>;

/** The head's brand pill, and the same offer again in the empty state. */
const MAKE_REQUEST =
  "bg-brand text-brand-fg inline-flex h-[42px] items-center gap-2 rounded-full px-[18px] " +
  "text-base font-semibold transition-[filter] hover:brightness-[0.97]";

/**
 * Everything this person has asked for, newest first. Their own only — the
 * portal is one person's view of their own dealings with the desk, whatever
 * else their account may be allowed to see.
 */
export default async function PortalRequests({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const show = params.show === "open" || params.show === "settled" ? params.show : "all";

  const [tickets, counts, t] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        reporterId: user.id,
        ...(show === "all" ? {} : { status: { is: { settles: show === "settled" } } }),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { reference: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        number: true,
        reference: true,
        type: true,
        title: true,
        priority: true,
        createdAt: true,
        resolvedAt: true,
        closedAt: true,
        pausedMinutes: true,
        pausedSince: true,
        status: {
          select: { id: true, name: true, color: true, settles: true, pausesClock: true },
        },
        assignee: { select: { name: true, avatarVariant: true } },
        portalForm: { select: { name: true } },
        // The last thing said out loud, so a row can say whose turn it is
        // without opening it.
        comments: {
          where: { stepId: null, isInternal: false },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true, author: { select: { name: true } } },
        },
        _count: { select: { comments: { where: { stepId: null, isInternal: false } } } },
      },
    }),
    // Counted over everything they have raised, not over what the filter is
    // showing: a tab that counted only itself would always read the same.
    prisma.ticket.groupBy({
      by: ["statusId"],
      where: { reporterId: user.id },
      _count: { _all: true },
    }),
    getMessages(),
  ]);

  const settlingIds = new Set(
    (await prisma.status.findMany({ where: { settles: true }, select: { id: true } })).map(
      (status) => status.id,
    ),
  );
  const settledCount = counts
    .filter((row) => row.statusId && settlingIds.has(row.statusId))
    .reduce((sum, row) => sum + row._count._all, 0);
  const allCount = counts.reduce((sum, row) => sum + row._count._all, 0);

  const groups = [
    { label: t.portal.stillOpen, rows: tickets.filter((ticket) => !ticket.status?.settles) },
    { label: t.portal.settled, rows: tickets.filter((ticket) => ticket.status?.settles) },
  ].filter((group) => group.rows.length > 0);

  // A status that stops the clock is the desk saying it is waiting on them.
  // One banner over the one that has been stuck longest — a stack of banners is
  // a wall, and the tag on each row carries the rest.
  const waiting = await longestWait(user.id);

  return (
    <div className="portal-wrap pb-14">
      <div className="animate-rise flex flex-wrap items-end gap-x-6 gap-y-5 pt-9 pb-[30px]">
        <header>
          <h1 className="text-[36px] leading-[1.1] font-semibold tracking-[-0.035em]">
            {t.portal.myRequests}
          </h1>
          <p className="text-text-2 mt-2.5 max-w-[60ch] text-[16px]">{t.portal.myRequestsBlurb}</p>
        </header>

        {/* The tools ride on the baseline of the title rather than under it:
            this page is a list somebody narrows, and the narrowing belongs
            beside the name of what is being narrowed. */}
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <RequestFilters
            q={q}
            show={show}
            counts={{ all: allCount, open: allCount - settledCount, settled: settledCount }}
          />
          <Link href="/portal" className={MAKE_REQUEST}>
            <Plus size={15} strokeWidth={2.5} />
            {t.portal.makeRequest}
          </Link>
        </div>
      </div>

      {waiting ? (
        <WaitingBanner
          href={`/portal/requests/${waiting.number}`}
          who={waiting.assignee.name}
          reference={waiting.reference}
          title={waiting.title}
          since={waiting.since}
        />
      ) : null}

      {/* Two different empty pages. Somebody who has never asked us for
          anything is told what this page will hold; somebody whose filter or
          search simply matched nothing is told that, and offered the way back
          to the whole list. Saying "you have not asked us for anything yet" to
          a person with six open requests is the page calling them a liar. */}
      {tickets.length === 0 ? (
        <div className="mt-8">
          {allCount === 0 ? (
            <EmptyState
              title={t.portal.noneYet}
              body={t.portal.noneYetBody}
              action={
                <Link href="/portal" className={MAKE_REQUEST}>
                  {t.portal.raiseOne}
                </Link>
              }
            />
          ) : (
            <EmptyState
              title={t.portal.noMatches}
              body={t.portal.noMatchesBody}
              action={
                <Link href="/portal/requests" className={MAKE_REQUEST}>
                  {t.portal.showEverything}
                </Link>
              }
            />
          )}
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="animate-rise">
            <h2 className="mt-8 mb-3.5 flex items-baseline gap-2.5 text-[20px] font-semibold tracking-[-0.02em]">
              {group.label}
              <span className="tnum text-text-3 font-mono text-[12.5px] font-medium">
                {group.rows.length}
              </span>
            </h2>

            <div className="pcard overflow-hidden">
              <ul className="divide-line divide-y">
                {group.rows.map((ticket) => {
                  const settled = Boolean(ticket.status?.settles);
                  const yourTurn = !settled && Boolean(ticket.status?.pausesClock);
                  const last = ticket.comments[0];

                  return (
                    <li key={ticket.id}>
                      <Link
                        href={`/portal/requests/${ticket.number}`}
                        className={cn(
                          "hover:bg-surface-2 grid items-center gap-[18px] py-4 pr-[22px] pl-[18px] transition-[background-color]",
                          "grid-cols-[4px_minmax(0,1fr)_16px] sm:grid-cols-[4px_132px_minmax(0,1fr)_230px_16px]",
                          // Settled rows step back: they are history, and history
                          // should not compete with what is still running.
                          settled && "opacity-[0.72]",
                        )}
                      >
                        {/* How much of the promise has burned, as a bar rather
                            than a rule down the whole row: a full-height edge
                            reads as a border, and a border cannot show progress. */}
                        <HeatSpine ticket={ticket} />

                        <Reference
                          reference={ticket.reference}
                          className="hidden text-xs sm:block"
                        />

                        <span className="min-w-0">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="truncate text-[15.5px] font-semibold tracking-[-0.01em]">
                              {ticket.title}
                            </span>
                            {yourTurn ? (
                              <span className="bg-brand text-brand-fg inline-flex h-[21px] shrink-0 items-center rounded-full px-2 text-[11.5px] font-semibold whitespace-nowrap">
                                {t.portal.waitingOnYou}
                              </span>
                            ) : null}
                          </span>

                          <span className="text-text-3 mt-[3px] flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm">
                            {ticket.portalForm ? <span>{ticket.portalForm.name} ·</span> : null}
                            <span className="tnum font-mono text-xs">
                              {t.common.ago(shortAge(ticket.createdAt, undefined, t))}
                            </span>
                            {ticket._count.comments > 0 ? (
                              <>
                                <span aria-hidden>·</span>
                                <span className="inline-flex items-center gap-1">
                                  <MessageSquare size={12} aria-hidden />
                                  {t.portal.replyCount(ticket._count.comments)}
                                </span>
                              </>
                            ) : null}
                            {/* Whose turn it is, said as a sentence: "replied"
                                and "asked you something" are different news. */}
                            {last ? (
                              <>
                                <span aria-hidden>·</span>
                                <span>
                                  {(yourTurn ? t.portal.askedYouSomething : t.portal.lastReplyBy)(
                                    last.author.name.split(" ")[0] ?? last.author.name,
                                    shortAge(last.createdAt, undefined, t),
                                  )}
                                </span>
                              </>
                            ) : null}
                          </span>
                        </span>

                        <span className="text-text-2 hidden items-center gap-2 text-[13.5px] sm:flex">
                          {ticket.status ? (
                            <span className="flex min-w-0 items-center gap-2">
                              <StatusRing status={ticket.status} />
                              <span className="truncate">{ticket.status.name}</span>
                            </span>
                          ) : null}

                          {/* Who has it, or an empty ring saying nobody yet. */}
                          {ticket.assignee ? (
                            <Avatar
                              name={ticket.assignee.name}
                              variant={ticket.assignee.avatarVariant}
                              size={22}
                              className="ml-auto shrink-0"
                            />
                          ) : (
                            <span
                              aria-hidden
                              title={t.tickets.unassigned}
                              className="border-line ml-auto block size-[22px] shrink-0 rounded-full border border-dashed"
                            />
                          )}
                        </span>

                        <ChevronRight size={14} className="text-text-3 shrink-0" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
