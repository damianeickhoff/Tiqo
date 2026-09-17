"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Priority } from "@/generated/prisma/enums";
import { setTicketMilestone } from "@/lib/actions/projects";
import { PRIORITY_ORDER } from "@/lib/tickets";
import { Card, Input } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { PriorityBars } from "@/components/tickets/glyphs";
import { TicketPeekDialog } from "@/components/ticket-peek";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  number: number;
  reference: string;
  title: string;
  priority: Priority;
  status: { id: string; name: string; color: string } | null;
  assignee: { id: string; name: string; avatarVariant: number } | null;
  milestoneId: string | null;
};

type Milestone = { id: string; title: string };

const ANY = "";

/**
 * The grid the header and every row share, so a column heading cannot drift
 * away from the column it names. It was a flex row of optional cells, which
 * meant a ticket with no assignee pulled every cell after it out of line.
 */
const GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 " +
  "lg:grid-cols-[112px_minmax(0,1fr)_150px_132px_104px_96px_32px]";

/**
 * The project's tickets, opened without leaving the project.
 *
 * A row opens the quick look; the arrow beside it goes to the ticket itself.
 * Both are worth having — most of the time the question is "what is this", and
 * losing your place in a list of two hundred to answer it is a bad trade.
 *
 * The filters live in the column headings rather than in a bar above them: a
 * row of unlabelled dropdowns makes you read all of them to find the one you
 * want, and every one of them was already the name of a column.
 */
export function ProjectTicketList({
  tickets,
  milestones,
  canManage,
}: {
  tickets: Row[];
  milestones: Milestone[];
  canManage: boolean;
}) {
  const t = useMessages();
  const [peeking, setPeeking] = useState<number | null>(null);
  const [priority, setPriority] = useState(ANY);
  const [status, setStatus] = useState(ANY);
  const [assignee, setAssignee] = useState(ANY);
  const [milestone, setMilestone] = useState(ANY);
  const [query, setQuery] = useState("");

  // The options are what this project actually contains, not every status and
  // person on the desk: a filter offering choices that match nothing is a list
  // of dead ends.
  const statuses = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of tickets) if (row.status) seen.set(row.status.id, row.status.name);
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [tickets]);
  const people = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of tickets) if (row.assignee) seen.set(row.assignee.id, row.assignee.name);
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [tickets]);

  const needle = query.trim().toLowerCase();
  const shown = tickets.filter(
    (ticket) =>
      (!priority || ticket.priority === priority) &&
      (!status || ticket.status?.id === status) &&
      (!assignee || (assignee === "none" ? !ticket.assignee : ticket.assignee?.id === assignee)) &&
      (!milestone ||
        (milestone === "none" ? !ticket.milestoneId : ticket.milestoneId === milestone)) &&
      (!needle ||
        ticket.title.toLowerCase().includes(needle) ||
        ticket.reference.toLowerCase().includes(needle)),
  );

  return (
    <>
      {peeking !== null ? (
        <TicketPeekDialog number={peeking} onClose={() => setPeeking(null)} />
      ) : null}

      <Input
        value={query}
        placeholder={t.tickets.searchTitles}
        aria-label={t.tickets.searchTitles}
        onChange={(event) => setQuery(event.target.value)}
        className="h-9 max-w-sm"
      />

      <Card className="animate-rise overflow-hidden">
        <div className={cn(GRID, "label border-line bg-surface-2 hidden h-9 border-b lg:grid")}>
          <span className="truncate">{t.tickets.colReference}</span>
          <span className="truncate">{t.tickets.colSubject}</span>
          <HeadFilter
            label={t.projects.inMilestone}
            value={milestone}
            onChange={setMilestone}
            options={[
              { id: "none", label: t.projects.noMilestone },
              ...milestones.map((row) => ({ id: row.id, label: row.title })),
            ]}
          />
          <HeadFilter
            label={t.ticket.status}
            value={status}
            onChange={setStatus}
            options={statuses.map((row) => ({ id: row.id, label: row.name }))}
          />
          <HeadFilter
            label={t.ticket.priority}
            value={priority}
            onChange={setPriority}
            options={PRIORITY_ORDER.map((value) => ({
              id: value,
              label: t.vocab.priority[value],
            }))}
          />
          <HeadFilter
            label={t.ticket.assignee}
            value={assignee}
            onChange={setAssignee}
            options={[
              { id: "none", label: t.tickets.unassigned },
              ...people.map((row) => ({ id: row.id, label: row.name })),
            ]}
          />
          <span />
        </div>

        {shown.length === 0 ? (
          <p className="text-text-3 px-5 py-8 text-center text-base">{t.tickets.emptyTitle}</p>
        ) : null}

        <ul className="divide-line divide-y">
          {shown.map((ticket) => (
            <li
              key={ticket.id}
              className={cn(GRID, "hover:bg-surface-2 min-h-[52px] transition-colors")}
            >
              <button
                type="button"
                onClick={() => setPeeking(ticket.number)}
                aria-label={ticket.title}
                className="hidden truncate text-left font-mono text-xs font-medium lg:block"
              >
                <span className="text-text-2">{ticket.reference}</span>
              </button>

              <button
                type="button"
                onClick={() => setPeeking(ticket.number)}
                className="text-md min-w-0 truncate py-3 text-left font-medium lg:py-0"
              >
                {ticket.title}
              </button>

              {/* Filing a ticket under a milestone is a verb on its own with no
                  text field beside it, so it lands at once — the same rule tags
                  follow on a ticket. */}
              <MilestoneCell
                ticketId={ticket.id}
                value={ticket.milestoneId}
                milestones={milestones}
                canManage={canManage}
              />

              <span className="hidden lg:block">
                {ticket.status ? (
                  <span
                    className="inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-sm font-medium"
                    style={{
                      background: `color-mix(in oklab, ${ticket.status.color} 16%, transparent)`,
                      color: `color-mix(in oklab, ${ticket.status.color} 70%, var(--text))`,
                    }}
                  >
                    {ticket.status.name}
                  </span>
                ) : null}
              </span>

              <span className="text-text-2 hidden items-center gap-1.5 text-sm lg:flex">
                <PriorityBars priority={ticket.priority} />
                {t.vocab.priority[ticket.priority]}
              </span>

              <span className="hidden lg:block">
                {ticket.assignee ? (
                  <Avatar
                    name={ticket.assignee.name}
                    variant={ticket.assignee.avatarVariant}
                    size={24}
                  />
                ) : (
                  <span
                    aria-hidden
                    className="border-line block size-6 rounded-full border border-dashed"
                    title={t.tickets.unassigned}
                  />
                )}
              </span>

              <a
                href={`/tickets/${ticket.number}`}
                aria-label={t.projects.openFull}
                title={t.projects.openFull}
                className="text-text-3 hover:text-text rounded-control flex size-8 shrink-0 items-center justify-center transition-colors"
              >
                <ArrowUpRight size={16} />
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

/**
 * A column heading that is also its filter: the name while nothing is chosen,
 * the choice once one is.
 */
function HeadFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "label select-chevron w-full min-w-0 cursor-pointer appearance-none truncate rounded bg-transparent",
        "py-1 pr-4 text-left transition-colors hover:text-[var(--text)] focus:outline-none",
        value && "text-brand-deep",
      )}
    >
      <option value={ANY}>{label}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** The milestone a ticket is filed under, changed from the row. */
function MilestoneCell({
  ticketId,
  value,
  milestones,
  canManage,
}: {
  ticketId: string;
  value: string | null;
  milestones: Milestone[];
  canManage: boolean;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState(value ?? "");

  const name = milestones.find((row) => row.id === chosen)?.title ?? null;

  if (!canManage || milestones.length === 0) {
    return (
      <span className="text-text-2 hidden truncate text-sm lg:block">
        {name ?? <span className="text-text-3">{t.common.none}</span>}
      </span>
    );
  }

  return (
    <select
      value={chosen}
      disabled={pending}
      aria-label={t.projects.inMilestone}
      onChange={(event) => {
        const next = event.target.value;
        setChosen(next);
        startTransition(async () => {
          const result = await setTicketMilestone(ticketId, next || null);
          if (!result.ok) setChosen(value ?? "");
        });
      }}
      className={cn(
        "select-chevron hidden w-full min-w-0 cursor-pointer appearance-none truncate",
        "rounded-control bg-transparent py-1 pr-6 pl-1.5 text-sm transition-colors",
        "hover:bg-surface-3 focus:outline-none disabled:opacity-50 lg:block",
        chosen ? "text-text-2" : "text-text-3",
      )}
    >
      <option value="">{t.projects.noMilestone}</option>
      {milestones.map((row) => (
        <option key={row.id} value={row.id}>
          {row.title}
        </option>
      ))}
    </select>
  );
}
