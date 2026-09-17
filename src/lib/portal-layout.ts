import type { PortalBlockKind } from "@/generated/prisma/enums";

/**
 * Where a band lands on the portal's front page.
 *
 * One rule, in one place, because two of them read it: the page, which builds
 * the columns, and the front-page designer, which draws them. When the
 * designer kept its own idea of the layout it showed two bands side by side
 * that the portal stacked, and an admin had no way to know which was lying.
 *
 * Plain data with no imports of its own beyond the enum, so the designer — a
 * client component — can read it without dragging the page's server code into
 * the browser.
 */

/** The bands that ride in the column on the right, whatever width they are given. */
export const RAIL_KINDS: PortalBlockKind[] = ["MY_REQUESTS", "DESK_CARD"];

/**
 * A band is either across the page or in the left column, and the span says
 * which: six is the row, anything less is the column. The number survives
 * from when the page was six independent columns, and stays because it is what
 * the database holds.
 */
export const COLUMNS = 6;
export const COLUMN_SPAN = 3;

/** A band that takes the whole row, breaking the two columns apart under it. */
export function isFullWidth(block: { kind: PortalBlockKind; span: number }) {
  // The search band carries the shelf, and both run the width of the page
  // whatever the span says.
  return block.kind === "HERO" || block.span >= COLUMNS;
}
