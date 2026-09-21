/**
 * The register, while it is being counted.
 *
 * The only loading state in `(app)`, and it earns the exception: every filter
 * and every page of the register is a fresh server render, and a table that
 * simply goes blank between two of them reads as a register that has just lost
 * everything in it. The shape is the page's own — a head, a views column and a
 * sheet of rows — so nothing moves when the real one arrives.
 */
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col lg:h-[calc(100dvh-var(--bar))] lg:min-h-0">
      <div className="min-h-[52px]" />

      <div className="flex min-h-0 flex-1 flex-col gap-2 pb-5 lg:flex-row lg:gap-5 lg:pr-5">
        <div className="hidden lg:block lg:w-[200px]" />

        <div className="sheet mx-3 flex min-w-0 flex-col overflow-hidden lg:mx-0 lg:min-h-0 lg:flex-1">
          <div className="border-line h-[52px] shrink-0 border-b" />

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
    </div>
  );
}
