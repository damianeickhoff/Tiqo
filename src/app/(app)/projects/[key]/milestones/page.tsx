import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageProjects, isStaff } from "@/lib/permissions";
import { dateLocaleOf, getClock, getMessages, getSettings } from "@/lib/settings";
import { isOverdue } from "@/lib/tickets";
import { MilestoneManager } from "@/components/projects/milestone-manager";
import { MilestoneTrack } from "@/components/projects/milestone-track";
import { PanelCard } from "@/components/tickets/panel-card";

type Params = Promise<{ key: string }>;

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [project, t] = await Promise.all([
    prisma.project.findUnique({
      where: { key: (await params).key.toUpperCase() },
      select: { name: true },
    }),
    getMessages(),
  ]);
  return { title: `${t.projects.milestones} · ${project?.name ?? ""}` };
}

export default async function ProjectMilestonesPage({ params }: { params: Params }) {
  const user = await requireUser();
  if (!isStaff(user)) notFound();

  const { key } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    select: { id: true, key: true },
  });
  if (!project) notFound();

  const [milestones, clock, settings, t] = await Promise.all([
    prisma.milestone.findMany({
      where: { projectId: project.id },
      orderBy: { position: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        dueOn: true,
        reachedAt: true,
        // Enough of each ticket to ask the desk's clock whether it is late —
        // "4 of 9, one past target" is the line that makes anyone act.
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
    getMessages(),
  ]);

  const rows = milestones.map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    description: milestone.description,
    dueOn: milestone.dueOn,
    reachedAt: milestone.reachedAt,
    total: milestone.tickets.length,
    done: milestone.tickets.filter((row) => row.status?.settles).length,
    late: milestone.tickets.filter((row) => isOverdue(row, clock)).length,
  }));

  const day = new Intl.DateTimeFormat(dateLocaleOf(settings), DAY);
  const reached = rows.filter((row) => row.reachedAt).length;

  return (
    <div className="grid gap-6 px-5 py-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <MilestoneManager
          projectId={project.id}
          canEdit={canManageProjects(user)}
          milestones={rows}
        />
      </div>

      {rows.length > 0 ? (
        <div className="flex flex-col gap-4">
          <PanelCard
            title={t.projects.milestoneTrack}
            action={
              <span className="text-text-3 tnum font-mono text-xs">
                {t.projects.reachedOfTotal(reached, rows.length)}
              </span>
            }
            bodyClassName="px-4 pt-1 pb-4"
          >
            <MilestoneTrack milestones={rows} day={day} t={t} orientation="vertical" />
          </PanelCard>

          <p className="text-text-3 px-1 text-sm leading-relaxed">{t.projects.trackBlurb}</p>
        </div>
      ) : null}
    </div>
  );
}
