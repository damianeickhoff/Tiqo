"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Columns3, ListFilter, RotateCcw, Search, X } from "lucide-react";
import { PRIORITY_ORDER, TYPE_ORDER } from "@/lib/tickets";
import { resetColumns } from "@/components/table/resizable-columns";
import { QUEUE_COLUMNS_KEY } from "@/components/tickets/ticket-table";
import { useMessages } from "@/components/shell/instance-context";
import type { Messages } from "@/lib/i18n";
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
 * What counts as narrowing the queue, and so what the button has to own up to.
 *
 * Not `scope`, which is the view you are in rather than a filter on it; not
 * `q`, which has a box of its own that says what it is holding; and not the
 * order, which changes what is first rather than what is there.
 */
const FILTERS = [
  "status",
  "priority",
  "type",
  "team",
  "project",
  "assignee",
  "approval",
  "open",
  "blocked",
] as const;

/**
 * The four or five questions an operator actually starts from, as one click
 * each.
 *
 * Views set several parameters at once and replace whatever was there, which is
 * the point: "unassigned" means unassigned, not "unassigned as well as the
 * three filters I forgot were on".
 */
const VIEWS = [
  { id: "open", label: "viewAllOpen", params: { open: "1" } },
  { id: "mine", label: "viewMine", params: { open: "1", assignee: "me" } },
  { id: "groups", label: "viewMyGroups", params: { open: "1", scope: "team" } },
  { id: "unassigned", label: "viewUnassigned", params: { open: "1", assignee: "none" } },
  { id: "all", label: "viewEverything", params: {} },
] as const;

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

  function go(next: Record<string, string>) {
    const query = new URLSearchParams(next);
    router.push(`/tickets?${query.toString()}`);
  }

  /** Everything the address is narrowing by, in the order the panel lists it,
   *  each with the words to show and the key that turns it off. */
  const chips = FILTERS.filter((key) => value(key)).map((key) => ({
    key,
    label: chipLabel(key, value(key), t, { statuses, projects, assignees, teams }),
  }));

  const active = KEYS.filter(
    (key) => key !== "page" && key !== "sort" && key !== "dir" && value(key),
  );

  // A view is current when the URL says exactly what the view says — no more.
  const current = VIEWS.find((view) => {
    const keys = Object.keys(view.params);
    return (
      active.length === keys.length &&
      keys.every((key) => value(key) === view.params[key as keyof typeof view.params])
    );
  });

  return (
    <div className="border-line bg-surface/90 sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b px-5 py-2 backdrop-blur-md lg:px-6">
      {/* Where you are, before what you are narrowing: a segmented control. */}
      <div
        role="group"
        aria-label={t.tickets.views}
        className="bg-surface-2 flex items-center gap-0.5 rounded-full p-0.5"
      >
        {VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            aria-current={current?.id === view.id}
            onClick={() => go(view.params)}
            className={cn(
              "h-8 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow]",
              current?.id === view.id
                ? "text-text bg-[var(--seg-on)] shadow-[0_1px_2px_rgba(9,9,11,0.1),0_0_0_1px_rgba(9,9,11,0.04)]"
                : "text-text-2 hover:text-text",
            )}
          >
            {t.tickets[view.label]}
          </button>
        ))}
      </div>

      <span aria-hidden className="bg-line mx-1 hidden h-5 w-px sm:block" />

      {/* One button rather than a row of eight dropdowns. Eight of them were
          eight questions asked of everybody all the time, most of which most
          desks never answer; this asks one, and says how many are answered. */}
      <div className="relative">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-sm font-medium whitespace-nowrap transition-colors",
            chips.length
              ? "text-brand-deep border-transparent bg-[var(--brand-tint)]"
              : "border-line text-text-2 hover:border-line-strong hover:text-text bg-surface shadow-[var(--highlight)]",
          )}
        >
          <ListFilter size={13} strokeWidth={2} />
          {t.tickets.filters}
          {chips.length ? (
            <span className="bg-brand tnum flex size-4 items-center justify-center rounded-full text-[10px] font-semibold text-[var(--brand-ink)]">
              {chips.length}
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
              className="animate-rise border-line bg-surface rounded-card absolute left-0 z-50 mt-2 w-72 border p-3 shadow-[var(--shadow-float)]"
            >
              <div className="grid gap-2.5">
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
                  label={t.ticket.team}
                  value={value("team")}
                  onChange={(next) => setParam("team", next)}
                  none={t.tickets.anyGroup}
                  options={[{ id: "none", label: t.tickets.noGroup }, ...teams]}
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
              </div>

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

      <ColumnsMenu />

      {/* What is on, where it can be taken off again. A count on a button says
          how many; only the chips say which. */}
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => setParam(chip.key, "")}
          aria-label={t.tickets.removeFilter(chip.label)}
          className="border-line bg-surface text-text-2 hover:border-line-strong hover:text-text flex h-8 items-center gap-1.5 rounded-full border pr-2 pl-2.5 text-sm font-medium whitespace-nowrap shadow-[var(--highlight)] transition-colors"
        >
          {chip.label}
          <X size={12} strokeWidth={2.5} className="text-text-3" />
        </button>
      ))}

      {active.length ? (
        <button
          type="button"
          onClick={() => router.push("/tickets")}
          className="text-text-2 hover:text-text flex h-8 items-center gap-1 rounded-full px-2 text-sm font-medium transition-colors"
        >
          <X size={12} strokeWidth={2.5} />
          {t.tickets.clear}
        </button>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <form
          className="relative"
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
            className="border-line bg-surface placeholder:text-text-3 focus:border-brand hover:border-line-strong h-8 w-48 rounded-full border pr-3 pl-7 text-sm shadow-[var(--highlight)] transition-[border-color,box-shadow] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none lg:w-56"
          />
        </form>
      </div>
    </div>
  );
}

/**
 * What can be done to the columns themselves.
 *
 * One item so far, and it is the one a drag needs behind it: a double-click on
 * a handle puts that column back, and this puts all of them back for somebody
 * who has dragged the table somewhere they cannot read.
 */
function ColumnsMenu() {
  const t = useMessages();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="border-line text-text-2 hover:border-line-strong hover:text-text bg-surface flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-sm font-medium whitespace-nowrap shadow-[var(--highlight)] transition-colors"
      >
        <Columns3 size={13} strokeWidth={2} />
        {t.tickets.columns}
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
            role="menu"
            className="animate-rise border-line bg-surface rounded-card absolute left-0 z-50 mt-2 w-52 border p-1 shadow-[var(--shadow-float)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                resetColumns(QUEUE_COLUMNS_KEY);
                setOpen(false);
              }}
              className="hover:bg-surface-2 rounded-control flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-base font-medium transition-colors"
            >
              <RotateCcw size={14} className="text-text-3" />
              {t.tickets.resetColumns}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** What a filter that is on should be called on its chip: the words somebody
 *  chose, not the id that was stored. */
function chipLabel(
  key: (typeof FILTERS)[number],
  value: string,
  t: Messages,
  lists: {
    statuses: { id: string; name: string }[];
    projects: FilterOption[];
    assignees: FilterOption[];
    teams: FilterOption[];
  },
) {
  switch (key) {
    case "status":
      return lists.statuses.find((status) => status.id === value)?.name ?? t.ticket.status;
    case "priority":
      return t.vocab.priority[value as keyof typeof t.vocab.priority] ?? t.ticket.priority;
    case "type":
      return t.vocab.type[value as keyof typeof t.vocab.type] ?? t.ticket.type;
    case "team":
      return value === "none"
        ? t.tickets.noGroup
        : (lists.teams.find((team) => team.id === value)?.label ?? t.ticket.team);
    case "project":
      return lists.projects.find((project) => project.id === value)?.label ?? t.ticket.project;
    case "assignee":
      return value === "me"
        ? t.tickets.assignedToMe
        : value === "none"
          ? t.tickets.unassigned
          : (lists.assignees.find((person) => person.id === value)?.label ?? t.ticket.assignee);
    case "approval":
      return value === "me" ? t.tickets.waitingOnMe : t.tickets.waitingDecision;
    case "open":
      return t.tickets.openOnly;
    case "blocked":
      return t.links.blocked;
  }
}

/** One question in the panel: what it is asking, and what it is answered with. */
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
    <label className="grid gap-1">
      <span className="label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="select-chevron border-line bg-surface text-text rounded-control focus:border-brand h-8 w-full cursor-pointer appearance-none pr-7 pl-2.5 text-base shadow-[var(--highlight)] transition-[border-color,box-shadow] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none"
      >
        <option value="">{none}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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
