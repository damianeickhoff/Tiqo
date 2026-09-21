import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageProjects, isStaff } from "@/lib/permissions";
import { dateLocaleOf, getClock, getMessages, getSettings } from "@/lib/settings";
import { daysUntil } from "@/lib/projects";
import { matchProjectView, projectViewLabel, type ProjectViewCounts } from "@/lib/project-views";
import { isOverdue } from "@/lib/tickets";
import { PageHeader } from "@/components/shell/page-header";
import { ProjectsFilters } from "./projects-filters";
import { ProjectsTable, type ProjectRow } from "./projects-table";
import { ProjectsViews } from "./projects-views";
import { NewProjectButton } from "./new-project-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.projects.title };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

const MILESTONE_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

/**
 * Every project, as a row you can read at a glance.
 *
 * A list of names and ticket counts answers nothing anyone came here to ask.
 * The columns are the questions that matter — how it is going, how far along,
 * what is next, who has it, and when it is due — so the page is a status report
 * rather than an index.
 *
 * The shape is the queue's, because an overview page is an overview page: the
 * head and the views column on the ground, the table alone in a sheet beside
 * them. Which projects are in it is in the address rather than in the browser,
 * which is what lets a view be kept and what makes the counts beside the views
 * mean something.
 *
 * One query does the rows. It selects more per ticket than a count would,
 * because "past target" is a judgement about the desk's clock rather than a
 * column, and asking per project would be a query per row.
 */
export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!isStaff(user)) notFound();

  const params = await searchParams;
  const archived = one(params.archived) === "1";
  const health = one(params.health);
  const lead = one(params.lead);
  const q = one(params.q);

  // Archived is a place you go rather than a state you happen to be showing:
  // every other view is the live estate, which is what somebody opening this
  // page came to see.
  const where: Prisma.ProjectWhereInput = {
    isArchived: archived,
    ...(health ? { health: health as Prisma.ProjectWhereInput["health"] } : {}),
    ...(lead === "me"
      ? { leadId: user.id }
      : lead === "none"
        ? { leadId: null }
        : lead
          ? { leadId: lead }
          : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { key: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [projects, clock, settings, leads, counts] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: [{ isArchived: "asc" }, { key: "asc" }],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        color: true,
        health: true,
        dueOn: true,
        isArchived: true,
        lead: { select: { name: true, avatarVariant: true } },
        stars: { where: { userId: user.id }, select: { projectId: true } },
        milestones: {
          orderBy: { position: "asc" },
          select: { id: true, title: true, reachedAt: true, dueOn: true },
        },
        tickets: {
          select: {
            priority: true,
            type: true,
            createdAt: true,
            resolvedAt: true,
            closedAt: true,
            pausedMinutes: true,
            pausedSince: true,
            status: {
              select: { id: true, name: true, color: true, settles: true, pausesClock: true },
            },
          },
        },
      },
    }),
    getClock(),
    getSettings(),
    // Only the people who actually lead something: a picker offering every
    // operator is a list of names that mostly match nothing.
    prisma.user.findMany({
      where: { projectsLed: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    /* What each built-in view holds right now, so the column can say so. The
       same conditions the views themselves set, asked as counts: a column of
       views whose numbers came from anywhere else would be a column that lies
       the moment a view changes shape. */
    Promise.all([
      prisma.project.count({ where: { isArchived: false } }),
      prisma.project.count({ where: { isArchived: false, leadId: user.id } }),
      prisma.project.count({ where: { isArchived: false, health: "OFF_TRACK" } }),
      prisma.project.count({ where: { isArchived: true } }),
    ]).then(([active, byMe, offTrack, put]): ProjectViewCounts => ({
      active,
      lead: byMe,
      offTrack,
      archived: put,
    })),
  ]);

  const t = await getMessages();
  const milestoneDate = new Intl.DateTimeFormat(dateLocaleOf(settings), MILESTONE_DATE);

  const rows: ProjectRow[] = projects.map((project) => {
    // The first point still to be reached, in the order the project put them
    // in — which is what "next" means on a track, not the nearest date.
    const next = project.milestones.find((milestone) => !milestone.reachedAt) ?? null;

    return {
      id: project.id,
      key: project.key,
      name: project.name,
      description: project.description ?? "",
      color: project.color,
      health: project.health,
      isArchived: project.isArchived,
      starred: project.stars.length > 0,
      settled: project.tickets.filter((ticket) => ticket.status?.settles).length,
      total: project.tickets.length,
      late: project.tickets.filter((ticket) => isOverdue(ticket, clock)).length,
      reached: project.milestones.filter((milestone) => milestone.reachedAt).length,
      milestones: project.milestones.length,
      next: next
        ? { title: next.title, dueOn: next.dueOn ? milestoneDate.format(next.dueOn) : null }
        : null,
      lead: project.lead,
      dueIn: project.dueOn ? daysUntil(project.dueOn) : null,
    };
  });

  /** What is being looked at, for the line under the title. Worked out here
   *  rather than in the head, because the page already knows the address. */
  const current = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = one(value);
    if (first) current.set(key, first);
  }
  const viewName = projectViewLabel(matchProjectView(current), t);

  return (
    // The same frame as the queue: the page is exactly the height of the work
    // area, the head and the views stay on the ground, and the sheet is the
    // table and nothing else. Only from `lg` — below it the whole desk is one
    // scrolling column and the list is a part of it.
    <div className="flex flex-col lg:h-[calc(100dvh-var(--bar))] lg:min-h-0">
      <PageHeader
        title={t.projects.title}
        showBlurb
        actions={canManageProjects(user) ? <NewProjectButton /> : undefined}
      >
        <span className="tnum font-mono text-xs">{`${viewName} · ${rows.length}`}</span>
      </PageHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-2 pb-5 lg:flex-row lg:gap-5 lg:pr-5">
        <Suspense fallback={<div className="lg:w-[200px]" />}>
          <ProjectsViews counts={counts} />
        </Suspense>

        <div className="sheet mx-3 flex min-w-0 flex-col overflow-hidden lg:mx-0 lg:min-h-0 lg:flex-1">
          <Suspense fallback={<div className="h-[52px]" />}>
            <ProjectsFilters
              leads={leads.map((person) => ({ id: person.id, label: person.name }))}
            />
          </Suspense>

          <div className="min-w-0 lg:min-h-0 lg:flex-1 lg:overflow-auto">
            <ProjectsTable projects={rows} />
          </div>

          {/* Inside the sheet but outside the scroller, like the queue's: a
              footer that scrolled away with the rows would be one nobody
              finds. */}
          <p className="border-line text-text-3 shrink-0 border-t px-4 py-2 text-sm">
            {t.projects.listFooter(rows.length)}
          </p>
        </div>
      </div>
    </div>
  );
}
