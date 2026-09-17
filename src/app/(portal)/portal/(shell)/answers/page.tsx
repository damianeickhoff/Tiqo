import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMessages } from "@/lib/settings";
import { PortalSearch } from "@/components/portal/portal-search";
import { ArticleCard, BandHeader } from "@/components/portal/portal-pieces";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).portal.answers };
}

/** The shelf above the shelves: what people actually open. */
const OFTEN_READ = 4;

/** Two hundred words a minute, rounded up, never nought. */
function readingMinutes(body: string) {
  return Math.max(1, Math.round(body.trim().split(/\s+/).length / 200));
}

/**
 * Everything the desk has already written down.
 *
 * The front page shows a handful; this is the rest of them, grouped by the
 * section they belong to — someone who came here rather than to a form is
 * browsing, and a flat list of forty titles is not something you browse.
 */
export default async function PortalAnswers() {
  await requireUser();
  const [articles, t] = await Promise.all([
    prisma.portalArticle.findMany({
      where: { isPublished: true },
      orderBy: [{ isFeatured: "desc" }, { views: "desc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        views: true,
        // Read for its length alone, so every card can say how long it is.
        body: true,
        category: { select: { id: true, name: true, position: true } },
      },
    }),
    getMessages(),
  ]);

  // Grouped in the catalogue's own order, with anything uncategorised last.
  const groups = new Map<string, { name: string; position: number; rows: typeof articles }>();
  for (const article of articles) {
    const key = article.category?.id ?? "none";
    const group = groups.get(key) ?? {
      name: article.category?.name ?? t.portal.otherAnswers,
      position: article.category?.position ?? Number.MAX_SAFE_INTEGER,
      rows: [],
    };
    group.rows.push(article);
    groups.set(key, group);
  }
  const ordered = [...groups.values()].sort((a, b) => a.position - b.position);

  // The four most opened, as a row of chips: a shortcut past the browsing for
  // the majority who came for one of the same handful of answers.
  const often = [...articles].sort((a, b) => b.views - a.views).slice(0, OFTEN_READ);

  return (
    <div className="portal-wrap pb-14">
      <header className="animate-rise pt-9 pb-[30px]">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-5">
          <div className="min-w-[17rem] flex-1">
            <h1 className="text-[36px] leading-[1.1] font-semibold tracking-[-0.035em]">
              {t.portal.answers}
            </h1>
            <p className="text-text-2 mt-2.5 max-w-[60ch] text-[16px]">{t.portal.answersBlurb}</p>
          </div>

          <div className="w-full sm:w-[360px]">
            <PortalSearch size="compact" />
          </div>
        </div>

        {often.length > 0 ? (
          <div className="mt-[22px] flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="label">{t.portal.oftenRead}</p>
            {often.map((article) => (
              <Link
                key={article.id}
                href={`/portal/kb/${article.slug}`}
                className="bg-surface text-text-2 hover:text-text inline-flex h-8 max-w-full items-center truncate rounded-full px-3.5 text-[13px] font-medium shadow-[var(--highlight)] transition-colors"
              >
                {article.title}
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      {articles.length === 0 ? (
        <p className="text-text-3 text-md">{t.portal.noAnswers}</p>
      ) : (
        <div className="space-y-12">
          {ordered.map((group) => (
            <section key={group.name}>
              <BandHeader title={group.name} subtitle={String(group.rows.length)} />
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.rows.map((article) => (
                  <li key={article.id}>
                    <ArticleCard
                      href={`/portal/kb/${article.slug}`}
                      title={article.title}
                      summary={article.summary}
                      meta={t.portal.minRead(readingMinutes(article.body))}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
