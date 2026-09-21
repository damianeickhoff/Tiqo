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
 * is not among them: it is the views column, and clearing the filters should not
 * move you out of the kind of thing you were looking at.
 */
const KEYS = ["life", "team", "q", "page"] as const;

/** The queue's chip-shaped select, so the three lists read as one product. A
 *  well rather than a white chip: this row is inside the sheet, and a control
 *  on a sheet steps down rather than keeping the sheet's own white. */
const CHIP_SELECT =
  "select-chevron h-7 cursor-pointer appearance-none rounded-control border border-transparent bg-surface-2 " +
  "pr-7 pl-2.5 text-sm text-text-2 " +
  "transition-[border-color,box-shadow] hover:text-text " +
  "focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-[var(--brand-tint)]";

/**
 * The secondary filters, in the sheet's own header row.
 *
 * Which kind of thing you are looking at and which question you are asking of
 * it are the views column's business now; this row is only how that view is
 * narrowed once you are standing in it — two questions, the shape the register
 * is read in, and the box that finds an asset by name.
 */
export function CiFilterBar({
  teams,
  modeToggle,
}: {
  teams: CiFilterOption[];
  /// List or Split. Handed in because the page is what reads the cookie.
  modeToggle: ReactNode;
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
    setQuery("");
    const search = query.toString();
    router.push(search ? `/cmdb?${search}` : "/cmdb");
  }

  const active = KEYS.filter((key) => key !== "page" && value(key));

  return (
    <div className="border-line flex min-h-[52px] flex-wrap items-center gap-2 border-b px-4 py-2">
      {modeToggle}

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
          className="bg-surface-2 placeholder:text-text-3 focus:border-brand rounded-control h-7 w-48 border border-transparent pr-8 pl-7 text-sm transition-[border-color,box-shadow] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none lg:w-56"
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
            className="text-text-3 hover:text-text absolute top-1/2 right-1 flex size-5 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
          >
            <CornerDownLeft size={12} strokeWidth={2.5} />
          </button>
        ) : null}
      </form>
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
      className={cn(CHIP_SELECT, value && "text-text font-medium")}
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
