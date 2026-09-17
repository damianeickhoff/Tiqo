import { messagesFor } from "@/lib/i18n";

export type CategorySlice = { id: string; name: string; color: string; count: number };

/**
 * Where the open work sits, by category.
 *
 * A half circle rather than a full one: five segments read better along an arc
 * than around a ring, and the flat bottom leaves the middle free for the figure
 * that actually gets read.
 *
 * The largest segment is drawn thicker. That is a second encoding of the same
 * fact the angle already carries — deliberately, because "which is the biggest"
 * is the one question this chart exists to answer, and at these sizes a few
 * degrees of arc is not a reliable answer on its own.
 *
 * Each segment wears its tag's own colour. The alternative — a fixed
 * categorical ramp — would mean a tag is one colour on its chip in the queue
 * and another here, and a filter that changes which five appear would repaint
 * the survivors. Colour follows the tag, so it never moves.
 */
export function CategoryArc({
  data,
  untagged,
  locale = "en-GB",
}: {
  data: CategorySlice[];
  untagged: number;
  locale?: string;
}) {
  const t = messagesFor(locale);
  const total = data.reduce((sum, slice) => sum + slice.count, 0);

  if (total === 0) {
    return <p className="text-text-3 px-5 pb-5 text-base">{t.dashboard.categoriesEmpty}</p>;
  }

  // Only a clear leader is drawn thicker. With everything level there is no
  // biggest, and thickening all five says "these are all the biggest", which is
  // both true and useless — better that none of them shouts.
  const biggest = Math.max(...data.map((slice) => slice.count));
  const leader = data.filter((slice) => slice.count === biggest).length === 1 ? biggest : null;

  // A half circle of radius 40 in a 100-wide box, drawn as stroked arcs so the
  // thickness of each one can differ.
  const R = 38;
  const CX = 50;
  const CY = 46;
  const GAP = 2.5; // degrees of surface showing between segments
  const usable = 180 - GAP * (data.length - 1);

  // Each segment starts where every one before it ended, so its own offset is
  // the running total rather than a variable walked along the list.
  const arcs = data.map((slice, index) => {
    const before = data
      .slice(0, index)
      .reduce((sum, earlier) => sum + (earlier.count / total) * usable + GAP, 0);
    const from = 180 - before;
    return {
      slice,
      from,
      to: from - (slice.count / total) * usable,
      thick: slice.count === leader,
    };
  });

  return (
    <div className="px-5 pb-5">
      <div className="relative mx-auto max-w-[240px]">
        <svg viewBox="0 0 100 52" role="img" aria-label={t.dashboard.categories} className="w-full">
          {arcs.map(({ slice, from, to, thick }) => (
            <path
              key={slice.id}
              d={arcPath(CX, CY, R, from, to)}
              fill="none"
              stroke={slice.color}
              strokeWidth={thick ? 11 : 7}
              strokeLinecap="round"
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center">
          <p className="text-text-3 text-xs">{t.dashboard.categoriesTotal}</p>
          <p className="tnum text-2xl leading-tight font-extrabold tracking-[-0.02em]">{total}</p>
        </div>
      </div>

      {/* Always a legend: five segments cannot be told apart by colour alone,
          and the counts are half the point. */}
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {arcs.map(({ slice, thick }) => (
          <li key={slice.id} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="rounded-chip size-2.5 shrink-0"
              style={{ background: slice.color }}
            />
            <span className={`min-w-0 flex-1 truncate ${thick ? "font-semibold" : ""}`}>
              {slice.name}
            </span>
            <span className="tnum text-text-2 shrink-0">{slice.count}</span>
          </li>
        ))}
      </ul>

      {untagged > 0 ? (
        <p className="text-text-3 mt-3 pt-2.5 text-sm">
          {t.dashboard.categoriesUntagged(untagged)}
        </p>
      ) : null}
    </div>
  );
}

/** A stroked arc from one angle to another, both in degrees, 180 = left. */
function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const point = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(cx + r * Math.cos(rad)).toFixed(2)},${(cy - r * Math.sin(rad)).toFixed(2)}`;
  };
  // Always the short way round: no segment of a half circle can exceed 180°.
  return `M${point(from)} A${r},${r} 0 0 1 ${point(to)}`;
}
