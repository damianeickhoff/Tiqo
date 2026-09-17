"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  canViewCis,
  canViewDirectory,
  canViewDocs,
  isStaff,
  ticketVisibilityFilter,
} from "@/lib/permissions";
import { docSearchWhere } from "@/lib/docs";
import { normaliseReference } from "@/lib/tickets";
import type { CiLifecycle } from "@/generated/prisma/enums";

/** Short enough that the popup never becomes a page of its own. */
const PER_GROUP = 5;

export type SearchResults = {
  tickets: {
    number: number;
    reference: string;
    title: string;
    status: { name: string; color: string } | null;
  }[];
  people: { id: string; name: string; avatarVariant: number; jobTitle: string | null }[];
  projects: { id: string; key: string; name: string; color: string }[];
  docs: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    space: { key: string; name: string; color: string };
  }[];
  assets: {
    id: string;
    name: string;
    lifecycle: CiLifecycle;
    type: { name: string; color: string; icon: string | null };
  }[];
};

const EMPTY: SearchResults = { tickets: [], people: [], projects: [], docs: [], assets: [] };

/**
 * What the top bar looks through: tickets, people, projects and documents at
 * once.
 *
 * Each group is filtered by what the searcher may see rather than filtered out
 * afterwards — a requester searching "Ada" gets their own tickets and nothing
 * else, because the directory is not theirs to read.
 */
export async function searchEverything(query: string): Promise<SearchResults> {
  const user = await requireUser();

  const q = query.trim();
  if (q.length < 2) return EMPTY;

  const like = { contains: q, mode: "insensitive" as const };
  const number = /^#?\d+$/.test(q) ? Number.parseInt(q.replace("#", ""), 10) : null;

  const [tickets, people, projects, docs, assets] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        ...ticketVisibilityFilter(user),
        OR: [
          ...(number === null ? [] : [{ number }]),
          { reference: like },
          { title: like },
          { description: like },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: PER_GROUP,
      select: {
        number: true,
        reference: true,
        title: true,
        status: { select: { name: true, color: true } },
      },
    }),

    canViewDirectory(user)
      ? prisma.user.findMany({
          where: {
            isActive: true,
            OR: [{ name: like }, { email: like }, { username: like }, { company: like }],
          },
          orderBy: { name: "asc" },
          take: PER_GROUP,
          select: { id: true, name: true, avatarVariant: true, jobTitle: true },
        })
      : [],

    isStaff(user)
      ? prisma.project.findMany({
          where: { OR: [{ key: like }, { name: like }, { description: like }] },
          orderBy: [{ isArchived: "asc" }, { key: "asc" }],
          take: PER_GROUP,
          select: { id: true, key: true, name: true, color: true },
        })
      : [],

    canViewDocs(user)
      ? prisma.doc.findMany({
          where: docSearchWhere(q),
          orderBy: { updatedAt: "desc" },
          take: PER_GROUP,
          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            space: { select: { key: true, name: true, color: true } },
          },
        })
      : [],

    canViewCis(user)
      ? prisma.configurationItem.findMany({
          // By name only, like the register's own search box: the attributes are
          // a JSON blob, and a scan through them per row would make the palette
          // the slowest thing in the app to answer a question the register
          // answers better.
          where: { name: like },
          orderBy: { name: "asc" },
          take: PER_GROUP,
          select: {
            id: true,
            name: true,
            lifecycle: true,
            type: { select: { name: true, color: true, icon: true } },
          },
        })
      : [],
  ]);

  return { tickets, people, projects, docs, assets };
}

/**
 * The ticket a pasted reference names, if it names one.
 *
 * A reference is an identifier, not a search term: somebody who pastes
 * "INC-2609 0004" has the ticket in mind already, and a list of one result with
 * their own paste at the top of it is a step they should not have to take.
 * Visibility still decides — an unreadable ticket is simply not found.
 */
export async function findByReference(query: string): Promise<number | null> {
  const user = await requireUser();

  const reference = normaliseReference(query);
  if (!reference) return null;

  const ticket = await prisma.ticket.findFirst({
    where: { ...ticketVisibilityFilter(user), reference },
    select: { number: true },
  });
  return ticket?.number ?? null;
}
