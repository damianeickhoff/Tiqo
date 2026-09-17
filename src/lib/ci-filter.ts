import type { Prisma } from "@/generated/prisma/client";

/**
 * What the register is showing, as a query.
 *
 * Here rather than inside the page because the export has to answer with
 * exactly the rows on screen: two copies of "type, lifecycle, group, name
 * contains" is how an export quietly stops matching the list it came from.
 */
export type CiFilters = {
  /// The type being stood in. Not a filter so much as a place, but it narrows
  /// the query the same way.
  typeKey?: string;
  lifecycle?: string;
  /// A team id, or "none" for the assets nobody operates.
  team?: string;
  q?: string;
  /// One of the three views the register ships with. Its ingredients come in
  /// beside it rather than being looked up here, because this file is the half
  /// of the register that runs on the client too.
  view?: string;
  /// The attribute keys this type flags as an expiry, and the window "expiring"
  /// means. Dates are stored as `YYYY-MM-DD`, which compares as text in exactly
  /// the order it compares as a date — which is why it is stored that way.
  expiry?: { keys: string[]; from: string; to: string };
  /// What counts as an open ticket for whoever is looking. Handed in for the
  /// same reason: a count that includes tickets the reader may not open tells
  /// them something about those tickets.
  open?: Prisma.TicketWhereInput;
};

export function ciWhere({
  typeKey,
  lifecycle,
  team,
  q,
  view,
  expiry,
  open,
}: CiFilters): Prisma.ConfigurationItemWhereInput {
  return {
    ...(typeKey ? { type: { is: { key: typeKey } } } : {}),
    ...(lifecycle
      ? { lifecycle: lifecycle as Prisma.ConfigurationItemWhereInput["lifecycle"] }
      : {}),
    ...(team === "none" ? { teamId: null } : team ? { teamId: team } : {}),
    // Name only. The attributes are JSON and searching inside them would be a
    // scan per row to answer a question the filters already answer better.
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    ...viewWhere(view, expiry, open),
  };
}

/**
 * The three shipped views, as query fragments.
 *
 * "Retired" is a lifecycle and overrules whatever the lifecycle chip says,
 * because standing in the view *is* the answer to that question. "Expiring"
 * with nothing flagged matches nothing rather than everything: a desk that has
 * not said which of its dates run out has not said anything runs out, and a
 * view that quietly listed the whole register would be read as if it had.
 */
function viewWhere(
  view: string | undefined,
  expiry: CiFilters["expiry"],
  open: CiFilters["open"],
): Prisma.ConfigurationItemWhereInput {
  if (view === "retired") return { lifecycle: "RETIRED" };
  if (view === "open") return { tickets: { some: { ticket: open ?? {} } } };
  if (view !== "expiring") return {};

  const keys = expiry?.keys ?? [];
  if (keys.length === 0 || !expiry) return { id: { in: [] } };

  return {
    OR: keys.map((key) => ({
      attributes: { path: [key], gte: expiry.from, lte: expiry.to },
    })),
  };
}
