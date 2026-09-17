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
