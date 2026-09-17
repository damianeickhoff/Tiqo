import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MessageSquare, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMessages } from "@/lib/settings";
import { shortAge } from "@/lib/tickets";
import { Avatar } from "@/components/avatar";
import { Card, EmptyState, buttonClass } from "@/components/ui";
import { HeatSpine, StatusRing } from "@/components/tickets/indicators";
import { Reference } from "@/components/tickets/ticket-row";
import { RequestFilters } from "@/components/portal/request-filters";
import { longestWait } from "@/lib/portal";
import { WaitingBanner } from "@/components/portal/portal-pieces";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).portal.myRequests };
}

type SearchParams = Promise<{ q?: string; show?: string }>;

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <header className="animate-rise">
          <h1 className="text-xl leading-tight font-semibold tracking-[-0.02em]">
            {t.portal.myRequests}
          </h1>
          <p className="text-text-2 mt-1 text-base">{t.portal.myRequestsBlurb}</p>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <RequestFilters
            q={q}
            show={show}
            counts={{ all: allCount, open: allCount - settledCount, settled: settledCount }}
          />
          <Link href="/portal" className={cn(buttonClass("primary", "md"), "rounded-full")}>
            <Plus size={14} strokeWidth={2.5} />
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

      {tickets.length === 0 ? (
        <Card className="animate-rise p-8">
          <EmptyState
            title={t.portal.noneYet}
            body={t.portal.noneYetBody}
            action={
              <Link href="/portal" className={buttonClass("primary", "md")}>
                {t.portal.raiseOne}
              </Link>
            }
          />
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="animate-rise">
            <h2 className="label mb-2 flex items-baseline gap-2">
              {group.label}
              <span className="tnum font-mono text-xs normal-case">{group.rows.length}</span>
            </h2>

            <Card className="overflow-hidden">
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
                          "hover:bg-surface-2 grid items-center gap-4 py-3.5 pr-4 pl-4 transition-[background-color]",
                          "grid-cols-[4px_minmax(0,1fr)_16px] sm:grid-cols-[4px_128px_minmax(0,1fr)_190px_16px]",
                          // Settled rows step back: they are history, and history
                          // should not compete with what is still running.
                          settled && "opacity-70",
                        )}
                      >
                        {/* How much of the promise has burned, as a bar rather
                            than a rule down the whole row: a full-height edge
                            reads as a border, and a border cannot show progress. */}
                        <HeatSpine ticket={ticket} />

                        <Reference reference={ticket.reference} className="hidden sm:block" />

                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="text-md truncate font-semibold">{ticket.title}</span>
                            {yourTurn ? (
                              <span className="tag text-brand-deep shrink-0 bg-[var(--brand-tint)]">
                                {t.portal.waitingOnYou}
                              </span>
                            ) : null}
                          </span>

                          <span className="text-text-3 mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm">
                            {ticket.portalForm ? <span>{ticket.portalForm.name} ·</span> : null}
                            <span className="tnum font-mono">
                              {t.common.ago(shortAge(ticket.createdAt, undefined, t))}
                            </span>
                            {ticket._count.comments > 0 ? (
                              <>
                                <span aria-hidden>·</span>
                                <span className="inline-flex items-center gap-1">
                                  <MessageSquare size={11} aria-hidden />
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

                        <span className="hidden items-center gap-3 px-2 sm:flex">
                          {ticket.status ? (
                            <span className="text-text-2 flex min-w-0 items-center gap-1.5 text-sm">
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

                        <ChevronRight size={15} className="text-text-3 shrink-0" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
