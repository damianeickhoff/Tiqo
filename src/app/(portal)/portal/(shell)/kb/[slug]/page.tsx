import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { dateLocaleOf, getMessages, getSettings } from "@/lib/settings";
import { localised, readerLocale } from "@/lib/portal-locale";
import { ArticleFeedback } from "@/components/portal/article-feedback";
import { AnswerRow, Tile } from "@/components/portal/portal-pieces";
import { Markdown } from "@/components/markdown";
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

  const ways = article.category?.forms ?? [];
  const aside = related.length > 0 || ways.length > 0;

  return (
    <div className="portal-wrap pb-14">
      <header className="animate-rise pt-9">
        <nav className="text-text-3 mb-4 flex flex-wrap items-center gap-1.5 text-[13.5px]">
          <Link href="/portal" className="hover:text-text transition-colors">
            {t.portal.home}
          </Link>
          <ChevronRight size={12} aria-hidden />
          <Link href="/portal/answers" className="hover:text-text transition-colors">
            {t.portal.answers}
          </Link>
          {article.category ? (
            <>
              <ChevronRight size={12} aria-hidden />
              <span className="text-text-2">{article.category.name}</span>
            </>
          ) : null}
        </nav>

        <h1 className="max-w-[26ch] text-[36px] leading-[1.1] font-semibold tracking-[-0.035em]">
          {words.title}
        </h1>
        {words.summary ? (
          <p className="text-text-2 mt-2.5 max-w-[70ch] text-[16px] leading-relaxed">
            {words.summary}
          </p>
        ) : null}

        {/* Who stands behind it, and who touched it last — with their faces,
            because a name on its own is a string and a face is a person you
            can go and ask. */}
        <div className="text-text-3 mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
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

      <div
        className={
          aside
            ? "animate-rise mt-7 grid gap-x-11 gap-y-[22px] lg:grid-cols-[minmax(0,1fr)_320px]"
            : "animate-rise mt-7"
        }
      >
        <article className="pcard min-w-0">
          <div className="px-6 pt-6 pb-5 sm:px-7 sm:pt-[26px] sm:pb-[22px]">
            <Markdown text={words.body} className="text-md leading-[1.75]" />
          </div>

          <ArticleFeedback
            articleId={article.id}
            helpedThisMonth={helpedThisMonth}
            mine={myVote?.helpful ?? null}
          />
        </article>

        {aside ? (
          <aside className="flex flex-col gap-[22px]">
            {related.length > 0 ? (
              <section className="pcard">
                <h2 className="px-[22px] pt-[18px] pb-1 text-[16px] font-semibold tracking-[-0.01em]">
                  {t.portal.relatedAnswers}
                </h2>
                <div className="p-1.5">
                  {related.map((other) => {
                    const theirs = localised(
                      { title: other.title, summary: other.summary },
                      other.translations,
                      locale,
                    );
                    return (
                      <AnswerRow
                        key={other.id}
                        href={`/portal/kb/${other.slug}`}
                        title={theirs.title}
                        summary={theirs.summary}
                      />
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* The way out of an answer that did not answer it. Offered as the
                two forms of this section rather than a link to the catalogue:
                somebody who is still stuck should not have to go and look. */}
            {ways.length > 0 ? (
              <section className="pcard">
                <h2 className="px-[22px] pt-[18px] pb-1.5 text-[16px] font-semibold tracking-[-0.01em]">
                  {t.portal.stillStuck}
                </h2>
                <p className="text-text-2 px-[22px] pb-4 text-[13.5px] leading-relaxed">
                  {t.portal.stillStuckBody}
                </p>
                <ul>
                  {ways.map((form) => (
                    <li key={form.id} className="border-line border-t">
                      <Link
                        href={`/portal/f/${form.slug}`}
                        className="hover:bg-surface-2 flex items-center gap-3 px-[22px] py-[13px] transition-colors"
                      >
                        <Tile icon={form.icon} color={form.color} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-semibold">
                            {form.name}
                          </span>
                          {form.summary ? (
                            <span className="text-text-3 mt-px block truncate text-[12.5px]">
                              {form.summary}
                            </span>
                          ) : null}
                        </span>
                        <ArrowRight size={13} className="text-text-3 shrink-0" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
