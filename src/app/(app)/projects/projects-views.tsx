"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Flag, FolderOpen, Layers, Star, UserRound, X } from "lucide-react";
import {
  matchProjectView,
  PROJECT_VIEWS,
  projectViewLabel,
  type ProjectView,
  type ProjectViewCounts,
} from "@/lib/project-views";
import { ViewsColumn, type ViewGroup } from "@/components/shell/views-column";
import { MAX_VIEW_NAME, PROJECT_VIEWS_STORE, useSavedViews } from "@/components/shell/saved-views";
import { Input } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

const ICON: Record<ProjectView["id"], typeof FolderOpen> = {
  active: FolderOpen,
  lead: UserRound,
  offTrack: Flag,
  archived: Layers,
};

/**
 * The list's views column: the four built-in views with live counts, then
 * whatever this browser has kept, then the row that keeps one more.
 */
export function ProjectsViews({ counts }: { counts: ProjectViewCounts }) {
  const t = useMessages();
  const params = useSearchParams();
  const { views: saved, save: keep, forget } = useSavedViews(PROJECT_VIEWS_STORE);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const current = matchProjectView(new URLSearchParams(params.toString()));
  const query = params.toString();

  function save() {
    if (!name.trim()) return;
    keep(name, query);
    setName("");
    setNaming(false);
  }

  const groups: ViewGroup[] = [
    {
      id: "built-in",
      heading: t.projects.views,
      items: PROJECT_VIEWS.map((view) => {
        const Icon = ICON[view.id];
        const search = new URLSearchParams(view.params).toString();
        return {
          id: view.id,
          label: projectViewLabel(view, t),
          icon: <Icon size={14} strokeWidth={2} />,
          count: counts[view.id],
          href: search ? `/projects?${search}` : "/projects",
          active: current?.id === view.id,
        };
      }),
    },
  ];

  if (saved.length) {
    groups.push({
      id: "saved",
      heading: t.projects.savedViews,
      items: saved.map((view) => ({
        id: view.name,
        label: view.name,
        icon: <Star size={14} strokeWidth={2} />,
        href: `/projects?${view.query}`,
        active: !current && view.query === query,
        action: (
          <button
            type="button"
            onClick={() => forget(view.name)}
            aria-label={t.projects.forgetView(view.name)}
            title={t.projects.forgetView(view.name)}
            className="text-text-3 hover:text-negative rounded-full p-1 transition-colors"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        ),
      })),
    });
  }

  return (
    <ViewsColumn
      label={t.projects.views}
      groups={groups}
      save={naming ? undefined : { label: t.projects.saveView, onSelect: () => setNaming(true) }}
    >
      {naming ? (
        <form
          className="mt-1 flex items-center gap-1 max-lg:shrink-0 lg:px-1"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Input
            autoFocus
            value={name}
            maxLength={MAX_VIEW_NAME}
            placeholder={t.projects.viewName}
            aria-label={t.projects.viewName}
            className="h-8 text-sm"
            onChange={(event) => setName(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              setNaming(false);
              setName("");
            }}
            aria-label={t.common.cancel}
            className="text-text-3 hover:text-text rounded-control shrink-0 p-1 transition-colors"
          >
            <X size={14} />
          </button>
        </form>
      ) : null}
    </ViewsColumn>
  );
}
