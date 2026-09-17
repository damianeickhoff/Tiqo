import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can, canManageProjects, isStaff } from "@/lib/permissions";
import { getClock, getMessages, getSettings, dateLocaleOf } from "@/lib/settings";
import { isOverdue } from "@/lib/tickets";
import { progressOf } from "@/lib/projects";
import { peopleOnProject } from "@/lib/project-people";
import { Avatar } from "@/components/avatar";
import { PersonLink } from "@/components/person-link";
import { TicketRow } from "@/components/tickets/ticket-row";
import { TicketTable } from "@/components/tickets/ticket-table";
import { ProjectBrief } from "@/components/projects/project-brief";
import { ProjectAbout } from "@/components/projects/project-about";
import { ProjectConversation } from "@/components/projects/project-conversation";
import { MilestoneTrack } from "@/components/projects/milestone-track";
import { PanelCard } from "@/components/tickets/panel-card";
import { RailActivity } from "@/components/tickets/activity";
import type { TimelineEvent } from "@/components/tickets/activity";
import { cn } from "@/lib/utils";

type Params = Promise<{ key: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const project = await prisma.project.findUnique({
    where: { key: (await params).key.toUpperCase() },
    select: { name: true },
  });
  return { title: project?.name ?? "" };
}

const OPEN_WORK = 5;

/** The rail shows the latest few; the conversation beside it has them all. */
const ACTIVITY_PREVIEW = 5;

/**
 * What is happening, for someone opening the project cold.
 *
 * A page of numbers is not an overview. The order here is the order the
 * questions come in: what is this, what is it working towards, what is open
 * right now, and what has moved lately — with the numbers in a column beside.
 */
export default async function ProjectOverview({ params }: { params: Params }) {
  const user = await requireUser();
  if (!isStaff(user)) notFound();

  const { key } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      isArchived: true,
      startsOn: true,
      dueOn: true,
      teamId: true,
      team: { select: { name: true } },
      leadId: true,
      lead: { select: { id: true, name: true, avatarVariant: true } },
      members: { select: { id: true, name: true, avatarVariant: true, jobTitle: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { id: true, name: true, avatarVariant: true } },
        },
      },
    },
  });
  if (!project) notFound();

  const [tickets, openWork, milestones, activities, roster, clock, t, settings] = await Promise.all(
    [
      prisma.ticket.findMany({
        where: { projectId: project.id },
        select: {
          id: true,
          priority: true,
          type: true,
          createdAt: true,
          resolvedAt: true,
          closedAt: true,
          pausedMinutes: true,
          pausedSince: true,
          assigneeId: true,
          status: {
            select: { id: true, name: true, color: true, settles: true, pausesClock: true },
          },
        },
      }),
      // The hottest open rows, drawn the way the queue draws them.
      prisma.ticket.findMany({
        where: { projectId: project.id, status: { is: { settles: false } } },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: OPEN_WORK,
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
          labels: { select: { id: true, name: true, color: true } },
          steps: { select: { doneAt: true } },
        },
      }),
      prisma.milestone.findMany({
        where: { projectId: project.id },
        orderBy: [{ position: "asc" }],
        select: {
          id: true,
          title: true,
          dueOn: true,
          reachedAt: true,
          _count: { select: { tickets: true } },
          tickets: { select: { status: { select: { settles: true } } } },
        },
      }),
      prisma.activity.findMany({
        where: {
          OR: [
            {
              ticket: { projectId: project.id },
              // The incoming half of a reference is dropped from the digest. When
              // a ticket in this project is named from inside this project, both
              // ends land in this one feed and read as the same act said twice;
              // when it is named from outside, that belongs to the other item's
              // story. Either way the ticket's own page still carries it.
              NOT: { type: "REFERENCED", newValue: null },
            },
            // Kept on the project itself: something elsewhere pointing at this
            // project is news here and appears nowhere else in the feed.
            { projectId: project.id },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          type: true,
          field: true,
          oldValue: true,
          newValue: true,
          link: true,
          createdAt: true,
          actor: { select: { id: true, name: true, avatarVariant: true } },
        },
      }),
      canManageProjects(user)
        ? prisma.user.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true, avatarVariant: true, email: true },
          })
        : Promise.resolve([]),
      getClock(),
      getMessages(),
      getSettings(),
    ],
  );

  const settled = tickets.filter((ticket) => ticket.status?.settles).length;
  const open = tickets.length - settled;
  const progress = progressOf(settled, tickets.length);
  const late = tickets.filter((ticket) => isOverdue(ticket, clock)).length;
  const unassigned = tickets.filter(
    (ticket) => !ticket.assigneeId && !ticket.status?.settles,
  ).length;

  // The same list the People tab shows, worked out in one place so the two
  // can never disagree about who is on this.
  const people = await peopleOnProject(project.id, project.leadId);

  const day = new Intl.DateTimeFormat(dateLocaleOf(settings), { day: "numeric", month: "short" });
  // Shaped for the shared track, so the overview and the milestones page draw
  // the same points from the same component.
  const trackPoints = milestones.map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    dueOn: milestone.dueOn,
    reachedAt: milestone.reachedAt,
    total: milestone._count.tickets,
    done: milestone.tickets.filter((row) => row.status?.settles).length,
  }));
  const timeline: TimelineEvent[] = activities;
  const admin = canManageProjects(user);

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5 px-5 py-5 lg:px-6">
        {/* What it is, in whatever detail the lead wrote. Above the numbers,
            because someone opening a project cold needs the sentence before the
            statistics — and edited here, where it is read. */}
        <ProjectAbout projectId={project.id} description={project.description} canEdit={admin} />

        {milestones.length > 0 ? (
          <section className="card px-5 pt-4 pb-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-semibold">{t.projects.milestones}</p>
              <Link
                href={`/projects/${project.key}/milestones`}
                className="text-text-2 hover:text-text inline-flex items-center gap-1 text-sm font-medium transition-colors"
              >
                {t.common.edit}
                <ArrowRight size={13} />
              </Link>
            </div>

            {/* A track rather than a list: the dated points in order, the
                reached ones filled, the next one ringed. */}
            <MilestoneTrack milestones={trackPoints} day={day} t={t} />
          </section>
        ) : null}

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <p className="text-base font-semibold">{t.projects.openWork}</p>
            <Link
              href={`/projects/${project.key}/tickets`}
              className="text-text-2 hover:text-text inline-flex items-center gap-1 text-sm font-medium transition-colors"
            >
              {t.projects.allWork}
              <ArrowRight size={13} />
            </Link>
          </div>
          {openWork.length === 0 ? (
            <p className="text-text-3 px-4 py-6 text-center text-base">{t.projects.nothingFiled}</p>
          ) : (
            <TicketTable>
              <ul>
                {openWork.map((ticket, i) => (
                  <TicketRow key={ticket.id} ticket={ticket} index={i} />
                ))}
              </ul>
            </TicketTable>
          )}
        </section>

        <ProjectConversation
          projectId={project.id}
          comments={project.comments}
          events={timeline}
          viewerId={user.id}
          viewerName={user.name}
          viewerAvatar={user.avatarVariant}
          canModerate={admin}
          canRemoveActivity={can(user, "activity.delete")}
          locale={settings.locale}
        />
      </div>

      {/* The rail, the same object as a ticket's: contained cards on the chrome
          tint, each with the same header, scrolling under the tabs on its own. */}
      <aside className="bg-chrome rail-scroll flex flex-col gap-3 p-3 xl:sticky xl:top-[var(--project-head)] xl:h-[calc(100dvh-var(--bar)-var(--project-head))] xl:overflow-y-auto xl:overscroll-contain xl:pr-0.5">
        {/* How far along, and what is in the way: one figure, one bar with
            three colours in it. */}
        <PanelCard
          title={t.projects.progress}
          action={
            <span className="text-text-3 tnum font-mono text-xs">
              {t.projects.settledOf(progress.settled, progress.total)}
            </span>
          }
          bodyClassName="px-3.5 pt-3 pb-3.5"
        >
          <p className="tnum flex items-baseline gap-2 text-2xl leading-none font-semibold tracking-[-0.03em]">
            {progress.pct}%
            <span className="text-text-3 text-sm font-normal tracking-normal">
              · {open} {t.projects.openWork.toLowerCase()}
              {late > 0 ? ` · ${late} ${t.projects.overdueWork.toLowerCase()}` : ""}
            </span>
          </p>
          <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
            <span
              className="bg-brand"
              style={{ width: `${tickets.length ? (settled / tickets.length) * 100 : 0}%` }}
            />
            <span
              className="bg-p-high"
              style={{ width: `${tickets.length ? (late / tickets.length) * 100 : 0}%` }}
            />
            <span className="bg-surface-3 flex-1" />
          </div>
          <dl className="text-text-3 mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Legend swatch="bg-brand" label={t.projects.settledWork} />
            <Legend swatch="bg-p-high" label={t.projects.overdueWork} />
            <Legend swatch="bg-surface-3" label={t.projects.openWork} />
            {unassigned > 0 ? (
              <span className="ml-auto">
                {unassigned} {t.projects.unassignedWork.toLowerCase()}
              </span>
            ) : null}
          </dl>
        </PanelCard>

        <ProjectBrief
          project={{
            id: project.id,
            name: project.name,
            startsOn: project.startsOn,
            dueOn: project.dueOn,
            isArchived: project.isArchived,
            leadId: project.leadId,
            lead: project.lead,
          }}
          members={project.members}
          roster={roster}
          canEdit={admin}
        />

        <PanelCard
          title={t.projects.people}
          action={
            <Link
              href={`/projects/${project.key}/people`}
              className="text-brand-deep text-xs font-medium transition-colors hover:underline"
            >
              {t.projects.members}
            </Link>
          }
          bodyClassName="px-3.5 pb-1"
        >
          <ul className="divide-line divide-y">
            {people.slice(0, 6).map((person) => (
              <li key={person.id} className="flex items-center gap-2.5 py-2 text-sm">
                <Avatar name={person.name} variant={person.avatarVariant} size={24} />
                <span className="min-w-0 flex-1 leading-tight">
                  <PersonLink
                    id={person.id}
                    name={person.name}
                    className="block truncate font-medium"
                  />
                  <span className="text-text-3 block truncate text-xs">
                    {person.id === project.leadId
                      ? t.projects.lead
                      : (person.jobTitle ?? t.projects.members)}
                  </span>
                </span>
                <span className="text-text-3 font-mono text-xs">
                  {person.open} {t.projects.openWork.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
          {people.length === 0 ? (
            <p className="text-text-3 py-3 text-sm">{t.projects.nobodyOnIt}</p>
          ) : null}
        </PanelCard>

        {/* What has happened lately, in the column that answers "and then?" —
            the conversation beside it is where people talk, this is what the
            desk did. */}
        <PanelCard title={t.projects.recentActivity}>
          <RailActivity
            events={timeline.slice(0, ACTIVITY_PREVIEW)}
            locale={settings.locale}
            dateLocale={dateLocaleOf(settings)}
            canRemove={can(user, "activity.delete")}
          />
        </PanelCard>
      </aside>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2 rounded-[2px]", swatch)} />
      {label}
    </span>
  );
}
