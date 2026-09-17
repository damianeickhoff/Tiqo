"use client";

import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CornerDownLeft, Search, X } from "lucide-react";
import { CI_LIFECYCLES } from "@/lib/cmdb";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type CiFilterOption = { id: string; label: string };

/**
 * Every key the register understands, so Clear leaves nothing behind. The type
 * is not among them: it is the sidebar, and clearing the filters should not move
 * you out of the kind of thing you were looking at.
 */
const KEYS = ["life", "team", "q", "page"] as const;

/** The queue's chip-shaped select, so the two lists read as one product. */
const CHIP_SELECT =
  "select-chevron h-8 cursor-pointer appearance-none rounded-full border border-line bg-surface " +
  "pr-7 pl-2.5 text-sm font-medium text-text-2 shadow-[var(--highlight)] " +
  "transition-[border-color,color] hover:border-line-strong hover:text-text " +
  "focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-[var(--brand-tint)]";

export function CiFilterBar({
  teams,
  shown,
  modeToggle,
  columnsPicker,
  exportButton,
  addButton,
}: {
  teams: CiFilterOption[];
  /// How much of the register is on screen. On the bar rather than in the page
  /// header, because it changes with the filters sitting beside it.
  shown: string;
  /// List or Split. Handed in because the page is what reads the cookie.
  modeToggle: ReactNode;
  columnsPicker: ReactNode;
  /// A link out to the same rows as a file. Handed in rather than built here,
  /// because the page is what knows the whole of the query it has to carry.
  exportButton: ReactNode;
  addButton: ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useMessages();

  const value = (name: string) => params.get(name) ?? "";

  /// The box is controlled, so Clear can actually empty it. Uncontrolled, with
  /// only a default value, it kept whatever had been typed long after the
  /// filter it set was taken off — a search box saying one thing and a list
  /// showing another.
  const [query, setQuery] = useState(value("q"));

  function setParam(name: string, next: string) {
    const query = new URLSearchParams(params.toString());
    if (next) query.set(name, next);
    else query.delete(name);
    query.delete("page");
    router.push(`/cmdb?${query.toString()}`);
  }

  function clear() {
    // The type survives: it is where you are standing, not something you set.
    const query = new URLSearchParams();
    const type = params.get("type");
    if (type) query.set("type", type);
    // And so does the view: standing in "Expiring in 30 days" is where you
    // are, and Clear is about the chips beside it.
    const view = params.get("view");
    if (view) query.set("view", view);
    const search = query.toString();
    router.push(search ? `/cmdb?${search}` : "/cmdb");
  }

  const active = KEYS.filter((key) => key !== "page" && value(key));

  return (
    <div className="border-line bg-bg/90 sticky top-0 z-20 flex shrink-0 flex-wrap items-center gap-2 border-b px-5 py-2 backdrop-blur-md lg:px-6">
      <Filter
        label={t.cmdb.lifecycle}
        value={value("life")}
        onChange={(next) => setParam("life", next)}
        none={t.cmdb.anyLifecycle}
        options={CI_LIFECYCLES.map((life) => ({ id: life, label: t.cmdb.life[life] }))}
      />

      <Filter
        label={t.cmdb.team}
        value={value("team")}
        onChange={(next) => setParam("team", next)}
        none={t.cmdb.anyTeam}
        options={[{ id: "none", label: t.cmdb.noTeam }, ...teams]}
      />

      {active.length ? (
        <button
          type="button"
          onClick={clear}
          className="text-text-2 hover:text-text flex h-8 items-center gap-1 rounded-full px-2 text-sm font-medium transition-colors"
        >
          <X size={12} strokeWidth={2.5} />
          {t.tickets.clear}
        </button>
      ) : null}

      <span className="text-text-3 ml-1 text-sm">{shown}</span>

      {/* Wraps rather than runs off the end: with a pane open beside it the bar
          is a few hundred pixels narrower than it looks, and a row of controls
          that cannot wrap simply leaves the column. */}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            setParam("q", query.trim());
          }}
        >
          <Search
            size={13}
            className="text-text-3 pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
          />
          <input
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.cmdb.search}
            aria-label={t.cmdb.search}
            className="border-line bg-surface placeholder:text-text-3 focus:border-brand hover:border-line-strong h-8 w-40 rounded-full border pr-8 pl-7 text-sm shadow-[var(--highlight)] transition-[border-color,box-shadow] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none lg:w-52"
          />
          {/* Something to press. The box only ever answered to Enter, which is
              a rule nobody can see and a phone keyboard does not always offer;
              shown once there is something to search for, so an empty bar keeps
              its quiet. */}
          {query.trim() ? (
            <button
              type="submit"
              aria-label={t.cmdb.search}
              title={t.cmdb.search}
              className="text-text-3 hover:text-text absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
            >
              <CornerDownLeft size={12} strokeWidth={2.5} />
            </button>
          ) : null}
        </form>

        {modeToggle}
        {columnsPicker}
        {exportButton}
        {addButton}
      </div>
    </div>
  );
}

function Filter({
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
  options: CiFilterOption[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        CHIP_SELECT,
        value && "text-brand-deep border-transparent bg-[var(--brand-tint)]",
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
