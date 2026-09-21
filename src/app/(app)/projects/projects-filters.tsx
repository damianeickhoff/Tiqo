"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { HEALTH_ORDER } from "@/lib/projects";
import { PROJECT_KEYS } from "@/lib/project-views";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type LeadOption = { id: string; label: string };

/**
 * The secondary filters, in the sheet's own header row.
 *
 * Which view you are in is the views column's business; this row is only how
 * the view is narrowed once you are standing in it — the two questions worth a
 * control of their own, and the box that finds a project by its name or its
 * key. In the address rather than in React state, because a view somebody keeps
 * is a query string and a filter the URL does not carry cannot be kept.
 */
export function ProjectsFilters({ leads }: { leads: LeadOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useMessages();

  const value = (name: string) => params.get(name) ?? "";

  /** A filter is a list-level command, so it takes effect the moment it is
   *  picked. Whatever view is being stood in survives it. */
  function setParam(name: string, next: string) {
    const query = new URLSearchParams(params.toString());
    if (next) query.set(name, next);
    else query.delete(name);
    router.push(query.toString() ? `/projects?${query.toString()}` : "/projects");
  }

  const active = PROJECT_KEYS.filter((key) => value(key));

  return (
    <div className="border-line flex min-h-[52px] flex-wrap items-center gap-2 border-b px-4 py-2">
      <Picker
        label={t.projects.health}
        value={value("health")}
        onChange={(next) => setParam("health", next)}
        none={t.projects.anyHealth}
        options={HEALTH_ORDER.map((health) => ({
          id: health,
          label: t.projects.healthNames[health],
        }))}
      />

      <Picker
        label={t.projects.lead}
        value={value("lead")}
        onChange={(next) => setParam("lead", next)}
        none={t.projects.anyLead}
        options={[
          { id: "me", label: t.projects.viewLedByMe },
          { id: "none", label: t.projects.noLead },
          ...leads,
        ]}
      />

      {active.length ? (
        <button
          type="button"
          onClick={() => router.push("/projects")}
          className="text-text-2 hover:text-text flex h-7 items-center gap-1 rounded-full px-2 text-sm font-medium transition-colors"
        >
          <X size={12} strokeWidth={2.5} />
          {t.tickets.clear}
        </button>
      ) : null}

      <form
        className="relative ml-auto"
        onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem("q") as HTMLInputElement;
          setParam("q", input.value.trim());
        }}
      >
        <Search
          size={13}
          className="text-text-3 pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
        />
        <input
          name="q"
          defaultValue={value("q")}
          placeholder={t.projects.searchProjects}
          aria-label={t.projects.searchProjects}
          className="bg-surface-2 placeholder:text-text-3 focus:border-brand rounded-control h-7 w-48 border border-transparent pr-3 pl-7 text-sm transition-[border-color,box-shadow] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none lg:w-56"
        />
      </form>
    </div>
  );
}

/** One question in the row: what it is asking, and what it is answered with.
 *  Its own name is the "any…" option, so the row reads without labels. */
function Picker({
  label,
  value,
  onChange,
  none,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  none: string;
  options: { id: string; label: string }[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "select-chevron bg-surface-2 rounded-control focus:border-brand h-7 max-w-[180px] cursor-pointer appearance-none border border-transparent pr-7 pl-2.5 text-sm transition-[border-color,box-shadow] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none",
        value ? "text-text font-medium" : "text-text-2",
      )}
    >
      <option value="">{none}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
