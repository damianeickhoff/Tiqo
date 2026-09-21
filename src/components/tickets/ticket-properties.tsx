"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Layers, Plus, X } from "lucide-react";
import type { Priority, TicketType } from "@/generated/prisma/enums";
import { createTagOnTicket, updateTicket } from "@/lib/actions/tickets";
import { setTicketMilestone } from "@/lib/actions/projects";
import { PRIORITY_META, PRIORITY_ORDER, TYPE_ORDER, hasResponseTarget } from "@/lib/tickets";
import { PriorityBars, StatusRing } from "@/components/tickets/glyphs";
import { PanelCard, PanelRow as Row, PanelValue as Static } from "@/components/tickets/panel-card";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { usePriorityTargets, useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

type Tag = { id: string; name: string };

type Props = {
  ticketId: string;
  statusId: string | null;
  statusName: string | null;
  statuses: { id: string; name: string; color: string; settles?: boolean }[];
  priority: Priority;
  type: TicketType;
  assigneeId: string | null;
  assigneeName: string | null;
  projectId: string | null;
  projectName: string | null;
  /// The key the project is addressed by, so the row can be a way in and not
  /// only a label. Null when the ticket is filed against nothing.
  projectKey: string | null;
  teamId: string | null;
  teamName: string | null;
  teams: { id: string; name: string; color: string }[];
  labelIds: string[];
  agents: { id: string; name: string }[];
  projects: { id: string; name: string; color: string }[];
  /// The dated points of the project this ticket is in. Empty when it is in no
  /// project, or in one that has none — the field simply does not appear.
  milestones: { id: string; title: string; reachedAt: Date | null }[];
  milestoneId: string | null;
  labels: Tag[];
  /// The change's plan, for the row that says how far through it is. Null on
  /// anything that is not a change with steps, which keeps the row off the
  /// other two kinds of ticket.
  plan: { name: string | null; settled: number; total: number } | null;
  ticketNumber: number;
  readOnly: boolean;
};

/* ----------------------------------------------------------------- cells -- */

/**
 * The rail's first card: the status and the priority, side by side.
 *
 * A card of its own with no title, because the two questions asked of a ticket
 * more often than all the others together should be answerable by looking at
 * the top of the rail, not by reading a heading first.
 */
function TwoUp({ children }: { children: React.ReactNode }) {
  // `shrink-0` for the same reason PanelCard has it: the rail is a flex column
  // of a fixed height, and without it the cards are squeezed to fit.
  return <section className="card grid shrink-0 grid-cols-2 overflow-hidden">{children}</section>;
}

/**
 * The two things asked first, given the top of the rail and twice the room:
 * a caption, then the value with its glyph.
 *
 * The select is laid over the whole cell at zero opacity rather than styled
 * into it, because a native select cannot put a caption above its own value —
 * and a cell you can only open by hitting the chevron is a worse control than
 * the one it replaced.
 */
function Cell({
  label,
  value,
  dirty = false,
  divided = false,
  children,
}: {
  label: string;
  value: React.ReactNode;
  dirty?: boolean;
  /// The right-hand cell of the pair, which carries the hairline between them.
  divided?: boolean;
  /// The select, when the viewer may change this. Absent makes the cell a
  /// readout.
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col gap-1.5 px-4 py-3",
        "focus-within:ring-[3px] focus-within:ring-[var(--brand-tint)] focus-within:outline-none",
        divided && "border-line border-l",
        dirty && "bg-[var(--brand-tint)]",
        children && "hover:bg-surface-2",
      )}
    >
      <span className="text-text-3 text-[11px] leading-none font-semibold tracking-[0.06em] uppercase">
        {label}
      </span>
      <span className="flex min-w-0 items-center gap-2 text-base font-medium">
        {value}
        {children ? (
          <ChevronDown size={14} className="text-text-3 ml-auto shrink-0" aria-hidden />
        ) : null}
      </span>
      {children}
    </div>
  );
}

/** The way out of the row and into the project itself. */
function ProjectLink({ projectKey }: { projectKey: string }) {
  const t = useMessages();
  return (
    <Link
      href={`/projects/${projectKey}`}
      aria-label={t.ticket.openProject}
      title={t.ticket.openProject}
      className="text-text-3 hover:bg-surface-2 hover:text-text rounded-control absolute right-0 flex size-8 shrink-0 items-center justify-center transition-colors"
    >
      <ArrowUpRight size={15} />
    </Link>
  );
}

/** A value that can be changed: a native select wearing the pill's clothes. */
const PILL_SELECT =
  "h-8 w-full min-w-0 cursor-pointer appearance-none truncate rounded-control bg-transparent " +
  "pr-7 pl-2 text-base font-medium text-text select-chevron " +
  "transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:outline-none " +
  "disabled:cursor-default disabled:opacity-60";

/** The two-up cell's control: the whole cell, invisible, over the readout. */
const CELL_SELECT = "absolute inset-0 h-full w-full cursor-pointer opacity-0 focus:outline-none";

function ReadOnlyProperties({
  statusName,
  statuses,
  statusId,
  priority,
  type,
  assigneeName,
  teamName,
  projectName,
  projectKey,
  labels,
  labelIds,
}: Pick<
  Props,
  | "statusName"
  | "statuses"
  | "statusId"
  | "priority"
  | "type"
  | "assigneeName"
  | "teamName"
  | "projectName"
  | "projectKey"
  | "labels"
  | "labelIds"
>) {
  const targets = usePriorityTargets();
  const t = useMessages();
  const applied = labels.filter((label) => labelIds.includes(label.id));
  const status = statuses.find((row) => row.id === statusId) ?? null;

  return (
    <>
      <TwoUp>
        <Cell
          label={t.ticket.status}
          value={
            <>
              <StatusRing
                status={status ? { ...status, settles: status.settles ?? false } : null}
              />
              <span className={cn("truncate", !statusName && "text-text-3 font-normal")}>
                {statusName ?? t.tickets.noStatus}
              </span>
            </>
          }
        />
        <Cell
          label={t.ticket.priority}
          divided
          value={
            <>
              <PriorityBars priority={priority} title={t.vocab.priority[priority]} />
              <span className="truncate">{t.vocab.priority[priority]}</span>
              {hasResponseTarget(type) ? (
                <span className="text-text-3 shrink-0 font-normal">
                  · {t.ticket.hoursTarget(targets[priority])}
                </span>
              ) : null}
            </>
          }
        />
      </TwoUp>

      <PanelCard title={t.ticket.details}>
        <div className="space-y-0.5 p-2">
          <Row label={t.ticket.type}>
            <Static>{t.vocab.type[type]}</Static>
          </Row>
          <Row label={t.ticket.assignee}>
            <Static muted={!assigneeName}>{assigneeName ?? t.tickets.unassigned}</Static>
          </Row>
          <Row label={t.ticket.team}>
            <Static muted={!teamName}>{teamName ?? t.tickets.unrouted}</Static>
          </Row>
          <Row label={t.ticket.project}>
            <Static muted={!projectName}>{projectName ?? t.common.none}</Static>
            {projectKey ? <ProjectLink projectKey={projectKey} /> : null}
          </Row>
          <Row label={t.ticket.tags}>
            <span className="flex flex-wrap gap-1 px-2 py-1">
              {applied.length === 0 ? (
                <span className="text-text-3 text-base">{t.common.none}</span>
              ) : (
                applied.map((label) => <TagChip key={label.id} tag={label} />)
              )}
            </span>
          </Row>

          <p className="text-text-3 px-2 pt-1 text-xs">{t.ticket.onlyOperators}</p>
        </div>
      </PanelCard>
    </>
  );
}

/* ------------------------------------------------------------------ tags -- */

function TagChip({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  const t = useMessages();

  return (
    <span className={cn("tag gap-1 pr-1", !onRemove && "pr-2")}>
      <span>{tag.name}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t.ticket.removeTag(tag.name)}
          className="text-text-3 hover:bg-negative/12 hover:text-negative flex size-4 items-center justify-center rounded-full transition-colors"
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      ) : null}
    </span>
  );
}

/**
 * A token field: the ticket's tags and the place you type the next one are the
 * same control, the way an address field works.
 *
 * Every tag ever created is remembered instance-wide, so typing "net" offers
 * the "network" someone made last month rather than quietly making a second
 * one. Creating is still one keystroke away when nothing matches.
 */
function TagField({
  all,
  applied,
  disabled,
  onToggle,
  onCreate,
  error,
}: {
  all: Tag[];
  applied: string[];
  disabled: boolean;
  onToggle: (id: string) => void;
  onCreate: (name: string) => void;
  error: string | null;
}) {
  const t = useMessages();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const chips = all.filter((tag) => applied.includes(tag.id));
  const term = query.trim().toLowerCase();
  const matches = all
    .filter((tag) => !applied.includes(tag.id) && tag.name.toLowerCase().includes(term))
    .slice(0, 8);
  // Only offer to create what does not already exist, applied or not.
  const exact = all.some((tag) => tag.name.toLowerCase() === term);
  const canCreate = term.length > 0 && !exact;
  const showList = focused && (matches.length > 0 || canCreate);

  function add(id: string) {
    onToggle(id);
    setQuery("");
  }

  function create() {
    onCreate(query.trim());
    setQuery("");
  }

  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      {/* Clicking the padding focuses the input inside, the way a label does —
          the box itself has no behaviour of its own. */}
      <div
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.querySelector("input")?.focus();
          }
        }}
        className={cn(
          "rounded-control flex min-h-9 flex-wrap items-center gap-1 px-1.5 py-1",
          "transition-[background-color,box-shadow] duration-150",
          focused ? "bg-surface-2 ring-[3px] ring-[var(--brand-tint)]" : "hover:bg-surface-2",
          disabled && "opacity-60",
        )}
      >
        {chips.map((tag) => (
          <TagChip key={tag.id} tag={tag} onRemove={() => onToggle(tag.id)} />
        ))}

        <input
          value={query}
          disabled={disabled}
          maxLength={30}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              // Enter takes the obvious action: the tag being suggested, or a
              // new one by that name when nothing matches.
              if (matches.length > 0) add(matches[0]!.id);
              else if (canCreate) create();
              return;
            }
            if (event.key === "Escape") setQuery("");
            // Backspace on an empty field takes the last tag back off, which is
            // what every other token field does.
            if (event.key === "Backspace" && !query && chips.length > 0) {
              onToggle(chips[chips.length - 1]!.id);
            }
          }}
          placeholder={chips.length === 0 ? t.ticket.addTag : "+"}
          aria-label={t.ticket.addTag}
          className="placeholder:text-text-3 min-w-[4ch] flex-1 bg-transparent px-0.5 text-base focus:outline-none"
        />
      </div>

      {/* In the flow, not floating: this panel is a scroll container, and
          anything absolutely positioned inside it is clipped at its edge. */}
      {showList ? (
        <ul className="animate-rise bg-surface rounded-control max-h-44 overflow-y-auto p-1 shadow-[var(--shadow-md)]">
          {matches.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                // The list must not steal focus, or blur would close it before
                // the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(tag.id)}
                className="hover:bg-surface-2 rounded-control w-full truncate px-2 py-1.5 text-left text-base transition-colors"
              >
                {tag.name}
              </button>
            </li>
          ))}

          {canCreate ? (
            <li>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={create}
                className="text-brand-deep rounded-control flex w-full items-center gap-2 px-2 py-1.5 text-left text-base font-medium transition-colors hover:bg-[var(--brand-tint)]"
              >
                <Plus size={13} strokeWidth={2.5} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{t.ticket.createTag(query.trim())}</span>
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {error ? <p className="text-negative text-sm font-medium">{error}</p> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- panel -- */

/**
 * The ticket's settings.
 *
 * Choosing a status, a priority, a person or a project changes a draft, and the
 * draft reaches the database when Save is pressed — the rule for every editor
 * on the desk, kept here by `useDraft`. A changed row is tinted so the eye can
 * find what is about to be saved, and Discard puts it back.
 *
 * Tags are the exception, on purpose: adding or removing one is a list-level
 * command with no text beside it, so it lands straight away.
 */
export function TicketProperties({
  ticketId,
  statusId,
  statusName,
  statuses,
  priority,
  type,
  assigneeId,
  assigneeName,
  teamId,
  teamName,
  teams,
  projectId,
  projectName,
  projectKey,
  labelIds: initialLabelIds,
  agents,
  projects,
  milestones,
  milestoneId,
  labels,
  plan,
  ticketNumber,
  readOnly,
}: Props) {
  const targets = usePriorityTargets();
  const t = useMessages();
  const [tagPending, startTagTransition] = useTransition();
  const [tagError, setTagError] = useState<string | null>(null);
  const [labelIds, setLabelIds] = useState(initialLabelIds);
  /// Whether the "this is still blocking something" warning has been said. The
  /// second Save carries it and goes through.
  const [warned, setWarned] = useState(false);

  const draft = useDraft({
    statusId: statusId ?? "",
    type,
    priority,
    assigneeId: assigneeId ?? "",
    teamId: teamId ?? "",
    projectId: projectId ?? "",
    milestoneId: milestoneId ?? "",
  });
  const { draft: form, set } = draft;
  const committed = {
    statusId: statusId ?? "",
    type,
    priority,
    assigneeId: assigneeId ?? "",
    teamId: teamId ?? "",
    projectId: projectId ?? "",
    milestoneId: milestoneId ?? "",
  };
  const changed = (key: keyof typeof form) => form[key] !== committed[key];

  async function save(values: typeof form) {
    const patch: Parameters<typeof updateTicket>[1] = {};
    if (values.statusId !== committed.statusId) patch.statusId = values.statusId || null;
    if (values.type !== committed.type) patch.type = values.type;
    if (values.priority !== committed.priority) patch.priority = values.priority;
    if (values.assigneeId !== committed.assigneeId) patch.assigneeId = values.assigneeId || null;
    if (values.teamId !== committed.teamId) patch.teamId = values.teamId || null;
    if (values.projectId !== committed.projectId) patch.projectId = values.projectId || null;

    if (Object.keys(patch).length > 0) {
      // Shown once and then stood down, the same latch the toolbar's Close
      // uses: the link graph knows this ticket is holding something up, it does
      // not know the desk has already dealt with it.
      const result = await updateTicket(ticketId, patch, warned);
      if (!result.ok && "warn" in result) {
        setWarned(true);
        return result;
      }
      if (!result.ok) return result;
    }
    // The milestone writes through a project action, not `updateTicket`, so
    // it is its own call — after the ticket's, in case the project changed.
    if (values.milestoneId !== committed.milestoneId) {
      const result = await setTicketMilestone(ticketId, values.milestoneId || null);
      if (!result.ok) return result;
    }
    return { ok: true as const };
  }

  function toggleLabel(id: string) {
    const next = labelIds.includes(id) ? labelIds.filter((x) => x !== id) : [...labelIds, id];
    setLabelIds(next);
    startTagTransition(async () => {
      const result = await updateTicket(ticketId, { labelIds: next });
      if (!result.ok) setLabelIds(labelIds);
    });
  }

  function createTag(name: string) {
    startTagTransition(async () => {
      const result = await createTagOnTicket(ticketId, name);
      setTagError(result.ok ? null : result.error);
    });
  }

  // A viewer who cannot edit gets the values, not disabled controls — the
  // agent list is empty for them, so a select would misreport the assignee.
  if (readOnly) {
    return (
      <ReadOnlyProperties
        statusName={statusName}
        statuses={statuses}
        statusId={statusId}
        priority={priority}
        type={type}
        assigneeName={assigneeName}
        teamName={teamName}
        projectName={projectName}
        projectKey={projectKey}
        labels={labels}
        labelIds={labelIds}
      />
    );
  }

  const timed = hasResponseTarget(form.type);
  const status = statuses.find((row) => row.id === form.statusId) ?? null;

  // What Save is about to do, in the order the card reads. The first change is
  // spelled out and the rest are counted: a bar that lists seven of them is a
  // paragraph nobody reads on the way to pressing a button.
  const nameOf = {
    statusId: (id: string) => statuses.find((row) => row.id === id)?.name ?? t.tickets.noStatus,
    priority: (value: string) => t.vocab.priority[value as Priority],
    type: (value: string) => t.vocab.type[value as TicketType],
    assigneeId: (id: string) => agents.find((row) => row.id === id)?.name ?? t.tickets.unassigned,
    teamId: (id: string) => teams.find((row) => row.id === id)?.name ?? t.tickets.unrouted,
    projectId: (id: string) => projects.find((row) => row.id === id)?.name ?? t.ticket.noProject,
    milestoneId: (id: string) =>
      milestones.find((row) => row.id === id)?.title ?? t.projects.noMilestone,
  };
  const diffs = (Object.keys(nameOf) as (keyof typeof nameOf)[])
    .filter((key) => changed(key))
    .map((key) => t.ticket.fieldChange(nameOf[key](committed[key]), nameOf[key](form[key])));
  const summary =
    diffs.length === 0
      ? undefined
      : diffs.length === 1
        ? diffs[0]
        : `${diffs[0]} · ${t.ticket.andMore(diffs.length - 1)}`;

  return (
    // Two cards, one draft. The two questions asked about a ticket more often
    // than all the others together get a card to themselves at the top of the
    // rail; everything else is Details underneath. A change in either belongs
    // to the same edit, so the footer that saves it lives on the second card
    // and saves both.
    <>
      <TwoUp>
        <Cell
          label={t.ticket.status}
          dirty={changed("statusId")}
          value={
            <>
              <StatusRing
                status={status ? { ...status, settles: status.settles ?? false } : null}
              />
              <span className="truncate">
                {statuses.find((row) => row.id === form.statusId)?.name ?? t.tickets.noStatus}
              </span>
            </>
          }
        >
          <select
            aria-label={t.ticket.status}
            value={form.statusId}
            onChange={(event) => set({ statusId: event.target.value })}
            className={CELL_SELECT}
          >
            {/* The empty option only exists while a ticket is actually in it —
                nobody chooses "no status", it is what a deleted one leaves. */}
            {statusId === null ? <option value="">{t.tickets.noStatus}</option> : null}
            {statuses.map((value) => (
              <option key={value.id} value={value.id}>
                {value.name}
              </option>
            ))}
          </select>
        </Cell>

        {/* Priority always says how much it matters. It only implies a clock on
            an incident — a question or a change is committed to by a due date. */}
        <Cell
          label={t.ticket.priority}
          divided
          dirty={changed("priority")}
          value={
            <>
              <PriorityBars priority={form.priority} />
              <span className="truncate" style={{ color: PRIORITY_META[form.priority].color }}>
                {t.vocab.priority[form.priority]}
              </span>
            </>
          }
        >
          <select
            aria-label={t.ticket.priority}
            value={form.priority}
            onChange={(event) => set({ priority: event.target.value as Priority })}
            className={CELL_SELECT}
          >
            {PRIORITY_ORDER.map((value) => (
              <option key={value} value={value}>
                {t.vocab.priority[value]}
                {timed ? ` · ${t.ticket.hoursTarget(targets[value])}` : ""}
              </option>
            ))}
          </select>
        </Cell>
      </TwoUp>

      <PanelCard
        title={t.ticket.details}
        action={
          draft.dirty ? (
            <span className="text-brand-deep flex items-center gap-1.5 text-xs font-medium">
              <span aria-hidden className="bg-brand size-1.5 rounded-full" />
              {t.ticket.unsavedCount(diffs.length)}
            </span>
          ) : null
        }
      >
        <div className="space-y-0.5 p-2">
          <Row label={t.ticket.type} dirty={changed("type")}>
            <select
              aria-label={t.ticket.type}
              value={form.type}
              onChange={(event) => set({ type: event.target.value as TicketType })}
              className={PILL_SELECT}
            >
              {TYPE_ORDER.map((value) => (
                <option key={value} value={value}>
                  {t.vocab.type[value]}
                </option>
              ))}
            </select>
          </Row>

          <Row label={t.ticket.assignee} dirty={changed("assigneeId")}>
            <select
              aria-label={t.ticket.assignee}
              value={form.assigneeId}
              onChange={(event) => set({ assigneeId: event.target.value })}
              className={cn(PILL_SELECT, !form.assigneeId && "text-text-3 font-normal")}
            >
              <option value="">{t.tickets.unassigned}</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </Row>

          {/* The team that owns the work. Handing it to another team is what
            escalation looks like here — no tiers, just a different desk. */}
          <Row label={t.ticket.team} dirty={changed("teamId")}>
            <select
              aria-label={t.ticket.team}
              value={form.teamId}
              onChange={(event) => set({ teamId: event.target.value })}
              className={cn(PILL_SELECT, !form.teamId && "text-text-3 font-normal")}
            >
              <option value="">{t.tickets.unrouted}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </Row>

          {/* A ticket may belong to a project, and may stop belonging to one — so
            "None" is a real choice here, not just the starting state. */}
          <Row label={t.ticket.project} dirty={changed("projectId")}>
            <select
              aria-label={t.ticket.project}
              value={form.projectId}
              onChange={(event) => set({ projectId: event.target.value })}
              className={cn(PILL_SELECT, !form.projectId && "text-text-3 font-normal")}
            >
              <option value="">{t.ticket.noProject}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {/* Named and reachable. The select answers "which project"; without
              this the answer is a dead end and the way there is the sidebar and
              a search. Only for the project already saved — a project chosen in
              a draft is not somewhere this ticket is yet. */}
            {projectKey && form.projectId === projectId ? (
              <ProjectLink projectKey={projectKey} />
            ) : null}
          </Row>

          {/* Only where there is something to file it against. A picker with one
            empty option in it is a question nobody can answer. */}
          {milestones.length > 0 ? (
            <Row label={t.projects.inMilestone} dirty={changed("milestoneId")}>
              <select
                aria-label={t.projects.inMilestone}
                value={form.milestoneId}
                onChange={(event) => set({ milestoneId: event.target.value })}
                className={cn(PILL_SELECT, !form.milestoneId && "text-text-3 font-normal")}
              >
                <option value="">{t.projects.noMilestone}</option>
                {milestones.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.title}
                    {row.reachedAt ? ` · ${t.projects.reached}` : ""}
                  </option>
                ))}
              </select>
            </Row>
          ) : null}

          {/* A read-only row: the plan is edited on its own page, and this is the
            way there. Only a change has one. */}
          {plan ? (
            <Row label={t.plan.title}>
              <Link
                href={`/tickets/${ticketNumber}/plan`}
                className="hover:bg-surface-2 rounded-control flex h-8 min-w-0 flex-1 items-center gap-1.5 px-2 text-base font-medium transition-colors"
              >
                <Layers size={13} className="text-text-3 shrink-0" />
                <span className="truncate">{plan.name ?? t.plan.title}</span>
                <span className="text-text-3 tnum ml-auto shrink-0 pl-1.5 font-mono text-xs">
                  {plan.settled}/{plan.total}
                </span>
              </Link>
            </Row>
          ) : null}

          {/* Applied tags only, plus one control to add another. Listing every tag
            in the instance turned this into a wall as soon as the library grew,
            and gave no way to find one by typing. */}
          <Row label={t.ticket.tags}>
            <TagField
              all={labels}
              applied={labelIds}
              disabled={tagPending}
              onToggle={toggleLabel}
              onCreate={createTag}
              error={tagError}
            />
          </Row>
        </div>

        {/* No footer at all while there is nothing to save: a Save button that is
          always there but almost always disabled teaches people to ignore it.
          It is the second card's footer and the first card's too — the draft
          is one. */}
        <SaveBar draft={draft} save={save} variant="footer" summary={summary} hideWhenIdle />
      </PanelCard>
    </>
  );
}
