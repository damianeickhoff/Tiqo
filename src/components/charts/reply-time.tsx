import type { ReplyTimes } from "@/lib/analytics";
import { messagesFor } from "@/lib/i18n";

/**
 * How long people wait for an answer.
 *
 * A median per day, with the period's own median as the headline. Days nobody
 * answered anything are a gap in the line rather than a zero: "we replied in
 * no time" and "we replied to nothing" are opposite facts and must not draw the
 * same shape.
 *
 * Thin marks, no filled area, no dots on every point. The line is the finding;
 * everything else is furniture.
 */
export function ReplyTime({ data, locale = "en-GB" }: { data: ReplyTimes; locale?: string }) {
  const t = messagesFor(locale);
  const points = data.series;

  const values = points
    .map((point) => point.hours)
    .filter((hours): hours is number => hours !== null);
  if (values.length === 0) {
    return <p className="text-text-3 px-5 pb-5 text-base">{t.dashboard.replyTimeEmpty}</p>;
  }

  const top = Math.max(...values, 1);
  const W = 100;
  const H = 34;
  const x = (index: number) => (points.length === 1 ? W / 2 : (index / (points.length - 1)) * W);
  const y = (hours: number) => H - (hours / top) * (H - 3);

  // Every unbroken run of answered days is its own path, which is what leaves
  // a gap where a day had nothing in it. Built by folding rather than by
  // pushing into an outer variable: nothing here is reassigned once the render
  // has read it.
  const runs = points
    .reduce<{ index: number; hours: number }[][]>(
      (groups, point, index) => {
        if (point.hours === null) return [...groups, []];
        const last = groups.at(-1) ?? [];
        return [...groups.slice(0, -1), [...last, { index, hours: point.hours }]];
      },
      [[]],
    )
    .filter((group) => group.length > 0)
    .map((group) =>
      group
        .map(
          (point, at) =>
            `${at === 0 ? "M" : "L"}${x(point.index).toFixed(2)},${y(point.hours).toFixed(2)}`,
        )
        .join(" "),
    );

  const last = points.at(-1);
  const stamp = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  return (
    <div className="px-5 pb-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="tnum text-2xl leading-none font-extrabold tracking-[-0.02em]">
          {formatHours(data.medianHours, t)}
        </p>
        <p className="text-text-3 text-sm">{t.dashboard.replyTimeMedian(data.answered)}</p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t.dashboard.replyTime}
        className="mt-4 h-[92px] w-full overflow-visible"
      >
        {runs.map((path, index) => (
          <path
            key={index}
            d={path}
            fill="none"
            stroke="var(--brand)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>

      <div className="text-text-3 mt-2 flex justify-between font-mono text-xs">
        <span>{stamp.format(new Date(points[0]!.date))}</span>
        {last ? <span>{stamp.format(new Date(last.date))}</span> : null}
      </div>

      {data.waiting > 0 ? (
        <p className="text-text-2 border-line mt-3 border-t pt-3 text-base">
          {t.dashboard.replyTimeWaiting(data.waiting)}
        </p>
      ) : null}
    </div>
  );
}

/** Minutes under an hour, hours under a day, days after that. */
export function formatHours(hours: number | null, t: ReturnType<typeof messagesFor>) {
  if (hours === null) return "—";
  if (hours < 1) return t.dashboard.minutesShort(Math.max(1, Math.round(hours * 60)));
  if (hours < 24) return t.dashboard.hoursShort(Math.round(hours * 10) / 10);
  return t.dashboard.daysShort(Math.round((hours / 24) * 10) / 10);
}
