import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { dateLocaleOf, getMessages, getSettings } from "@/lib/settings";
import { localised, readerLocale } from "@/lib/portal-locale";
import { ArticleFeedback } from "@/components/portal/article-feedback";
import { ServiceCard } from "@/components/portal/portal-pieces";
import { Markdown } from "@/components/markdown";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/avatar";

type Params = Promise<{ slug: string }>;

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

/** Two hundred words a minute, rounded up, never nought. */
function readingMinutes(body: string) {
  return Math.max(1, Math.round(body.trim().split(/\s+/).length / 200));
}

/** The month the tally is about: "this month" has to start somewhere. */
function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const article = await prisma.portalArticle.findUnique({
    where: { slug: (await params).slug },
    select: { title: true },
  });
  return { title: article?.title ?? "" };
}

/**
 * One answer. It ends with two ways out: saying whether it worked, and raising
 * a request anyway — an article that leaves someone stuck with nowhere to go is
 * worse than no article.
 */
export default async function ArticlePage({ params }: { params: Params }) {
  const user = await requireUser();
  const { slug } = await params;

  const article = await prisma.portalArticle.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      summary: true,
      body: true,
      isPublished: true,
      updatedAt: true,
      categoryId: true,
      translations: { select: { locale: true, title: true, summary: true, body: true } },
      createdBy: { select: { name: true, avatarVariant: true } },
      updatedBy: { select: { name: true, avatarVariant: true } },
      category: {
        select: {
          slug: true,
          name: true,
          forms: {
            where: { isActive: true },
            orderBy: { position: "asc" },
            take: 2,
            select: { id: true, slug: true, name: true, summary: true, icon: true, color: true },
          },
        },
      },
    },
  });

  if (!article || !article.isPublished) notFound();

  // Read counts are the only signal of which answers are actually wanted.
  await prisma.portalArticle.update({
    where: { id: article.id },
    data: { views: { increment: 1 } },
  });

  const [t, settings, locale, helpedThisMonth, myVote, related] = await Promise.all([
    getMessages(),
    getSettings(),
    readerLocale(user),
    prisma.portalArticleVote.count({
      where: { articleId: article.id, helpful: true, createdAt: { gte: startOfMonth() } },
    }),
    prisma.portalArticleVote.findUnique({
      where: { articleId_userId: { articleId: article.id, userId: user.id } },
      select: { helpful: true },
    }),
    // The rest of the shelf this one came off, most-read first. Nothing when it
    // belongs to no category — a list of unrelated answers is not "related".
    article.categoryId
      ? prisma.portalArticle.findMany({
          where: { categoryId: article.categoryId, isPublished: true, id: { not: article.id } },
          orderBy: { views: "desc" },
          take: 2,
          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            translations: { select: { locale: true, title: true, summary: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  // The reader's language where somebody has written it, the original where
  // nobody has. An English answer beats a blank page.
  const words = localised(
    { title: article.title, summary: article.summary, body: article.body },
    article.translations,
    locale,
  );

  const day = new Intl.DateTimeFormat(dateLocaleOf(settings), DAY);
  // Only worth naming when it is somebody else: "written by Ada, updated by
  // Ada" says nothing the first half did not.
  const editor =
    article.updatedBy && article.updatedBy.name !== article.createdBy?.name
      ? article.updatedBy
      : null;

  return (
    <div className="space-y-6">
      <nav className="text-text-3 flex flex-wrap items-center gap-1 text-base">
        <Link href="/portal" className="hover:text-text transition-colors">
          {t.portal.home}
        </Link>
        {article.category ? (
          <>
            <ChevronRight size={13} aria-hidden />
            <Link
              href={`/portal/c/${article.category.slug}`}
              className="hover:text-text transition-colors"
            >
              {article.category.name}
            </Link>
          </>
        ) : null}
      </nav>

      <header className="animate-rise">
        <h1 className="text-3xl leading-tight font-semibold tracking-[-0.025em]">{words.title}</h1>
        {words.summary ? (
          <p className="text-text-2 mt-2 max-w-[62ch] text-lg leading-relaxed">{words.summary}</p>
        ) : null}
        {/* Who stands behind it, and who touched it last — with their faces,
            because a name on its own is a string and a face is a person you
            can go and ask. */}
        <div className="text-text-3 mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
          {article.createdBy ? (
            <span className="flex items-center gap-1.5">
              <Avatar
                name={article.createdBy.name}
                variant={article.createdBy.avatarVariant}
                size={20}
              />
              {t.portal.writtenBy(article.createdBy.name)}
            </span>
          ) : null}

          {article.createdBy ? <span aria-hidden>·</span> : null}

          <span className="flex items-center gap-1.5">
            {editor ? <Avatar name={editor.name} variant={editor.avatarVariant} size={20} /> : null}
            {t.portal.updatedOn(day.format(article.updatedAt))}
            {editor ? ` ${t.portal.updatedBy(editor.name)}` : ""}
          </span>

          <span aria-hidden>·</span>
          <span>{t.portal.minRead(readingMinutes(words.body))}</span>
        </div>
      </header>

      <Card className="animate-rise p-6 lg:p-8">
        <Markdown text={words.body} className="text-md leading-[1.75]" />

        <ArticleFeedback
          articleId={article.id}
          helpedThisMonth={helpedThisMonth}
          mine={myVote?.helpful ?? null}
        />
      </Card>

      {related.length > 0 ? (
        <section className="animate-rise">
          <h2 className="label border-line border-b pb-2">{t.portal.relatedAnswers}</h2>
          <ul>
            {related.map((other) => {
              const theirs = localised(
                { title: other.title, summary: other.summary },
                other.translations,
                locale,
              );
              return (
                <li key={other.id} className="border-line border-b">
                  <Link
                    href={`/portal/kb/${other.slug}`}
                    className="group flex w-full items-center gap-3 py-3 transition-colors"
                  >
                    <BookOpen size={16} className="text-text-3 shrink-0" aria-hidden />
                    <span className="text-md group-hover:text-brand-deep shrink-0 font-semibold transition-colors">
                      {theirs.title}
                    </span>
                    {theirs.summary ? (
                      <span className="text-text-3 min-w-0 flex-1 truncate text-base">
                        {theirs.summary}
                      </span>
                    ) : (
                      <span className="flex-1" />
                    )}
                    <ChevronRight size={15} className="text-text-3 shrink-0" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {article.category && article.category.forms.length > 0 ? (
        <section className="animate-rise space-y-3">
          <p className="text-text-2 text-md">{t.portal.didThisHelp}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {article.category.forms.map((form) => (
              <li key={form.id}>
                <ServiceCard
                  href={`/portal/f/${form.slug}`}
                  title={form.name}
                  summary={form.summary}
                  icon={form.icon}
                  color={form.color}
                  alwaysArrow
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
