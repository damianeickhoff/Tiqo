import "server-only";

import { prisma } from "@/lib/prisma";
import { ticketVisibilityFilter } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";
import type { CiLifecycle } from "@/generated/prisma/enums";

export type TicketAsset = {
  id: string;
  name: string;
  lifecycle: CiLifecycle;
  type: { name: string; color: string; icon: string | null };
  /// Other tickets still open against this same asset. The "what else is broken
  /// on this host" number, and the reason the register is worth keeping.
  alsoOpen: number;
  /// The same question one hop out: something that depends on this asset has
  /// open tickets of its own. One level only — a full transitive closure on
  /// every ticket render is a query nobody should pay for, and two levels of
  /// indirection is where the guesses start.
  nearby: { name: string; count: number } | null;
};

/** A ticket still in play, said the way every other call site in the app says
 *  it. It had its own wording here, which is how one page ends up counting
 *  something the next page does not. */
const OPEN = { status: { is: { settles: false } } } as const;

/**
 * The assets a ticket is about, and what else is going on around them.
 *
 * Three queries whatever the ticket carries, rather than a pair per asset: the
 * counts are the point of the feature, and paying for them per row is how a
 * good idea becomes the slowest page in the app.
 */
export async function assetsOnTicket(
  ticketId: string,
  /// Whose view of "what else is open" this is. Without it the counts would
  /// tell somebody how many tickets exist that they are not allowed to read,
  /// which is most of what those tickets are.
  user: SessionUser,
): Promise<TicketAsset[]> {
  const openAndVisible = { ticket: { ...OPEN, ...ticketVisibilityFilter(user) } };

  const rows = await prisma.ticketCi.findMany({
    where: { ticketId },
    orderBy: { addedAt: "asc" },
    select: {
      item: {
        select: {
          id: true,
          name: true,
          lifecycle: true,
          type: { select: { name: true, color: true, icon: true } },
        },
      },
    },
  });
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.item.id);

  const [directly, dependants] = await Promise.all([
    prisma.ticketCi.groupBy({
      by: ["itemId"],
      where: { itemId: { in: ids }, ticketId: { not: ticketId }, ...openAndVisible },
      _count: { itemId: true },
    }),
    // What leans on these assets. `A depends on B` is stored from A, so the
    // things that depend on our asset are the *sources* of rows pointing at it.
    prisma.ciRelation.findMany({
      where: { kind: "DEPENDS_ON", targetId: { in: ids } },
      select: { targetId: true, source: { select: { id: true, name: true } } },
    }),
  ]);

  const openOn = new Map(directly.map((row) => [row.itemId, row._count.itemId]));

  const dependantIds = [...new Set(dependants.map((relation) => relation.source.id))];
  const openNearby = dependantIds.length
    ? await prisma.ticketCi.groupBy({
        by: ["itemId"],
        where: { itemId: { in: dependantIds }, ticketId: { not: ticketId }, ...openAndVisible },
        _count: { itemId: true },
      })
    : [];
  const nearbyCount = new Map(openNearby.map((row) => [row.itemId, row._count.itemId]));

  return rows.map(({ item }) => {
    // The loudest neighbour, not all of them: the line exists to make somebody
    // look, and a list of five names is one nobody reads to the end of.
    let nearby: TicketAsset["nearby"] = null;
    for (const relation of dependants) {
      if (relation.targetId !== item.id) continue;
      const count = nearbyCount.get(relation.source.id) ?? 0;
      if (count > 0 && count > (nearby?.count ?? 0)) {
        nearby = { name: relation.source.name, count };
      }
    }

    return {
      id: item.id,
      name: item.name,
      lifecycle: item.lifecycle,
      type: item.type,
      alsoOpen: openOn.get(item.id) ?? 0,
      nearby,
    };
  });
}
