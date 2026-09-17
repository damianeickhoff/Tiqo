import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getMessages } from "@/lib/settings";
import { KnowledgeLibrary } from "@/components/settings/knowledge-library";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).forms.tabKnowledge };
}

/** The answers, which are the half of self-service that is not a form. */
export default async function KnowledgePage() {
  const [articles, categories, votes] = await Promise.all([
    prisma.portalArticle.findMany({
      orderBy: [{ isPublished: "desc" }, { views: "desc" }],
      select: {
        id: true,
        title: true,
        summary: true,
        isPublished: true,
        isFeatured: true,
        views: true,
        categoryId: true,
        updatedAt: true,
        // Who stands behind the answer, and who touched it last. "Who changed
        // this" is the first question asked when an answer goes stale.
        createdBy: { select: { name: true, avatarVariant: true } },
        updatedBy: { select: { name: true, avatarVariant: true } },
      },
    }),
    prisma.portalCategory.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true, parentId: true },
    }),
    // Two tallies per answer rather than one score: "nine yes, eight no" and
    // "one yes" are both a positive average, and only one of them is a problem.
    prisma.portalArticleVote.groupBy({
      by: ["articleId", "helpful"],
      _count: { _all: true },
    }),
  ]);

  const tally = new Map<string, { helpful: number; unhelpful: number }>();
  for (const row of votes) {
    const found = tally.get(row.articleId) ?? { helpful: 0, unhelpful: 0 };
    found[row.helpful ? "helpful" : "unhelpful"] = row._count._all;
    tally.set(row.articleId, found);
  }

  return (
    <KnowledgeLibrary
      articles={articles.map((article) => ({
        ...article,
        helpful: tally.get(article.id)?.helpful ?? 0,
        unhelpful: tally.get(article.id)?.unhelpful ?? 0,
      }))}
      categories={categories}
    />
  );
}
