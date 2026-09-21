"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import type { ProjectHealth } from "@/generated/prisma/enums";
import { HEALTH_META } from "@/lib/projects";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type ProjectRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  color: string;
  health: ProjectHealth;
  isArchived: boolean;
  starred: boolean;
  settled: number;
  total: number;
  /// Open tickets past their response target. Worked out on the server, where
  /// the desk's clock is.
  late: number;
  reached: number;
  milestones: number;
  /// The first milestone still to be reached, or null when there are none left.
  next: { title: string; dueOn: string | null } | null;
  lead: { name: string; avatarVariant: number } | null;
  /// Days until the project is due, negative once past. Null with no date.
  dueIn: number | null;
};

/**
 * Every project as one row.
 *
 * The columns are the four questions the page exists to answer — how it is
 * going, how far along, who has it, and when it is due — so the list is a
 * status report rather than an index. It was a stack of cards, which showed the
 * same facts but let no two projects be compared without scrolling between them.
 *
 * Which projects these are is settled before they arrive: the view standing in
 * the views column and the filters in the sheet's header row are both in the
 * address, and the page answers it.
 */
export function ProjectsTable({ projects }: { projects: ProjectRow[] }) {
  const t = useMessages();

  if (projects.length === 0) {
    return (
      <div className="px-5 py-6 lg:px-6">
        <EmptyState title={t.projects.noneMatch} body={t.projects.blurbLong} />
      </div>
    );
  }

  return (
    <>
      <Columns />
      <ul>
        {projects.map((project) => (
          <Row key={project.id} project={project} />
        ))}
      </ul>
    </>
  );
}

/**
 * The grid every row and the header above it share, so a column heading cannot
 * drift away from the column it names.
 *
 * The five facts on the right are narrower than they were: the views column
 * takes 200px off this table, and the name is the column that was paying for
 * it. A floor under the name rather than a share of what is left, so a desk
 * with long project names pushes the table sideways — the queue's answer —
 * instead of quietly clipping every title to nothing.
 */
const GRID =
  "grid grid-cols-[32px_minmax(0,1fr)] items-center gap-3 px-5 lg:px-6 " +
  "xl:grid-cols-[32px_minmax(160px,1fr)_110px_148px_168px_118px_60px]";

function Columns() {
  const t = useMessages();
  return (
    <div
      aria-hidden
      className={cn(
        GRID,
        "label border-line bg-surface sticky top-0 z-10 hidden h-9 border-b xl:grid",
      )}
    >
      <span />
      <span className="truncate">{t.projects.colProject}</span>
      <span className="truncate">{t.projects.health}</span>
      <span className="truncate">{t.projects.colSettled}</span>
      <span className="truncate">{t.projects.nextMilestone}</span>
      <span className="truncate">{t.projects.lead}</span>
      <span className="truncate text-right">{t.projects.due}</span>
    </div>
  );
}

function Row({ project }: { project: ProjectRow }) {
  const t = useMessages();
  const health = HEALTH_META[project.health];
  const pct = project.total === 0 ? 0 : Math.round((project.settled / project.total) * 100);
  const offTrack = project.health === "OFF_TRACK";

  return (
    <li className="border-line border-b">
      <Link
        href={`/projects/${project.key}`}
        className={cn(
          GRID,
          "hover:bg-surface-2 min-h-[60px] py-2.5 transition-[background-color] duration-100",
          // Archived last and faint: still findable, never in the way.
          project.isArchived && "opacity-55",
        )}
      >
        <span
          aria-hidden
          className="rounded-control flex size-8 shrink-0 items-center justify-center font-mono text-xs font-bold"
          style={{
            background: `color-mix(in oklab, ${project.color} 16%, transparent)`,
            color: project.color,
          }}
        >
          {project.key}
        </span>

        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-md truncate font-semibold">{project.name}</span>
            {project.starred ? (
              <Star size={12} className="fill-brand text-brand shrink-0" aria-hidden />
            ) : null}
            {project.isArchived ? (
              <span className="tag shrink-0">{t.projects.archived}</span>
            ) : null}
          </span>
          <span className="text-text-3 mt-0.5 block truncate text-sm">
            {project.description || t.projects.blurb}
          </span>
        </span>

        <span className="text-text-2 hidden min-w-0 flex-col gap-0.5 text-base xl:flex">
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{
                background: health.color,
                boxShadow: offTrack ? `0 0 6px ${health.color}` : undefined,
              }}
            />
            <span className="truncate">{t.projects.healthNames[project.health]}</span>
          </span>
          {project.late > 0 ? (
            <span className="text-negative text-sm">
              {t.projects.pastTargetCount(project.late)}
            </span>
          ) : null}
        </span>

        <span className="hidden items-center gap-2.5 xl:flex">
          <span className="bg-surface-3 block h-1 w-[100px] overflow-hidden rounded-full">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: offTrack ? "var(--negative)" : "var(--brand)",
              }}
            />
          </span>
          <span className="text-text-3 tnum font-mono text-sm whitespace-nowrap">
            {project.settled}/{project.total}
          </span>
        </span>

        <span className="hidden min-w-0 flex-col xl:flex">
          <span className={cn("truncate text-base", project.next ? "text-text-2" : "text-text-3")}>
            {project.next ? project.next.title : t.projects.allReached}
          </span>
          <span className="text-text-3 tnum font-mono text-sm">
            {project.next?.dueOn ? `${project.next.dueOn} · ` : ""}
            {t.projects.reachedOf(project.reached, project.milestones)}
          </span>
        </span>

        <span className="text-text-2 hidden min-w-0 items-center gap-2 text-base xl:flex">
          {project.lead ? (
            <>
              <Avatar
                name={project.lead.name}
                variant={project.lead.avatarVariant}
                size={20}
                className="shrink-0"
              />
              <span className="truncate">{project.lead.name}</span>
            </>
          ) : (
            <span className="text-text-3 truncate">{t.projects.noLead}</span>
          )}
        </span>

        <span
          className="tnum hidden text-right font-mono text-sm xl:block"
          style={{
            color:
              project.dueIn === null
                ? "var(--text-3)"
                : project.dueIn < 0
                  ? "var(--negative)"
                  : project.dueIn === 0
                    ? "var(--brand-deep)"
                    : "var(--text-3)",
          }}
        >
          {project.dueIn === null
            ? "—"
            : project.dueIn < 0
              ? t.projects.overdueBy(-project.dueIn)
              : project.dueIn === 0
                ? t.projects.dueToday
                : t.projects.dueIn(project.dueIn)}
        </span>
      </Link>
    </li>
  );
}
