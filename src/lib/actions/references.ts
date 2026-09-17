"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canUseDesk, canViewCis, canViewDocs } from "@/lib/permissions";
import { ticketVisibilityFilter } from "@/lib/permissions";
import { docHref } from "@/lib/docs";
import type { ReferenceKind } from "@/lib/references";

export type Suggestion = {
  kind: ReferenceKind;
  id: string;
  href: string;
  label: string;
  hint: string;
};

/** Five is what fits under a caret without becoming a page of its own. */
const LIMIT = 5;

/**
 * What someone might mean by what they have typed so far.
 *
 * `#` searches tickets, pages, assets and projects, `@` searches people. Newest
 * first, because
 * a reference is nearly always to something recent — the ticket you are looking
 * at, the one before it, the project you are in.
 *
 * A requester only ever sees their own tickets here, through the same filter
 * the queue uses. Autocomplete that quietly lists titles someone may not read
 * is a leak with a friendly face.
 */
export async function suggestReferences(sigil: "#" | "@", query: string): Promise<Suggestion[]> {
  const user = await requireUser();
  const needle = query.trim();

  if (sigil === "@") {
    const people = await prisma.user.findMany({
      where: {
        isActive: true,
        // Not yourself: a mention exists to tell someone something they would
        // otherwise miss, and you already know what you just wrote.
        id: { not: user.id },
        ...(needle
          ? {
              OR: [
                { name: { contains: needle, mode: "insensitive" } },
                { username: { contains: needle, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: LIMIT,
      select: { id: true, name: true, username: true },
    });

    return people.map((person) => ({
      kind: "user" as const,
      id: person.id,
      href: `/people/${person.id}`,
      label: person.username,
      hint: person.name,
    }));
  }

  // Digits and spaces mean a reference is being typed; anything else is a
  // search for the thing by name.
  const [tickets, projects, docs, assets] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        ...ticketVisibilityFilter(user),
        ...(needle
          ? {
              OR: [
                { reference: { contains: needle, mode: "insensitive" } },
                { title: { contains: needle, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: { id: true, number: true, reference: true, title: true },
    }),
    canUseDesk(user)
      ? prisma.project.findMany({
          where: {
            isArchived: false,
            ...(needle
              ? {
                  OR: [
                    { key: { contains: needle, mode: "insensitive" } },
                    { name: { contains: needle, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: { key: "asc" },
          take: LIMIT,
          select: { key: true, name: true },
        })
      : Promise.resolve([]),
    canViewDocs(user)
      ? prisma.doc.findMany({
          where: {
            // A page nobody should be following any more is not one to offer as
            // a reference; it is still reachable by its address.
            archivedAt: null,
            ...(needle
              ? {
                  OR: [
                    { title: { contains: needle, mode: "insensitive" } },
                    { summary: { contains: needle, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: { updatedAt: "desc" },
          take: LIMIT,
          select: { slug: true, title: true, summary: true, space: { select: { key: true } } },
        })
      : Promise.resolve([]),
    canViewCis(user)
      ? prisma.configurationItem.findMany({
          // By name, like the register's own search box: the attributes are a
          // JSON blob, and a scan through them per keystroke under a caret is
          // the wrong place to pay for that.
          where: needle ? { name: { contains: needle, mode: "insensitive" } } : {},
          orderBy: { name: "asc" },
          take: LIMIT,
          select: { id: true, name: true, type: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  return interleave<Suggestion>(
    [
      tickets.map((ticket) => ({
        kind: "ticket" as const,
        id: String(ticket.number),
        href: `/tickets/${ticket.number}`,
        label: ticket.reference,
        hint: ticket.title,
      })),
      docs.map((doc) => ({
        kind: "doc" as const,
        id: `${doc.space.key}/${doc.slug}`,
        href: docHref(doc.space.key, doc.slug),
        label: doc.title,
        hint: doc.summary ?? doc.space.key,
      })),
      assets.map((asset) => ({
        kind: "asset" as const,
        id: asset.id,
        href: `/cmdb/${asset.id}`,
        label: asset.name,
        hint: asset.type.name,
      })),
      projects.map((project) => ({
        kind: "project" as const,
        id: project.key,
        href: `/projects/${project.key}`,
        label: project.key,
        hint: project.name,
      })),
    ],
    LIMIT,
  );
}

/**
 * One from each kind in turn, until the list is full.
 *
 * Concatenating instead would mean a desk with a thousand tickets never sees a
 * document under the caret: five matching tickets fill five places before the
 * other two kinds are reached. Order within a kind is still the query's, so the
 * best ticket is offered before the second-best document.
 */
function interleave<T>(groups: T[][], limit: number): T[] {
  const taken: T[] = [];
  for (let round = 0; taken.length < limit; round += 1) {
    const before = taken.length;
    for (const group of groups) {
      const item = group[round];
      if (item !== undefined && taken.length < limit) taken.push(item);
    }
    if (taken.length === before) break;
  }
  return taken;
}
