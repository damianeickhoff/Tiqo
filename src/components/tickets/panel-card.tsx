import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One section of the ticket rail.
 *
 * Every section is the same object — a card on the rail's tint with a 34px
 * header, its name on the left and at most one thing to do on the right. The
 * rail used to be four flush blocks with four different rhythms, and the eye
 * had to work out where one ended; giving them all the same edge means the
 * only thing that varies between them is what they say.
 *
 * The header takes a single `action` rather than children so a section cannot
 * quietly grow a row of controls: anything more than one belongs in the body.
 */
export function PanelCard({
  title,
  action,
  bodyClassName,
  className,
  children,
}: {
  title: string;
  action?: ReactNode;
  /// Padding is the body's business, not the card's — the properties card
  /// runs its rows to the edge, the clock card insets them.
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    // `shrink-0` because the rail is a flex column with a fixed height: without
    // it the cards are squeezed to fit and the last row of the tallest one —
    // which is the Save footer — is clipped away by `overflow-hidden`.
    <section className={cn("card shrink-0 overflow-hidden", className)}>
      <div className="flex h-[34px] items-center justify-between gap-2 px-3.5">
        <h2 className="label">{title}</h2>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/**
 * One property: a quiet label on the left, the value on the right.
 *
 * The value is a control where the thing can be edited and plain text where it
 * cannot, but the row reads the same either way. Here rather than beside the
 * one card that first needed it, because "the rail's rows" is one rhythm and
 * two copies of it drift: the documentation card was a ruled table with an
 * uppercase label column while the ticket beside it was this.
 */
export function PanelRow({
  label,
  dirty = false,
  children,
}: {
  label: string;
  /// Changed in the draft and not yet saved, tinted so the eye can find what
  /// Save is about to write.
  dirty?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-9 grid-cols-[78px_minmax(0,1fr)] items-center gap-2">
      <span className="text-text-3 pl-2 text-sm">{label}</span>
      <span
        className={cn(
          "rounded-control relative flex min-h-9 min-w-0 items-center",
          dirty &&
            "bg-[var(--brand-tint)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--brand)_45%,transparent)]",
        )}
      >
        {children}
      </span>
    </div>
  );
}

/** A value that cannot be changed: the same shape as the controls, no chevron. */
export function PanelValue({
  children,
  muted,
  wrap = false,
  className,
}: {
  children: ReactNode;
  muted?: boolean;
  /// A value that is a sentence rather than a name. Cut in half, the rule the
  /// row exists to state is the half that goes — so it runs on instead.
  wrap?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 px-2 text-base font-medium",
        wrap ? "min-h-8 py-1 leading-snug" : "h-8 truncate",
        muted && "text-text-3 font-normal",
        className,
      )}
    >
      {children}
    </span>
  );
}
