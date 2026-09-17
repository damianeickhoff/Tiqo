"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Star } from "lucide-react";
import type { ProjectHealth } from "@/generated/prisma/enums";
import { HEALTH_META } from "@/lib/projects";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";
import { NewProjectButton } from "./new-project-button";
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

type Segment = "active" | "archived" | "all";

/**
 * Every project as one row.
 *
 * The columns are the four questions the page exists to answer — how it is
 * going, how far along, who has it, and when it is due — so the list is a
 * status report rather than an index. It was a stack of cards, which showed the
 * same facts but let no two projects be compared without scrolling between them.
 *
 * Filtered here rather than on the server: a desk has tens of projects, not
 * thousands, and a box that answers on the keystroke is worth more than the
 * round trip it saves.
 */
export function ProjectsTable({
  projects,
  canCreate,
}: {
  projects: ProjectRow[];
  canCreate: boolean;
}) {
  const t = useMessages();
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("active");

  const active = projects.filter((project) => !project.isArchived).length;

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      if (segment === "active" && project.isArchived) return false;
      if (segment === "archived" && !project.isArchived) return false;
      if (!needle) return true;
      return (
        project.name.toLowerCase().includes(needle) || project.key.toLowerCase().includes(needle)
      );
    });
  }, [projects, query, segment]);

  const SEGMENTS: { id: Segment; label: string }[] = [
    { id: "active", label: t.projects.filterActive },
    { id: "archived", label: t.projects.archived },
    { id: "all", label: t.projects.filterAll },
  ];

  return (
    <>
      <PageHeader
        title={t.projects.title}
        showBlurb
        actions={
          <>
            <label className="relative hidden sm:block">
              <Search
                size={14}
                aria-hidden
                className="text-text-3 pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.projects.searchProjects}
                aria-label={t.projects.searchProjects}
                className="bg-surface rounded-control focus:border-brand h-8 w-[220px] border border-transparent pr-2.5 pl-8 text-base shadow-[var(--highlight)] transition-[border-color] placeholder:text-[var(--text-3)] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none"
              />
            </label>

            <div
              role="group"
              aria-label={t.projects.title}
              className="bg-surface-2 flex items-center gap-0.5 rounded-full p-0.5"
            >
              {SEGMENTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-current={segment === option.id}
                  onClick={() => setSegment(option.id)}
                  className={cn(
                    "h-7 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow]",
                    segment === option.id
                      ? "text-text bg-[var(--seg-on)] shadow-[0_1px_2px_rgba(9,9,11,0.1),0_0_0_1px_rgba(9,9,11,0.04)]"
                      : "text-text-2 hover:text-text",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {canCreate ? <NewProjectButton /> : null}
          </>
        }
      >
        <span className="tnum font-mono">
          {t.projects.activeArchived(active, projects.length - active)}
        </span>
      </PageHeader>

      {shown.length === 0 ? (
        <div className="px-5 py-6 lg:px-8">
          <EmptyState title={t.projects.noneMatch} body={t.projects.blurbLong} />
        </div>
      ) : (
        <>
          <Columns />
          <ul>
            {shown.map((project) => (
              <Row key={project.id} project={project} />
            ))}
          </ul>
          <p className="text-text-3 px-5 py-4 text-base lg:px-8">
            {t.projects.listFooter(shown.length)}
          </p>
        </>
      )}
    </>
  );
}

/**
 * The grid every row and the header above it share, so a column heading cannot
 * drift away from the column it names.
 */
const GRID =
  "grid grid-cols-[32px_minmax(0,1fr)] items-center gap-4 px-5 lg:px-8 " +
  "xl:grid-cols-[32px_minmax(0,1fr)_130px_190px_200px_150px_88px]";

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
