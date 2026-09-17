import { Check } from "lucide-react";
import { daysUntil } from "@/lib/projects";
import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type TrackMilestone = {
  id: string;
  title: string;
  dueOn: Date | null;
  reachedAt: Date | null;
  total: number;
  done: number;
};

/**
 * The dated points in order, the reached ones filled, the next one ringed.
 *
 * A track rather than a list: what a reader wants from a project's milestones
 * is where it has got to, and a list of five lines with dates in them makes you
 * work that out yourself. Laid out along the page on the overview, where it is
 * one band under the heading, and down the side on the milestones page, where
 * the cards beside it are the detail.
 */
export function MilestoneTrack({
  milestones,
  day,
  t,
  orientation = "horizontal",
}: {
  milestones: TrackMilestone[];
  day: Intl.DateTimeFormat;
  t: Messages;
  orientation?: "horizontal" | "vertical";
}) {
  const nextIndex = milestones.findIndex((milestone) => !milestone.reachedAt);
  const reached = milestones.filter((milestone) => milestone.reachedAt).length;
  // Half a step short of the next point: the line stops at what is being worked
  // on rather than claiming it, which is the difference the ring makes.
  const progress =
    milestones.length > 1
      ? (Math.max(0, reached - (nextIndex >= 0 ? 0.5 : 0)) / (milestones.length - 1)) * 100
      : 0;

  const stateOf = (index: number) =>
    milestones[index]!.reachedAt ? "done" : index === nextIndex ? "now" : "todo";

  if (orientation === "vertical") {
    return (
      <ol className="border-line-strong relative mt-4 ml-1.5 border-l-2 pl-5">
        <span
          aria-hidden
          className="bg-brand absolute top-0 -left-0.5 w-0.5"
          style={{ height: `${Math.min(100, progress)}%` }}
        />
        {milestones.map((milestone, index) => (
          <li key={milestone.id} className="relative pb-4 last:pb-0">
            <Dot state={stateOf(index)} className="absolute top-0.5 -left-[27px]" />
            <p
              className={cn(
                "truncate text-base",
                stateOf(index) === "now" ? "font-semibold" : "font-medium",
                stateOf(index) === "todo" && "text-text-2",
              )}
              title={milestone.title}
            >
              {milestone.title}
            </p>
            <Meta milestone={milestone} state={stateOf(index)} day={day} t={t} />
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="relative mt-4 pt-1">
      <span aria-hidden className="bg-line-strong absolute inset-x-2 top-3 h-0.5" />
      <span
        aria-hidden
        className="bg-brand absolute top-3 left-2 h-0.5"
        style={{ width: `calc(${Math.min(100, progress)}% - 1rem)` }}
      />
      <ol
        className="relative grid gap-3"
        style={{ gridTemplateColumns: `repeat(${milestones.length}, minmax(0, 1fr))` }}
      >
        {milestones.map((milestone, index) => (
          <li key={milestone.id} className="min-w-0">
            <Dot state={stateOf(index)} />
            <p
              className={cn(
                "mt-2 truncate text-sm",
                stateOf(index) === "now" ? "font-semibold" : "font-medium",
                stateOf(index) === "todo" && "text-text-2",
              )}
              title={milestone.title}
            >
              {milestone.title}
            </p>
            <Meta milestone={milestone} state={stateOf(index)} day={day} t={t} counted />
          </li>
        ))}
      </ol>
    </div>
  );
}

type State = "done" | "now" | "todo";

function Dot({ state, className }: { state: State; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 items-center justify-center rounded-full",
        state === "done" && "bg-brand text-[var(--brand-ink)]",
        state === "now" && "bg-bg border-brand border-[3px] shadow-[0_0_0_4px_var(--brand-tint)]",
        state === "todo" && "bg-surface-3 border-line-strong border-2",
        className,
      )}
    >
      {state === "done" ? <Check size={10} strokeWidth={3} /> : null}
    </span>
  );
}

/** The date under a point, and whether it is a date anyone has to act on. */
function Meta({
  milestone,
  state,
  day,
  t,
  counted = false,
}: {
  milestone: TrackMilestone;
  state: State;
  day: Intl.DateTimeFormat;
  t: Messages;
  /// The overview has room for the ticket tally under the date; the rail does not.
  counted?: boolean;
}) {
  const left = milestone.dueOn ? daysUntil(milestone.dueOn) : null;
  const late = left !== null && left < 0 && state !== "done";

  return (
    <>
      <p
        className={cn("mt-0.5 truncate font-mono text-xs", late ? "text-negative" : "text-text-3")}
      >
        {milestone.dueOn ? day.format(milestone.dueOn) : t.projects.noDates}
        {/* "26 Sep" answers when; "today" answers whether it matters this
            morning, and only the second one makes anybody move. */}
        {left === 0 && state !== "done" ? ` · ${t.projects.today}` : ""}
        {left === 1 && state !== "done" ? ` · ${t.projects.tomorrow}` : ""}
        {late ? ` · ${t.projects.overdueBy(-left!)}` : ""}
      </p>
      {counted && milestone.total > 0 ? (
        <p className="text-text-3 mt-0.5 truncate font-mono text-xs">
          {t.projects.milestoneOf(milestone.done, milestone.total)}
        </p>
      ) : null}
    </>
  );
}
