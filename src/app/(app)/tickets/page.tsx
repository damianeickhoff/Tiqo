import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_DIR, DEFAULT_SORT, QUEUE_SORTS, type QueueSort } from "@/lib/tickets";
import type { SortDir } from "@/components/table/sort";
import { requireUser } from "@/lib/auth";
import { canWriteInternalNote, isStaff, ticketVisibilityFilter } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { FilterBar } from "@/components/tickets/filter-bar";
import { QueueHead } from "@/components/tickets/queue-head";
import { QueueViews } from "@/components/tickets/queue-views";
import { TicketRow } from "@/components/tickets/ticket-row";
import { TicketColumns } from "@/components/tickets/ticket-columns";
import { TicketTable } from "@/components/tickets/ticket-table";
import { EmptyState, buttonClass } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.tickets.title };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

/** Fifty is a screenful and a bit: enough to scan, few enough to load. */
const PER_PAGE = 50;

/**
 * The orders the queue can be read in — one per column you can tap.
 *
 * "Urgent first" is where a queue nobody has sorted starts, because it is the
 * order the work should be done in; it is the priority column's own descending
 * order rather than a separate idea of sorting. Postgres sorts enums in
 * declaration order (LOW→URGENT), which is what makes `desc` urgent-first.
 * Nulls go last everywhere: a ticket with no due date is not the most urgent
 * thing on the desk.
 *
 * "Left" is the one column whose order the database cannot express — what is
 * left of a promise is the target for the priority less the working hours the
 * ticket has been alive, and a query has neither the desk's opening hours nor
 * its targets. Ascending is therefore the closest a query can get to "running
 * out soonest": the most urgent, oldest first. Which is, not by accident, the
 * order the desk was already reading in.
 */
const ORDERS: Record<QueueSort, (dir: SortDir) => Prisma.TicketOrderByWithRelationInput[]> = {
  reference: (dir) => [{ reference: dir }],
  subject: (dir) => [{ title: dir }],
  status: (dir) => [{ status: { position: dir } }],
  priority: (dir) => [{ priority: dir }, { createdAt: "asc" }],
  requester: (dir) => [{ reporter: { name: dir } }],
  assignee: (dir) => [{ assignee: { name: dir } }],
  replies: (dir) => [{ comments: { _count: dir } }],
  created: (dir) => [{ createdAt: dir }],
  due: (dir) => [{ dueDate: { sort: dir, nulls: "last" } }, { priority: "desc" }],
  left: (dir) =>
    dir === "asc"
      ? [{ priority: "desc" }, { createdAt: "asc" }]
      : [{ priority: "asc" }, { createdAt: "desc" }],
};

export default async function TicketsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const notes = canWriteInternalNote(user);

  const status = one(params.status);
  const priority = one(params.priority);
  const projectId = one(params.project);
  const milestone = one(params.milestone);
  const assignee = one(params.assignee);
  const type = one(params.type);
  const scope = one(params.scope);
  const team = one(params.team);
  const openOnly = one(params.open) === "1";
  const blockedOnly = one(params.blocked) === "1";
  const q = one(params.q);
  // Whatever is in the address, only if it is a column this queue has: a
  // hand-typed order should land on an order rather than on no rows at all.
  const sort = QUEUE_SORTS.find((field) => field === one(params.sort)) ?? DEFAULT_SORT;
  const dir: SortDir =
    one(params.dir) === "asc" ? "asc" : one(params.dir) === "desc" ? "desc" : DEFAULT_DIR;
  // Which decisions the queue is about: one waiting on anybody, or one waiting
  // on whoever is reading. Both are questions about the ticket — "can this move"
  // — which is why they are filters here rather than a queue of their own.
  const approval = one(params.approval);
  // Clamped rather than trusted: a hand-typed page number should land on a page.
  const page = Math.max(1, Number.parseInt(one(params.page) ?? "1", 10) || 1);

  const where: Prisma.TicketWhereInput = {
    ...ticketVisibilityFilter(user),
    ...(status ? { statusId: status } : {}),
    ...(priority ? { priority: priority as Prisma.TicketWhereInput["priority"] } : {}),
    ...(projectId ? { projectId } : {}),
    // Reached from a milestone card, so its ticket tally leads somewhere that
    // shows the same tickets it counted.
    ...(milestone ? { milestoneId: milestone } : {}),
    ...(type ? { type: type as Prisma.TicketWhereInput["type"] } : {}),
    ...(team === "none" ? { teamId: null } : team ? { teamId: team } : {}),
    // "Open" is whatever the desk has not marked as settling, so it follows the
    // statuses someone configured rather than a name hard-coded here.
    ...(openOnly ? { status: { is: { settles: false } } } : {}),
    // Computed from the links rather than stored on the ticket: "blocked" is
    // something another ticket decides, and a column would be a second copy of
    // it that goes stale the moment the blocker is closed. A blocker with no
    // status counts as open — deleting a status does not finish the work.
    ...(blockedOnly
      ? {
          linksIn: {
            some: {
              kind: "BLOCKS" as const,
              source: { NOT: { status: { is: { settles: true } } } },
            },
          },
        }
      : {}),
    // A pending round is the whole of it: an answered one is history, and a
    // withdrawn one was never a decision anybody owed.
    ...(approval === "pending"
      ? { approvals: { some: { state: "PENDING" as const } } }
      : approval === "me"
        ? { approvals: { some: { state: "PENDING" as const, approverId: user.id } } }
        : {}),
    ...(assignee === "me"
      ? { assigneeId: user.id }
      : assignee === "none"
        ? { assigneeId: null }
        : assignee
          ? { assigneeId: assignee }
          : {}),
    // Two either-or groups can both be in force, and one `OR` key would quietly
    // overwrite the other — so they are combined rather than spread.
    AND: [
      // The reference is what people quote, so it has to be searchable
      // alongside the words in the title.
      ...(q
        ? [
            {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { reference: { contains: q, mode: "insensitive" as const } },
                // The words someone actually wrote are often the only thing
                // they remember about a ticket a month later.
                { description: { contains: q, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
      // The circle an operator covers: their own work plus their desks'.
      ...(scope === "team"
        ? [
            {
              OR: [
                { assigneeId: user.id },
                { team: { is: { members: { some: { id: user.id } } } } },
              ],
            },
          ]
        : []),
    ],
  };

  const t = await getMessages();

  /** What each built-in view holds right now, so the column can say so.
   *
   *  The same conditions the views themselves set, asked as counts: a column of
   *  views whose numbers came from anywhere else would be a column that lies
   *  the moment a filter changes shape. "Everything" is the whole of what this
   *  person may see, which is what the view shows.
   */
  const visible = ticketVisibilityFilter(user);
  const stillOpen: Prisma.TicketWhereInput = {
    ...visible,
    status: { is: { settles: false } },
  };

  const [tickets, total, projects, agents, statuses, teams, myTeams, counts] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: ORDERS[sort](dir),
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        number: true,
        reference: true,
        title: true,
        status: true,
        priority: true,
        type: true,
        createdAt: true,
        dueDate: true,
        resolvedAt: true,
        pausedMinutes: true,
        pausedSince: true,
        closedAt: true,
        project: { select: { key: true, color: true } },
        assignee: { select: { name: true, avatarVariant: true } },
        reporter: { select: { name: true, avatarVariant: true } },
        labels: { select: { id: true, name: true, color: true } },
        steps: { select: { doneAt: true } },
        // One row is all the marker needs: it says whether, not how many.
        linksIn: {
          where: { kind: "BLOCKS", source: { NOT: { status: { is: { settles: true } } } } },
          take: 1,
          select: { id: true },
        },
        // Everything said about it, notes included: the column answers "how
        // much conversation has this had", which internal notes are part of.
        //
        // The files are counted differently, because the clip now carries its
        // number rather than hiding it in a tooltip: a count that takes in the
        // attachments on internal notes tells somebody who may not read notes
        // how many files there are that they cannot open.
        _count: {
          select: {
            comments: true,
            attachments: notes ? true : { where: { comment: { isInternal: false } } },
          },
        },
      },
    }),
    // Counted rather than capped. A queue that silently stopped at 200 was
    // telling operators there were 200 tickets, which was sometimes a lie.
    prisma.ticket.count({ where }),
    prisma.project.findMany({
      where: { isArchived: false },
      orderBy: { key: "asc" },
      select: { id: true, key: true, name: true },
    }),
    isStaff(user)
      ? prisma.user.findMany({
          where: {
            isActive: true,
            role: { OR: [{ isMaster: true }, { permissions: { has: "ticket.edit" } }] },
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    prisma.status.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    prisma.team.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.team.count({ where: { members: { some: { id: user.id } } } }),
    Promise.all([
      prisma.ticket.count({ where: stillOpen }),
      prisma.ticket.count({ where: { ...stillOpen, assigneeId: user.id } }),
      prisma.ticket.count({
        where: {
          ...stillOpen,
          OR: [{ assigneeId: user.id }, { team: { is: { members: { some: { id: user.id } } } } }],
        },
      }),
      prisma.ticket.count({ where: { ...stillOpen, assigneeId: null } }),
      prisma.ticket.count({ where: visible }),
    ]).then(([open, mine, groups, unassigned, all]) => ({
      open,
      mine,
      groups,
      unassigned,
      all,
    })),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);

  /** Everything the address is saying, as the headings and the pager both have
   *  to say it again with one thing changed. */
  const current = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = one(value);
    if (first) current.set(key, first);
  }

  /** The same query, one page along. */
  const pageHref = (next: number) => {
    const query = new URLSearchParams(current);
    query.delete("page");
    if (next > 1) query.set("page", String(next));
    const search = query.toString();
    return search ? `/tickets?${search}` : "/tickets";
  };

  return (
    // The page is exactly the height of the desk's content area, so the queue
    // itself can be the thing that scrolls — both ways. Without that the table
    // could only ever be as wide as the pane, which is what made every column a
    // fight. The height is spelled out rather than inherited because `main` is
    // free to grow past its own box, and a page that measured itself against a
    // grown one would hang its last rows below the window. Only from `lg`:
    // below it the whole desk is one scrolling column and the queue is a part
    // of it, so the table scrolls sideways only.
    // The head and the views stay on the ground; the sheet is the table region
    // and nothing else — the filters that narrow it are its own header row.
    <div className="flex flex-col lg:h-[calc(100dvh-var(--bar))] lg:min-h-0">
      <Suspense fallback={<div className="h-[52px]" />}>
        <QueueHead total={total} />
      </Suspense>

      <div className="flex min-h-0 flex-1 flex-col gap-2 pb-5 lg:flex-row lg:gap-5 lg:pr-5">
        <Suspense fallback={<div className="lg:w-[200px]" />}>
          <QueueViews counts={counts} />
        </Suspense>

        <div className="sheet mx-3 flex min-w-0 flex-col overflow-hidden lg:mx-0 lg:min-h-0 lg:flex-1">
          <Suspense fallback={<div className="h-[52px]" />}>
            <FilterBar
              statuses={statuses}
              projects={projects.map((p) => ({ id: p.id, label: `${p.key} · ${p.name}` }))}
              assignees={agents.map((a) => ({ id: a.id, label: a.name }))}
              teams={teams.map((group) => ({ id: group.id, label: group.name }))}
              showAssignee={isStaff(user)}
            />
          </Suspense>

          <TicketTable className="min-h-0 flex-1">
            {tickets.length === 0 ? (
              <div className="px-5 py-6 lg:px-6">
                <EmptyState
                  title={t.tickets.emptyTitle}
                  // The one empty result that is not about the filters: asking for
                  // your groups' work when you are on no group can only ever return
                  // nothing, and the filters give no clue why.
                  body={
                    scope === "team" && myTeams === 0 ? t.tickets.emptyNoDesk : t.tickets.emptyBody
                  }
                  action={
                    <Link href="/tickets/new" className={buttonClass("primary", "md")}>
                      {t.nav.newTicket}
                    </Link>
                  }
                />
              </div>
            ) : (
              <>
                {/* Flush, not a card: the queue is the page, and a frame around it
                only took twenty pixels from every row. */}
                <TicketColumns sort={sort} dir={dir} query={current.toString()} />
                <ul>
                  {tickets.map((ticket, i) => (
                    <TicketRow
                      key={ticket.id}
                      ticket={{
                        ...ticket,
                        replies: ticket._count.comments,
                        attachments: ticket._count.attachments,
                        blocked: ticket.linksIn.length > 0,
                      }}
                      index={i}
                    />
                  ))}
                </ul>
              </>
            )}
          </TicketTable>

          {/* Inside the sheet but outside the scroller: a footer that slid away
              sideways with the columns would be one nobody could find. The
              range is here rather than in the head because it is a fact about
              the page you are on, not about the view you are in. */}
          <nav className="border-line text-text-3 flex shrink-0 items-center gap-3 border-t px-4 py-2 text-sm">
            <p className="tnum">{t.tickets.shown(from, to, total)}</p>
            <div className="ml-auto flex items-center gap-2">
              <Step href={pageHref(page - 1)} disabled={page === 1} label={t.tickets.prev} />
              <Step href={pageHref(page + 1)} disabled={page === pages} label={t.tickets.next} />
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}

/** One step through the queue, or a dead end at either edge. */
function Step({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <span className="text-text-3 rounded-control h-8 border border-transparent px-2.5 text-sm leading-8 opacity-50 shadow-[var(--highlight)]">
        {label}
      </span>
    );
  }
  return (
    <Link href={href} className={buttonClass("outline", "sm")}>
      {label}
    </Link>
  );
}
