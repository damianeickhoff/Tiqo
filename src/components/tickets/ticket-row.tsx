import Link from "next/link";
import { MessageSquare, OctagonX, Paperclip } from "lucide-react";
import type { Priority, TicketType } from "@/generated/prisma/enums";
import {
  deadlineOf,
  hoursToTarget,
  isPastDue,
  isSettled,
  PRIORITY_META,
  type TicketStatus,
} from "@/lib/tickets";
import { dateLocaleOf, getClock, getMessages, getSettings } from "@/lib/settings";
import { Avatar } from "@/components/avatar";
import { HeatSpine, PriorityBars } from "@/components/tickets/indicators";
import { cn } from "@/lib/utils";

export type TicketRowData = {
  id: string;
  number: number;
  reference: string;
  title: string;
  status: TicketStatus;
  priority: Priority;
  type: TicketType;
  createdAt: Date;
  dueDate: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  /// Optional, like on `Clocked`: without them the countdown simply ignores
  /// time the ticket spent parked, which is the old behaviour of this row.
  pausedMinutes?: number;
  pausedSince?: Date | null;
  project: { key: string; color: string } | null;
  assignee: { name: string; avatarVariant: number } | null;
  /// Who asked. Shown beside who is answering, because "whose problem is this"
  /// and "who has it" are two different questions about one row.
  reporter?: { name: string; avatarVariant: number } | null;
  /// How much has been said about it.
  replies?: number;
  /// How many files are on it, the reply that carried them included.
  attachments?: number;
  labels: { id: string; name: string; color: string }[];
  /// Only a change carries a plan. Rows fetch the steps' state rather than a
  /// count, so "3 of 5" needs one select and no second query.
  steps?: { doneAt: Date | null }[];
  /// Whether something still open is blocking it. Computed from the links by
  /// whoever builds the row rather than stored, because it is another ticket's
  /// state and a copy of it would be wrong the moment that ticket closed.
  blocked?: boolean;
};

/**
 * The width of every cell that is not the title, so the header strip above the
 * list and the rows below it cannot drift apart. The title takes what is left.
 *
 * Each one is a custom property rather than a number: the widths belong to
 * whoever is reading the queue, and `ticket-table` lets them drag the edges.
 * The values are set on the container; these are only the names.
 */
export const COLUMNS = {
  reference: "@sm:w-[var(--col-reference)]",
  subject: "@sm:w-[var(--col-subject)]",
  plan: "w-[var(--col-plan)] shrink-0",
  status: "w-[var(--col-status)] shrink-0",
  priority: "w-[var(--col-priority)] shrink-0",
  requester: "w-[var(--col-requester)] shrink-0",
  assignee: "w-[var(--col-assignee)] shrink-0",
  replies: "w-[var(--col-replies)] shrink-0",
  created: "w-[var(--col-created)] shrink-0",
  due: "w-[var(--col-due)] shrink-0",
  left: "w-[var(--col-left)] shrink-0",
} as const;

/**
 * The container width at which each column earns its place.
 *
 * Beside the widths and shared with the header, because a heading that appears
 * one breakpoint before its column is a heading over the wrong cells.
 */
export const AT = {
  plan: "hidden @lg:block",
  status: "hidden @2xl:flex",
  replies: "hidden @3xl:block",
  priority: "hidden @4xl:block",
  left: "hidden @4xl:block",
  requester: "hidden @5xl:block",
  created: "hidden @5xl:block",
  due: "hidden @6xl:block",
} as const;

/**
 * The subject: a column with a width of its own, like every other.
 *
 * It used to take whatever the others left, which on a wide screen made the one
 * cell anybody actually reads the narrowest on the row. Below @sm the row is a
 * stack rather than a table and the title simply takes the line.
 */
export const SUBJECT = "min-w-0 overflow-hidden @sm:shrink-0";

/** A date in a column: short enough for 76px, dated enough to report on. */
const DAY: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };

/**
 * A reference, in one colour.
 *
 * The type prefix used to carry the type's hue. It put a third palette on a
 * row that already says the type in words and the priority in bars, and a
 * coloured word at the start of every line reads as a warning rather than as a
 * label. The prefix keeps its weight, which is what made it scannable.
 */
export function Reference({ reference, className }: { reference: string; className?: string }) {
  const dash = reference.indexOf("-");
  const prefix = dash > 0 ? reference.slice(0, dash) : reference;
  const rest = dash > 0 ? reference.slice(dash) : "";
  return (
    <span className={cn("text-text-3 font-mono text-sm whitespace-nowrap", className)}>
      <span className="font-semibold">{prefix}</span>
      {rest}
    </span>
  );
}

/**
 * Somebody in a people column: the face, then the name.
 *
 * The face on its own was a guess. Eight illustrated variants are enough to
 * tell a roster apart once you already know it and nothing at all before that,
 * and a hover title is no answer in a list being scanned. The name says who;
 * the face is what makes a row recognisable on the way back to it.
 *
 * The name truncates rather than wraps — these columns are the reader's to
 * widen if their roster needs more than a first name.
 */
function Person({ person }: { person: { name: string; avatarVariant: number } }) {
  return (
    <span className="flex items-center gap-1.5">
      <Avatar name={person.name} variant={person.avatarVariant} size={22} />
      <span className="text-text-2 min-w-0 truncate text-sm">{person.name}</span>
    </span>
  );
}

/** Coarse on purpose: a queue cell has room for "38m", "4h" or "2d", not for
 *  all three at once. Matches the chip on the ticket page. */
function briefly(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

export async function TicketRow({ ticket, index = 0 }: { ticket: TicketRowData; index?: number }) {
  void index;
  const [clock, settings, t] = await Promise.all([getClock(), getSettings(), getMessages()]);
  const day = new Intl.DateTimeFormat(dateLocaleOf(settings), DAY);

  const plan = ticket.steps?.length
    ? { total: ticket.steps.length, done: ticket.steps.filter((step) => step.doneAt).length }
    : null;

  // What is actually on fire, made findable in a long list. A settled ticket
  // stops shouting whatever it was raised as — the row is about what still
  // needs doing, and a resolved urgent one needs nothing.
  const loud =
    !isSettled(ticket.status) && (ticket.priority === "URGENT" || ticket.priority === "HIGH");
  const color = PRIORITY_META[ticket.priority].color;

  // The countdown cell. Settled tickets and the kinds with no response target
  // get an em dash rather than a number that would mean nothing; a parked one
  // goes amber, the same signal the ticket's own clock card uses.
  const settled = isSettled(ticket.status);
  const remaining = settled ? null : hoursToTarget(ticket, clock);
  const paused = Boolean(ticket.status?.pausesClock) && !settled;
  const leftLabel =
    remaining === null ? "—" : `${remaining < 0 ? "−" : ""}${briefly(Math.abs(remaining))}`;
  const leftTone =
    remaining === null
      ? "var(--text-3)"
      : paused
        ? "var(--brand-deep)"
        : remaining < 0
          ? color
          : "var(--text-2)";

  // The day the promise runs out — derived for an incident, set by hand for
  // anything else — and rose once it has gone by.
  const due = settled ? null : deadlineOf(ticket, clock).date;
  const dueTone = due && isPastDue(due) ? "var(--negative)" : "var(--text-3)";

  return (
    <li className="border-line border-b last:border-b-0">
      <Link
        href={`/tickets/${ticket.number}`}
        className="group hover:bg-surface-2 relative flex items-stretch gap-3 transition-[background-color] duration-100"
        // A wash rather than a border or a badge: it colours the whole row
        // without adding a thing to read, and stays faint enough that ten of
        // them in a row do not become a block of colour.
        style={
          loud
            ? {
                background: `color-mix(in oklab, ${color} ${ticket.priority === "URGENT" ? 8 : 5}%, transparent)`,
              }
            : undefined
        }
      >
        {/* Inset by 8px so the bar hangs in the row rather than against its
            edge; ticket-columns pads its header by the same amount. One width
            for every row — a bar that is thicker on some of them reads as a
            second signal, and it only ever repeated what the wash says. */}
        <HeatSpine ticket={ticket} className="ml-2" />

        {/* Breakpoints here are container-relative: the same row renders in a
            full-width list and in a half-width dashboard card, and only the
            card's own width should decide how many cells fit.

            Every cell after the title keeps a fixed width whether or not it has
            anything in it, so a column header above the list lines up with the
            rows under it — see `ticket-columns`. The widths live in COLUMNS,
            shared by both. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1 py-2 pr-4 @sm:min-h-11 @sm:flex-row @sm:items-center @sm:gap-3 @sm:py-0">
          <Reference
            reference={ticket.reference}
            className={cn("truncate @sm:shrink-0", COLUMNS.reference)}
          />

          <span className={cn(SUBJECT, COLUMNS.subject, "flex items-center gap-2")}>
            {/* Narrow containers wrap to two lines rather than clip a title to
                nothing; the full-width list keeps one line so rows stay scannable. */}
            <span
              className={cn(
                "line-clamp-2 min-w-0 text-base leading-snug @3xl:line-clamp-none @3xl:block @3xl:truncate",
                loud ? "font-semibold" : "font-medium",
              )}
            >
              {ticket.title}
            </span>
            {/* Beside the title rather than in a column of its own: it is true
                of very few rows, and a column that is empty on forty-nine of
                fifty is width spent on nothing. */}
            {ticket.blocked ? (
              <span title={t.links.blockedTitle} className="flex shrink-0">
                <OctagonX
                  size={13}
                  strokeWidth={2}
                  aria-label={t.links.blocked}
                  className="text-negative"
                />
              </span>
            ) : null}
            {ticket.labels.length ? (
              <span className="hidden shrink-0 gap-1 @lg:flex">
                {ticket.labels.slice(0, 3).map((label) => (
                  <span
                    key={label.id}
                    className="text-text-2 inline-flex h-[18px] items-center gap-1 rounded-full px-1.5 text-xs font-medium"
                    style={{ background: "color-mix(in oklab, var(--text) 6%, transparent)" }}
                  >
                    {label.name}
                  </span>
                ))}
              </span>
            ) : null}
          </span>

          <span className="flex shrink-0 items-center gap-3">
            {/* A change with a plan says how far along it is — the one number
                that answers "is this nearly done?" without opening it. */}
            <span className={cn(AT.plan, COLUMNS.plan, "overflow-hidden")}>
              {plan ? (
                <span
                  className="text-text-3 flex items-center gap-1.5"
                  title={t.plan.progress(plan.done, plan.total)}
                >
                  <span className="bg-surface-3 relative h-1 w-7 overflow-hidden rounded-full">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${(plan.done / plan.total) * 100}%`,
                        background: plan.done === plan.total ? "var(--positive)" : "var(--brand)",
                      }}
                    />
                  </span>
                  <span className="tnum font-mono text-xs">
                    {plan.done}/{plan.total}
                  </span>
                </span>
              ) : null}
            </span>

            <span
              className={cn(
                AT.status,
                COLUMNS.status,
                "items-center gap-1.5 overflow-hidden text-sm",
                ticket.status && !ticket.status.settles ? "text-text-2" : "text-text-3",
              )}
            >
              {/* The name, and only the name. The ring in front of it repeated
                  what the word already said, in a colour a row full of other
                  colours did not need. */}
              <span className="truncate">{ticket.status?.name ?? t.tickets.noStatus}</span>
            </span>

            <span className={cn(AT.priority, COLUMNS.priority, "overflow-hidden")}>
              <PriorityBars priority={ticket.priority} title={t.vocab.priority[ticket.priority]} />
            </span>

            {/* Where the bars will not fit, priority still has to be present —
                a dot carries it, with the label on hover. */}
            <span
              className="size-2 shrink-0 rounded-full @4xl:hidden"
              style={{ background: PRIORITY_META[ticket.priority].color }}
              title={t.vocab.priority[ticket.priority]}
            />

            {/* Who asked, then who is answering. */}
            <span
              className={cn(AT.requester, COLUMNS.requester, "overflow-hidden")}
              title={ticket.reporter?.name}
            >
              {ticket.reporter ? <Person person={ticket.reporter} /> : null}
            </span>

            <span className={cn(COLUMNS.assignee, "overflow-hidden")} title={ticket.assignee?.name}>
              {ticket.assignee ? (
                <Person person={ticket.assignee} />
              ) : (
                <span
                  className="border-line-strong block size-[22px] rounded-full border border-dashed"
                  title={t.tickets.unassigned}
                />
              )}
            </span>

            {/* How much has been said. A ticket with fourteen replies is a
                different object from one with none, whatever its status says. */}
            <span
              className={cn(
                AT.replies,
                COLUMNS.replies,
                "tnum text-text-3 truncate text-right font-mono text-xs",
              )}
              title={t.tickets.colReplies}
            >
              <span className="inline-flex items-center gap-1.5">
                {/* With its number, like the replies beside it. A clip that
                    said only "there are files" put the count in a tooltip,
                    which is a place nobody looks and a phone does not have. */}
                {ticket.attachments ? (
                  <span
                    className="inline-flex items-center gap-1"
                    title={t.ticket.attachCount(ticket.attachments)}
                  >
                    <Paperclip size={11} aria-hidden />
                    {ticket.attachments}
                  </span>
                ) : null}
                {ticket.replies ? (
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare size={11} aria-hidden />
                    {ticket.replies}
                  </span>
                ) : null}
              </span>
            </span>

            {/* Dates, not ages. "18 hr" answers how long ago; a date answers
                which day, and only one of those goes into a report. */}
            <span
              className={cn(
                AT.created,
                COLUMNS.created,
                "tnum text-text-3 truncate text-right font-mono text-xs",
              )}
              title={t.tickets.colCreated}
            >
              {day.format(ticket.createdAt)}
            </span>

            <span
              className={cn(AT.due, COLUMNS.due, "tnum truncate text-right font-mono text-xs")}
              style={{ color: dueTone }}
              title={t.tickets.colDue}
            >
              {due ? day.format(due) : "—"}
            </span>

            {/* How long is left of the promise, not just how old it is: the
                queue is read to decide what to pick up next, and age alone
                cannot say that — an hour-old urgent is later than a day-old
                low. Only where there is a promise to be left of. */}
            <span
              className={cn(
                AT.left,
                COLUMNS.left,
                "tnum truncate text-right font-mono text-xs font-medium",
              )}
              style={{ color: leftTone }}
              title={t.tickets.colLeft}
            >
              {leftLabel}
            </span>
          </span>
        </div>
      </Link>
    </li>
  );
}
