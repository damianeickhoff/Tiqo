/**
 * The register, while it is being counted.
 *
 * The only loading state in `(app)`, and it earns the exception: every filter
 * and every page of the register is a fresh server render, and a table that
 * simply goes blank between two of them reads as a register that has just lost
 * everything in it. The shape is the page's own — a rail, a bar, and rows — so
 * nothing moves when the real one arrives.
 */
export default function Loading() {
  return (
    <div aria-busy className="lg:flex">
      <div className="border-line bg-chrome hidden lg:block lg:w-[220px] lg:border-r" />

      <div className="min-w-0 flex-1">
        <div className="border-line h-[45px] border-b" />

        <ul className="divide-line divide-y">
          {Array.from({ length: 8 }, (_, row) => (
            <li key={row} className="flex items-center gap-3 px-5 py-2.5 lg:px-6">
              <span className="bg-surface-3 size-3.5 shrink-0 animate-pulse rounded-full" />
              <span
                className="bg-surface-3 h-3.5 animate-pulse rounded-full"
                // Uneven, because a column of identical bars reads as a chart.
                style={{ width: `${34 - (row % 4) * 6}%` }}
              />
              <span className="bg-surface-3 ml-auto h-3.5 w-16 animate-pulse rounded-full" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
