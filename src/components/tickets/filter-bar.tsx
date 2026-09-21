"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListFilter, Search, X } from "lucide-react";
import { PRIORITY_ORDER, TYPE_ORDER } from "@/lib/tickets";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type FilterOption = { id: string; label: string };

/** Every key the queue understands, so Clear leaves nothing behind. */
const KEYS = [
  "status",
  "priority",
  "project",
  "assignee",
  "type",
  "team",
  "approval",
  "scope",
  "open",
  "blocked",
  "sort",
  "dir",
  "q",
  "page",
] as const;

/**
 * What the button owns up to: the narrowing that has no control of its own in
 * the row, because it is a question most desks never ask.
 *
 * The five in the row — status, priority, type, project, assignee — say what
 * they are set to where they stand, so they need no count. Not `scope`, which
 * is the view you are in rather than a filter on it; not `q`, which has a box
 * of its own; not the order, which changes what is first rather than what is
 * there.
 */
const EXTRAS = ["team", "approval", "open", "blocked"] as const;

/**
 * The secondary filters, in the sheet's own header row.
 *
 * Which view you are in is the views column's business now; this row is only
 * how the view is narrowed once you are standing in it — five questions where
 * the answer is worth showing, one button for the rest, and the box that finds
 * a ticket by its words or its reference.
 */
export function FilterBar({
  statuses,
  projects,
  assignees,
  teams,
  showAssignee,
}: {
  statuses: { id: string; name: string }[];
  projects: FilterOption[];
  assignees: FilterOption[];
  teams: FilterOption[];
  showAssignee: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useMessages();
  const [open, setOpen] = useState(false);

  const value = (name: string) => params.get(name) ?? "";

  /** Changing any filter starts again at the first page. A filter is a
   *  list-level command, so it takes effect the moment it is picked. */
  function setParam(name: string, next: string) {
    const query = new URLSearchParams(params.toString());
    if (next) query.set(name, next);
    else query.delete(name);
    query.delete("page");
    router.push(`/tickets?${query.toString()}`);
  }

  const extras = EXTRAS.filter((key) => value(key)).length;
  const active = KEYS.filter(
    (key) => key !== "page" && key !== "sort" && key !== "dir" && value(key),
  );

  return (
    <div className="border-line flex min-h-[52px] flex-wrap items-center gap-2 border-b px-4 py-2">
      <Picker
        label={t.ticket.status}
        value={value("status")}
        onChange={(next) => setParam("status", next)}
        none={t.tickets.anyStatus}
        options={statuses.map((status) => ({ id: status.id, label: status.name }))}
      />

      <Picker
        label={t.ticket.priority}
        value={value("priority")}
        onChange={(next) => setParam("priority", next)}
        none={t.tickets.anyPriority}
        options={PRIORITY_ORDER.map((priority) => ({
          id: priority,
          label: t.vocab.priority[priority],
        }))}
      />

      <Picker
        label={t.ticket.type}
        value={value("type")}
        onChange={(next) => setParam("type", next)}
        none={t.tickets.anyType}
        options={TYPE_ORDER.map((type) => ({ id: type, label: t.vocab.type[type] }))}
      />

      <Picker
        label={t.ticket.project}
        value={value("project")}
        onChange={(next) => setParam("project", next)}
        none={t.tickets.allProjects}
        options={projects}
      />

      {showAssignee ? (
        <Picker
          label={t.ticket.assignee}
          value={value("assignee")}
          onChange={(next) => setParam("assignee", next)}
          none={t.tickets.anyone}
          options={[
            { id: "me", label: t.tickets.assignedToMe },
            { id: "none", label: t.tickets.unassigned },
            ...assignees,
          ]}
        />
      ) : null}

      {/* The rest, behind one button rather than four more dropdowns nobody
          asked for. The count says how many are on. */}
      <div className="relative">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
          className={cn(
            "rounded-control flex h-7 items-center gap-1.5 border px-2.5 text-sm font-medium whitespace-nowrap transition-colors",
            extras
              ? "text-brand-deep border-transparent bg-[var(--brand-tint)]"
              : "text-text-2 hover:text-text bg-surface-2 border-transparent",
          )}
        >
          <ListFilter size={13} strokeWidth={2} />
          {t.tickets.filters}
          {extras ? (
            <span className="bg-brand tnum flex size-4 items-center justify-center rounded-full text-[10px] font-semibold text-[var(--brand-ink)]">
              {extras}
            </span>
          ) : null}
        </button>

        {open ? (
          <>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-label={t.tickets.filters}
              className="animate-rise bg-surface rounded-card absolute left-0 z-50 mt-2 w-72 p-3 shadow-[var(--shadow-float)]"
            >
              <label className="grid gap-1">
                <span className="label">{t.ticket.team}</span>
                <select
                  value={value("team")}
                  onChange={(event) => setParam("team", event.target.value)}
                  className="select-chevron bg-surface-2 text-text rounded-control focus:border-brand h-8 w-full cursor-pointer appearance-none border border-transparent pr-7 pl-2.5 text-base transition-[border-color,box-shadow] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none"
                >
                  <option value="">{t.tickets.anyGroup}</option>
                  <option value="none">{t.tickets.noGroup}</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="border-line mt-3 grid gap-1 border-t pt-2">
                <Check
                  label={t.tickets.openOnly}
                  checked={value("open") === "1"}
                  onChange={(on) => setParam("open", on ? "1" : "")}
                />
                <Check
                  label={t.links.blocked}
                  checked={value("blocked") === "1"}
                  onChange={(on) => setParam("blocked", on ? "1" : "")}
                />
                {/* Two questions about one thing, so one parameter: a ticket
                    waiting on you is already waiting on a decision, and
                    answering both at once would only ever mean the narrower. */}
                <Check
                  label={t.tickets.waitingDecision}
                  checked={value("approval") === "pending"}
                  onChange={(on) => setParam("approval", on ? "pending" : "")}
                />
                <Check
                  label={t.tickets.waitingOnMe}
                  checked={value("approval") === "me"}
                  onChange={(on) => setParam("approval", on ? "me" : "")}
                />
              </div>
            </div>
          </>
        ) : null}
      </div>

      {active.length ? (
        <button
          type="button"
          onClick={() => router.push("/tickets")}
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
          placeholder={t.tickets.searchAll}
          aria-label={t.tickets.searchAll}
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
  options: FilterOption[];
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

/** A filter that is either on or off. */
function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="hover:bg-surface-2 rounded-control flex cursor-pointer items-center gap-2.5 px-1 py-1.5 text-base font-medium transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-brand size-3.5"
      />
      {label}
    </label>
  );
}
