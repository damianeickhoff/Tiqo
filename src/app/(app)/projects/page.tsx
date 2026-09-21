import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageProjects, isStaff } from "@/lib/permissions";
import { dateLocaleOf, getClock, getMessages, getSettings } from "@/lib/settings";
import { daysUntil } from "@/lib/projects";
import { isOverdue } from "@/lib/tickets";
import { ProjectsTable, type ProjectRow } from "./projects-table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.projects.title };
}

const MILESTONE_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

/**
 * Every project, as a row you can read at a glance.
 *
 * A list of names and ticket counts answers nothing anyone came here to ask.
 * The columns are the questions that matter — how it is going, how far along,
 * what is next, who has it, and when it is due — so the page is a status report
 * rather than an index.
 *
 * One query does the whole page. It selects more per ticket than a count would,
 * because "past target" is a judgement about the desk's clock rather than a
 * column, and asking per project would be a query per row.
 */
export default async function ProjectsPage() {
  const user = await requireUser();
  if (!isStaff(user)) notFound();

  const [projects, clock, settings] = await Promise.all([
    prisma.project.findMany({
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
  ]);

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

  return (
    // The register of projects is one object: one sheet filling the work area.
    <div className="sheet flex min-h-full flex-col">
      <ProjectsTable projects={rows} canCreate={canManageProjects(user)} />
    </div>
  );
}
