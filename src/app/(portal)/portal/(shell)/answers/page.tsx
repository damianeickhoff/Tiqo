import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMessages } from "@/lib/settings";
import { ArticleCard } from "@/components/portal/portal-pieces";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).portal.answers };
}

/** The shelf above the shelves: what people actually open. */
const OFTEN_READ = 4;

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <header>
          <h1 className="text-xl leading-tight font-semibold tracking-[-0.02em]">
            {t.portal.answers}
          </h1>
          <p className="text-text-2 mt-1 text-base">{t.portal.answersBlurb}</p>
        </header>

        {/* A plain GET, so the results are a page someone can bookmark and the
            box works before any JavaScript has loaded. */}
        <form action="/portal/search" className="relative w-full sm:w-[280px]">
          <Search
            size={15}
            aria-hidden
            className="text-text-3 pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
          />
          <input
            name="q"
            type="search"
            placeholder={t.portal.searchPlaceholder}
            aria-label={t.portal.searchPlaceholder}
            className="border-line bg-surface focus:border-brand h-10 w-full rounded-full border pr-4 pl-10 text-base transition-[border-color] placeholder:text-[var(--text-3)] focus:ring-[3px] focus:ring-[var(--brand-tint)] focus:outline-none"
          />
        </form>
      </div>

      {articles.length === 0 ? (
        <p className="text-text-3 text-md">{t.portal.noAnswers}</p>
      ) : (
        <>
          {often.length > 0 ? (
            <section className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="label">{t.portal.oftenRead}</p>
              {often.map((article) => (
                <Link
                  key={article.id}
                  href={`/portal/kb/${article.slug}`}
                  className="border-line bg-surface hover:border-line-strong hover:text-text text-text-2 inline-flex h-8 max-w-full items-center truncate rounded-full border px-3 text-base font-medium transition-colors"
                >
                  {article.title}
                </Link>
              ))}
            </section>
          ) : null}

          <div className="space-y-8">
            {ordered.map((group) => (
              <section key={group.name}>
                <p className="label mb-3 flex items-baseline gap-2">
                  {group.name}
                  <span className="tnum font-mono text-xs normal-case">{group.rows.length}</span>
                </p>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.rows.map((article) => (
                    <li key={article.id}>
                      <ArticleCard
                        href={`/portal/kb/${article.slug}`}
                        title={article.title}
                        summary={article.summary}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
