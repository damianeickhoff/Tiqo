import { messagesFor } from "@/lib/i18n";

export type ThroughputWeek = { week: string; created: number; resolved: number };

/**
 * Raised against resolved, by week.
 *
 * Side by side rather than stacked. Stacking them would draw a column whose
 * height is "created plus resolved", which is not a quantity anybody has: a
 * ticket raised and resolved in the same week would be counted twice in the
 * same bar. Two independent measures get two bars, and the reading people
 * actually want — are we keeping up — is whether the pairs are level.
 *
 * Weeks, not days: two bars a day across three months is a comb nobody can
 * read, and the question is about the trend rather than about Tuesday.
 */
export function ThroughputBars({
  data,
  locale = "en-GB",
}: {
  data: ThroughputWeek[];
  locale?: string;
}) {
  const t = messagesFor(locale);
  const top = Math.max(1, ...data.flatMap((week) => [week.created, week.resolved]));
  const stamp = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  const raised = data.reduce((sum, week) => sum + week.created, 0);
  const settled = data.reduce((sum, week) => sum + week.resolved, 0);

  return (
    <div className="px-5 pb-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="bg-brand rounded-chip size-2.5" />
          {t.dashboard.raised}
          <span className="tnum text-text-2 font-semibold">{raised}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="bg-positive rounded-chip size-2.5" />
          {t.dashboard.resolved}
          <span className="tnum text-text-2 font-semibold">{settled}</span>
        </span>
      </div>

      <div
        className="mt-4 flex h-[120px] items-end gap-2"
        role="img"
        aria-label={t.dashboard.throughput}
      >
        {data.map((week) => (
          <div key={week.week} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            {/* A 2px gap of surface between the pair, so two short bars do not
                read as one wide one. */}
            <div className="flex h-full w-full items-end justify-center gap-[2px]">
              <Bar
                value={week.created}
                top={top}
                className="bg-brand"
                title={t.dashboard.raisedIn(week.created, stamp.format(new Date(week.week)))}
              />
              <Bar
                value={week.resolved}
                top={top}
                className="bg-positive"
                title={t.dashboard.resolvedIn(week.resolved, stamp.format(new Date(week.week)))}
              />
            </div>
            <span className="text-text-3 w-full truncate text-center font-mono text-xs">
              {stamp.format(new Date(week.week))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({
  value,
  top,
  className,
  title,
}: {
  value: number;
  top: number;
  className: string;
  title: string;
}) {
  return (
    <span
      title={title}
      className={`${className} rounded-t-chip w-full max-w-[13px] transition-[height] duration-500`}
      // A week with nothing in it keeps a hairline, so the column reads as
      // "measured and zero" rather than as missing.
      style={{ height: `${value === 0 ? 1.5 : Math.max(4, (value / top) * 100)}%` }}
    />
  );
}
