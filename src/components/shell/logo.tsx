/**
 * The mark is a ticket stub with a punched notch, and the counter inside it is
 * the queue: three bars rising toward the response target — the same idea the
 * heat spine uses on every row.
 */
export function Logo({ size = 30, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        role="img"
        aria-label="Tiqo"
        className="shrink-0"
      >
        <defs>
          {/* The notch is cut out of the tile rather than drawn over it, so the
              mark keeps its shape on any background. */}
          <mask id="tiqo-notch">
            <rect x="0" y="0" width="32" height="32" rx="9" fill="white" />
            <circle cx="32" cy="16" r="4.5" fill="black" />
            <circle cx="0" cy="16" r="4.5" fill="black" />
          </mask>
        </defs>

        <rect
          x="0"
          y="0"
          width="32"
          height="32"
          rx="9"
          fill="var(--brand)"
          mask="url(#tiqo-notch)"
        />

        <g fill="var(--brand-ink)">
          <rect x="9" y="17" width="3.2" height="6" rx="1.6" opacity="0.55" />
          <rect x="14.4" y="13" width="3.2" height="10" rx="1.6" opacity="0.75" />
          <rect x="19.8" y="9" width="3.2" height="14" rx="1.6" />
        </g>
      </svg>

      {wordmark ? (
        <span
          // Scales with the mark so the lockup keeps its proportions at any size.
          style={{ fontSize: Math.round(size * 0.55) }}
          className="leading-none font-extrabold tracking-[-0.03em]"
        >
          Tiqo
        </span>
      ) : null}
    </span>
  );
}
