import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isStaff, ticketVisibilityFilter } from "@/lib/permissions";
import { getDashboard, getReplyTimes } from "@/lib/analytics";
import { dateLocaleOf, getMessages, getSettings } from "@/lib/settings";
import { readWidgets, WIDGETS, type WidgetId } from "@/lib/dashboard-widgets";
import { PageHeader } from "@/components/shell/page-header";
import { TicketRow, type TicketRowData } from "@/components/tickets/ticket-row";
import { TicketColumns } from "@/components/tickets/ticket-columns";
import { TicketTable } from "@/components/tickets/ticket-table";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { InstrumentStrip } from "@/components/charts/instrument-strip";
import { VolumeChart } from "@/components/charts/volume-chart";
import { PipelineBar } from "@/components/charts/pipeline-bar";
import { PriorityBars } from "@/components/charts/priority-bars";
import { ComplianceGauge } from "@/components/charts/compliance-gauge";
import { WorkloadBars } from "@/components/charts/workload-bars";
import { AgeingBars } from "@/components/charts/ageing-bars";
import { QueueOverview } from "@/components/charts/queue-overview";
import { ReplyTime } from "@/components/charts/reply-time";
import { CategoryArc } from "@/components/charts/category-arc";
import { ThroughputBars } from "@/components/charts/throughput-bars";
import { CustomiseDashboard } from "@/components/dashboard/customise";
import { DashboardGrid } from "@/components/dashboard/grid";
import { WaitingApprovals } from "@/components/dashboard/waiting-approvals";
import { StaleDocs } from "@/components/dashboard/stale-docs";
import { isStale } from "@/lib/docs";
import { canViewCis, canViewDocs } from "@/lib/permissions";
import { ExpiringSoon, type ExpiringRow } from "@/components/dashboard/expiring-soon";

const ROW_SELECT = {
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
  labels: { select: { id: true, name: true, color: true } },
  steps: { select: { doneAt: true } },
} as const;

/**
 * The dashboard.
 *
 * Two fixed pieces — the four counts, and the split between what is on your
 * name and everything else — because a service desk without those is not a
 * dashboard. Everything below them is a widget its owner keeps or hides, in
 * the order they keep it. See `dashboard-widgets`.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const staff = isStaff(user);

  const [metrics, replies, attention, mine, waiting, owned, expiring, layout, settings, t] =
    await Promise.all([
      getDashboard(user),
      getReplyTimes(user),
      prisma.ticket.findMany({
        where: { ...ticketVisibilityFilter(user), status: { is: { settles: false } } },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: 6,
        select: ROW_SELECT,
      }),
      staff
        ? prisma.ticket.findMany({
            where: { assigneeId: user.id },
            orderBy: { updatedAt: "desc" },
            take: 5,
            select: ROW_SELECT,
          })
        : Promise.resolve([] as TicketRowData[]),
      // Rounds still open that this person has not answered. Earliest date
      // first, which puts the overdue ones at the top and the undated at the
      // bottom without a second pass.
      prisma.approval.findMany({
        where: { state: "PENDING", approverId: user.id },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        take: 6,
        select: {
          id: true,
          state: true,
          phase: true,
          question: true,
          dueAt: true,
          ticket: { select: { number: true, reference: true, title: true } },
        },
      }),
      // Pages this person answers for that can go stale at all. Whether one
      // actually has is worked out below: the due date is `reviewedAt` plus a
      // per-page interval, which is arithmetic no `where` clause can do.
      canViewDocs(user)
        ? prisma.doc.findMany({
            where: { ownerId: user.id, archivedAt: null, reviewDays: { gt: 0 } },
            orderBy: { reviewedAt: "asc" },
            select: {
              id: true,
              slug: true,
              title: true,
              reviewDays: true,
              reviewedAt: true,
              createdAt: true,
              space: { select: { key: true, color: true } },
            },
          })
        : Promise.resolve([]),
      // Every DATE attribute of every type, in one pass. Prisma cannot reach
      // inside the JSON blob to compare a date, and asking per type would be a
      // query per type to answer one question — so the fields the register
      // defines are joined to the values the items hold, in SQL.
      //
      // Guarded by the shape check, because the blob is not the schema: a value
      // written before a field was a date would otherwise take the dashboard
      // down with a cast error.
      canViewCis(user)
        ? prisma.$queryRaw<ExpiringRow[]>`
          SELECT i."id", i."name", f."label", i."attributes"->>f."key" AS "value",
                 t."icon", t."color"
          FROM "ConfigurationItem" i
          JOIN "CiType" t ON t."id" = i."typeId"
          JOIN "CiTypeField" f ON f."typeId" = t."id" AND f."kind" = 'DATE'
          WHERE i."lifecycle" <> 'RETIRED'
            AND i."attributes"->>f."key" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            AND (i."attributes"->>f."key")::date
                BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
          ORDER BY (i."attributes"->>f."key")::date ASC, i."name" ASC
          LIMIT 6
        `
        : Promise.resolve([] as ExpiringRow[]),
      prisma.user.findUnique({ where: { id: user.id }, select: { dashboard: true } }),
      getSettings(),
      getMessages(),
    ]);

  const chosen = readWidgets(layout?.dashboard);

  /** Every widget's title, hint and body — only the chosen ones get rendered. */
  const widgets: Record<WidgetId, { title: string; hint?: string; body: React.ReactNode }> = {
    approvals: {
      title: t.dashboard.approvals,
      body: <WaitingApprovals approvals={waiting} />,
    },
    expiring: {
      title: t.dashboard.expiring,
      body: <ExpiringSoon rows={expiring} />,
    },
    docReview: {
      title: t.dashboard.docReview,
      body: <StaleDocs docs={owned.filter((doc) => isStale(doc)).slice(0, 6)} />,
    },
    replyTime: {
      title: t.dashboard.replyTime,
      body: <ReplyTime data={replies} locale={dateLocaleOf(settings)} />,
    },
    categories: {
      title: t.dashboard.categories,
      body: (
        <CategoryArc
          data={metrics.byCategory}
          untagged={metrics.untagged}
          locale={settings.locale}
        />
      ),
    },
    throughput: {
      title: t.dashboard.throughput,
      body: <ThroughputBars data={metrics.throughput} locale={settings.locale} />,
    },
    recent: {
      title: t.dashboard.recent,
      body: <Queue tickets={mine} empty={t.dashboard.recentEmpty} />,
    },
    volume: {
      title: t.dashboard.raisedVsResolved,
      body: <VolumeChart data={metrics.volume} />,
    },
    compliance: {
      title: t.dashboard.responseTargets,
      body: (
        <ComplianceGauge
          pct={metrics.compliance.pct}
          withinTarget={metrics.compliance.withinTarget}
          total={metrics.compliance.total}
          byPriority={metrics.compliance.byPriority}
          medianResolutionHours={metrics.medianResolutionHours}
        />
      ),
    },
    pipeline: {
      title: t.dashboard.pipeline,
      body: <PipelineBar data={metrics.byStatus} />,
    },
    priority: {
      title: t.dashboard.byPriority,
      body: <PriorityBars data={metrics.byPriority} />,
    },
    ageing: {
      title: t.dashboard.ageing,
      body: <AgeingBars data={metrics.ageing} />,
    },
    workload: {
      title: staff ? t.dashboard.workload : t.dashboard.yourQueue,
      body: <WorkloadBars data={metrics.workload} />,
    },
  };

  const names = Object.fromEntries(WIDGETS.map((id) => [id, widgets[id].title])) as Record<
    WidgetId,
    string
  >;

  return (
    <>
      <PageHeader
        eyebrow={staff ? t.dashboard.eyebrow : t.dashboard.yourRequests}
        title={t.dashboard.greeting(user.name.split(" ")[0]!)}
        actions={staff ? <CustomiseDashboard chosen={chosen} names={names} /> : undefined}
      >
        {staff ? t.dashboard.blurb : t.dashboard.yourRequestsBlurb}
      </PageHeader>

      <div className="space-y-4 px-5 py-5 lg:px-6">
        {/* The four that decide what you do next: what is here, what is urgent,
            what has come back to you, and what nobody owns — one strip, read
            left to right. Only the open count has a history worth drawing:
            tickets raised per day over the last fortnight. */}
        <InstrumentStrip
          readouts={[
            {
              label: t.dashboard.open,
              value: metrics.open,
              href: "/tickets?open=1",
              tone: "brand",
              live: true,
              series: metrics.volume.slice(-14).map((day) => day.created),
            },
            {
              label: t.dashboard.highPriority,
              value: metrics.highPriority,
              href: "/tickets?open=1&priority=HIGH",
              tone: "warn",
            },
            {
              label: t.dashboard.waitingOnMe,
              value: metrics.waitingOnMe,
              href: "/tickets?assignee=me&open=1",
            },
            {
              label: t.dashboard.unassigned,
              value: metrics.unassigned,
              href: "/tickets?assignee=none&open=1",
              tone: "warn",
            },
          ]}
        />

        {/* What there is, and what is on fire — the pair an operator reads
            before doing anything. Side by side because they answer the same
            question from two directions. */}
        <div className="grid gap-4 xl:grid-cols-2">
          {staff ? (
            <Card className="overflow-hidden">
              <QueueOverview
                mine={metrics.overviews.mine}
                team={metrics.overviews.team}
                all={metrics.overviews.all}
                unassigned={metrics.overviews.unassigned}
                hasTeam={metrics.hasTeam}
              />
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader
              title={t.dashboard.needsAttention}
              action={
                <Link href="/tickets?open=1" className="text-text-3 hover:text-text text-base">
                  {t.dashboard.seeAll}
                </Link>
              }
            />
            <Queue tickets={attention} empty={t.dashboard.nothingOpen} />
          </Card>
        </div>

        {/* Twelve columns, so a widget can ask for a third, a half or the lot
            and the row still closes. */}
        {/* Where they go and how wide they are is the reader's to drag;
            which of them exist at all is the panel in the page head. */}
        <DashboardGrid
          arrangement={chosen}
          names={names}
          cards={
            Object.fromEntries(
              WIDGETS.map((id) => [
                id,
                <Card key={id} className="h-full overflow-hidden">
                  <CardHeader title={widgets[id].title} />
                  {widgets[id].body}
                </Card>,
              ]),
            ) as Record<WidgetId, React.ReactNode>
          }
        />
      </div>
    </>
  );
}

/** A list of tickets, or the reason there isn't one. */
function Queue({ tickets, empty }: { tickets: TicketRowData[]; empty: string }) {
  if (tickets.length === 0) {
    return (
      <div className="px-5 pb-5">
        <EmptyState title={empty} body="" />
      </div>
    );
  }

  // The same table as the queue page, in a card a third of the width: the
  // container queries drop whatever will not fit, and the headings that are
  // left go with them. TicketTable is also where the column widths come from,
  // so rows outside one would fall back to no widths at all.
  return (
    <TicketTable>
      <TicketColumns className="bg-surface" />
      <ul>
        {/* TicketRow is itself the <li>: wrapping it in another one nests them,
            which is invalid and fails hydration. */}
        {tickets.map((ticket, index) => (
          <TicketRow key={ticket.id} ticket={ticket} index={index} />
        ))}
      </ul>
    </TicketTable>
  );
}
