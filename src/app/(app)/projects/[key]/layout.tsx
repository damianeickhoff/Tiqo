import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ProjectMenu, ProjectStarButton } from "@/components/projects/project-menu";
import { canManageProjects, isStaff } from "@/lib/permissions";
import { getMessages, getSettings, dateLocaleOf } from "@/lib/settings";
import { HEALTH_META, daysUntil } from "@/lib/projects";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { HealthPicker } from "@/components/projects/health-picker";
import { countPeopleOnProject } from "@/lib/project-people";
import { Avatar } from "@/components/avatar";
import { buttonClass } from "@/components/ui";

type Params = Promise<{ key: string }>;

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

/**
 * Everything a project page shares: who it is, how it is going, and the way
 * between its views.
 *
 * The header is a layout rather than a piece each page repeats, so switching
 * from the board to the milestones does not redraw the identity of the thing
 * you are looking at.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const user = await requireUser();
  if (!isStaff(user)) notFound();

  const { key } = await params;
  const [project, t, settings] = await Promise.all([
    prisma.project.findUnique({
      where: { key: key.toUpperCase() },
      select: {
        id: true,
        key: true,
        name: true,
        color: true,
        health: true,
        startsOn: true,
        dueOn: true,
        isArchived: true,
        lead: { select: { id: true, name: true, avatarVariant: true } },
        _count: {
          select: {
            tickets: { where: { status: { is: { settles: false } } } },
            milestones: true,
          },
        },
        stars: { where: { userId: user.id }, select: { projectId: true } },
      },
    }),
    getMessages(),
    getSettings(),
  ]);

  if (!project) notFound();

  // Counted the same way the People tab lists them, so the number on the tab
  // and the names behind it are always the same answer.
  const peopleCount = await countPeopleOnProject(project.id);

  const admin = canManageProjects(user);
  const health = HEALTH_META[project.health];
  const left = project.dueOn ? daysUntil(project.dueOn) : null;
  const day = new Intl.DateTimeFormat(dateLocaleOf(settings), DAY);

  return (
    <>
      {/*
       * Identity and tabs together, and from xl up they stick as one block of
       * exactly `--project-head`.
       *
       * That is what lets the rail on the overview be pinned and fully visible:
       * a sticky element still starts where it sits in the flow, so anything
       * above it that scrolls away pushes its bottom below the fold by its own
       * height until you have scrolled that far. With the head pinned, the
       * rail's box starts exactly where it pins and never overhangs.
       */}
      <div className="bg-surface z-30 xl:sticky xl:top-0 xl:h-[var(--project-head)]">
        {/* Its own stacking context, above the page. Without it the health menu
            opened behind the first card on the overview — later siblings paint
            on top, and the menu belongs to an earlier one. */}
        <div className="relative z-30 px-5 pt-5 pb-4 lg:px-6">
          <div className="flex flex-wrap items-center gap-4">
            <span
              aria-hidden
              className="rounded-control flex size-11 shrink-0 items-center justify-center font-mono text-sm font-semibold text-white"
              style={{ background: project.color }}
            >
              {project.key}
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="text-xl leading-tight font-semibold tracking-[-0.02em]">
                {project.name}
              </h1>

              <div className="text-text-3 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {project.lead ? (
                  <span className="inline-flex items-center gap-1.5">
                    {t.projects.lead}
                    <Avatar
                      name={project.lead.name}
                      variant={project.lead.avatarVariant}
                      size={16}
                    />
                    <span className="text-text-2 font-medium">{project.lead.name}</span>
                  </span>
                ) : (
                  <span>{t.projects.noLead}</span>
                )}

                {project.startsOn || project.dueOn ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="font-mono text-xs">
                      {project.startsOn ? day.format(project.startsOn) : "…"}
                      {" → "}
                      {project.dueOn ? day.format(project.dueOn) : "…"}
                    </span>
                  </>
                ) : null}

                {left !== null && left < 0 && !project.isArchived ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="text-negative font-medium">{t.projects.overdueBy(-left)}</span>
                  </>
                ) : null}

                {project.isArchived ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="bg-surface-3 rounded-full px-2 py-0.5 text-xs font-medium">
                      {t.projects.archived}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <ProjectStarButton projectId={project.id} starred={project.stars.length > 0} />
              {/* The one thing on this header anyone changes from any of its
                pages: how it is going. Everything else about a project is
                edited on the overview, where there is room to explain it. */}
              {admin ? (
                <HealthPicker projectId={project.id} health={project.health} />
              ) : (
                <span
                  className="bg-surface inline-flex h-8 items-center gap-2 rounded-full border border-transparent px-2.5 text-sm font-medium shadow-[var(--highlight)]"
                  style={{ color: health.color }}
                >
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: health.color }}
                  />
                  <span className="text-text">{t.projects.healthNames[project.health]}</span>
                </span>
              )}
              <Link href="/tickets/new" className={buttonClass("primary", "sm")}>
                <Plus size={14} strokeWidth={2.5} />
                {t.nav.newTicket}
              </Link>
              {admin ? (
                <ProjectMenu
                  projectId={project.id}
                  name={project.name}
                  isArchived={project.isArchived}
                />
              ) : null}
            </div>
          </div>
        </div>

        {/* Below xl there is no rail, so the tabs stick on their own the way a
            ticket's toolbar does. From xl up the block above carries them. */}
        <div className="bg-surface/90 sticky top-[var(--bar)] z-30 flex h-[var(--toolbar)] items-end px-5 backdrop-blur-md lg:top-0 lg:px-6 xl:static">
          <ProjectTabs
            projectKey={project.key}
            counts={{
              work: project._count.tickets,
              milestones: project._count.milestones,
              people: peopleCount,
            }}
          />
        </div>
      </div>

      {children}
    </>
  );
}
