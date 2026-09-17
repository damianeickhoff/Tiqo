import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMessages, getSettings } from "@/lib/settings";
import { ArticleEditor } from "@/components/settings/article-editor";
import { docHref } from "@/lib/docs";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const article = await prisma.portalArticle.findUnique({
    where: { id: (await params).id },
    select: { title: true },
  });
  return { title: article?.title ?? (await getMessages()).forms.tabKnowledge };
}

export default async function ArticleEditorPage({ params }: { params: Params }) {
  const { id } = await params;

  const [article, categories, settings] = await Promise.all([
    prisma.portalArticle.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        body: true,
        keywords: true,
        categoryId: true,
        isPublished: true,
        isFeatured: true,
        views: true,
        translations: { select: { locale: true, title: true, summary: true, body: true } },
        // Where this answer came from, when it was not written here. The two
        // are free to diverge afterwards, so the editor has to say so rather
        // than let somebody discover it by wondering why their edit vanished
        // the next time the page was published.
        doc: { select: { slug: true, space: { select: { key: true } } } },
      },
    }),
    prisma.portalCategory.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    getSettings(),
  ]);

  if (!article) notFound();

  const { translations, doc, ...rest } = article;
  return (
    <ArticleEditor
      article={rest}
      categories={categories}
      baseLocale={settings.locale}
      translations={translations}
      fromDoc={doc ? docHref(doc.space.key, doc.slug) : null}
    />
  );
}
