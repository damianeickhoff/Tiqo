import "server-only";

import { prisma } from "@/lib/prisma";
import { getClock } from "@/lib/settings";
import { workingMinutesBetween } from "@/lib/clock";

/**
 * A URL-safe name derived from a title. Uniqueness is settled by the caller
 * appending a suffix, because "what to do about a clash" is a decision about
 * the thing, not about the string.
 */
export function slugify(input: string) {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return base || "item";
}

/** A slug nothing else is using, in the table that asked for it. */
export async function uniqueSlug(
  table: "portalForm" | "portalCategory" | "portalArticle",
  title: string,
  ignoreId?: string,
) {
  const base = slugify(title);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    // Prisma's delegates share this shape, so one lookup covers all three.
    const taken = await (prisma[table] as { findUnique: (args: unknown) => Promise<unknown> })
      .findUnique({ where: { slug }, select: { id: true } })
      .then((row) => (row as { id: string } | null) ?? null);

    if (!taken || taken.id === ignoreId) return slug;
  }

  return `${base}-${Date.now()}`;
}

export type SearchHit =
  | {
      kind: "form";
      id: string;
      slug: string;
      title: string;
      summary: string | null;
      icon: string | null;
      color: string;
      category: string | null;
    }
  | {
      kind: "article";
      id: string;
      slug: string;
      title: string;
      summary: string | null;
      category: string | null;
    };

/**
 * What the portal's search box looks through: the catalogue and the knowledge
 * base at once.
 *
 * Keywords are searched alongside titles because people search with the words
 * they use — "wifi", not "Network connectivity request" — and the keyword list
 * is where a desk writes those down.
 */
/**
 * Answers that match what someone is describing, word by word.
 *
 * `portalSearch` looks for the phrase as typed, which is right for a search box
 * and useless for a subject line: nobody writes a heading, they write "the wifi
 * keeps dropping in the north building". So this one takes the words that carry
 * meaning and ranks an article by how many of them it holds.
 */
export async function articleMatches(query: string, take = 3) {
  const words = [...new Set((query.toLowerCase().match(/\p{L}{3,}/gu) ?? []).slice(0, 12))].filter(
    (word) => !STOP_WORDS.has(word),
  );
  if (words.length === 0) return [];

  const rows = await prisma.portalArticle.findMany({
    where: {
      isPublished: true,
      OR: words.flatMap((word) => [
        { title: { contains: word, mode: "insensitive" as const } },
        { summary: { contains: word, mode: "insensitive" as const } },
        { keywords: { has: word } },
      ]),
    },
    orderBy: [{ views: "desc" }],
    take: 25,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      keywords: true,
      category: { select: { name: true } },
    },
  });

  // How many of the words an article actually holds. A title hit is worth more
  // than a summary hit, because a title is what the article is about.
  const scored = rows.map((article) => {
    const title = article.title.toLowerCase();
    const summary = (article.summary ?? "").toLowerCase();
    let score = 0;
    for (const word of words) {
      if (title.includes(word)) score += 3;
      else if (article.keywords.includes(word)) score += 2;
      else if (summary.includes(word)) score += 1;
    }
    return { article, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, take)
    .map(({ article }): SearchHit => ({
      kind: "article",
      id: article.id,
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      category: article.category?.name ?? null,
    }));
}

/**
 * Words too common to say anything about what a request is about. Short words
 * are already excluded by the three-letter floor, so this only has to catch the
 * longer ones.
 */
const STOP_WORDS = new Set([
  "and",
  "but",
  "for",
  "not",
  "the",
  "was",
  "were",
  "with",
  "this",
  "that",
  "have",
  "has",
  "had",
  "can",
  "cannot",
  "will",
  "would",
  "please",
  "help",
  "issue",
  "problem",
  "een",
  "het",
  "van",
  "voor",
  "met",
  "niet",
  "aan",
  "ook",
  "maar",
  "graag",
  "probleem",
  "melding",
]);

export async function portalSearch(query: string, take = 20): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const like = { contains: q, mode: "insensitive" as const };

  const [forms, articles] = await Promise.all([
    prisma.portalForm.findMany({
      where: {
        isActive: true,
        OR: [
          { name: like },
          { summary: like },
          { description: like },
          { keywords: { has: q.toLowerCase() } },
        ],
      },
      orderBy: [{ isFeatured: "desc" }, { position: "asc" }],
      take,
      select: {
        id: true,
        slug: true,
        name: true,
        summary: true,
        icon: true,
        color: true,
        category: { select: { name: true } },
      },
    }),
    prisma.portalArticle.findMany({
      where: {
        isPublished: true,
        OR: [
          { title: like },
          { summary: like },
          { body: like },
          { keywords: { has: q.toLowerCase() } },
        ],
      },
      orderBy: [{ views: "desc" }],
      take,
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  return [
    ...forms.map((form): SearchHit => ({
      kind: "form",
      id: form.id,
      slug: form.slug,
      title: form.name,
      summary: form.summary,
      icon: form.icon,
      color: form.color,
      category: form.category?.name ?? null,
    })),
    ...articles.map((article): SearchHit => ({
      kind: "article",
      id: article.id,
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      category: article.category?.name ?? null,
    })),
  ];
}

/** Announcements that are on, and within their window if they have one. */
export async function liveAnnouncements(banner?: boolean) {
  const now = new Date();

  return prisma.portalAnnouncement.findMany({
    where: {
      isActive: true,
      ...(banner === undefined ? {} : { isBanner: banner }),
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: [{ position: "asc" }],
    select: { id: true, title: true, body: true, tone: true, endsAt: true },
  });
}

/**
 * How long the desk usually takes to answer, in working minutes — the median
 * wait for a first reply over the last month.
 *
 * The median rather than the mean: one ticket that sat over a holiday would
 * otherwise promise every requester a week. Null when the desk has not
 * answered enough to say anything honest.
 */
export async function typicalReplyMinutes(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const tickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: since } },
    select: {
      createdAt: true,
      reporterId: true,
      comments: {
        where: { isInternal: false, stepId: null },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: { createdAt: true, authorId: true },
      },
    },
  });

  const hours = (await getClock()).hours;
  const waits: number[] = [];

  for (const ticket of tickets) {
    const reply = ticket.comments.find((comment) => comment.authorId !== ticket.reporterId);
    if (reply) waits.push(workingMinutesBetween(ticket.createdAt, reply.createdAt, hours));
  }

  if (waits.length < 3) return null;
  waits.sort((a, b) => a - b);
  return waits[Math.floor(waits.length / 2)]!;
}

/**
 * The request this person has kept the desk waiting on longest.
 *
 * One banner, not a stack of them: the point is to name the one thing that is
 * stuck, and the one that has been stuck longest is the one worth naming. The
 * wait is measured from when the clock stopped — the moment the desk said it
 * was waiting on them — rather than from when the request was raised.
 */
export async function longestWait(userId: string) {
  const ticket = await prisma.ticket.findFirst({
    where: {
      reporterId: userId,
      assigneeId: { not: null },
      status: { is: { settles: false, pausesClock: true } },
    },
    // Nulls last: a ticket whose clock was never actually stopped has no wait
    // to measure, so it only wins when there is nothing else.
    orderBy: [{ pausedSince: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    select: {
      number: true,
      reference: true,
      title: true,
      pausedSince: true,
      createdAt: true,
      assignee: { select: { name: true } },
    },
  });

  if (!ticket?.assignee) return null;
  return { ...ticket, assignee: ticket.assignee, since: ticket.pausedSince ?? ticket.createdAt };
}
