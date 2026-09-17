import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMessages } from "@/lib/settings";
import { portalSearch } from "@/lib/portal";
import { PortalSearch } from "@/components/portal/portal-search";
import { ArticleCard, BandHeader, ServiceCard } from "@/components/portal/portal-pieces";
import { Card } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).portal.searchTitle };
}

type SearchParams = Promise<{ q?: string }>;

/**
 * Results, and — when nobody has typed anything — the whole catalogue as a
 * flat list. "Everything you can ask for" is a page a portal has to have, and
 * this is the natural place for it.
 */
export default async function PortalSearchPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();

  const query = (await searchParams).q?.trim() ?? "";
  const t = await getMessages();

  const hits = query.length >= 2 ? await portalSearch(query, 50) : [];

  const everything =
    query.length >= 2
      ? []
      : await prisma.portalForm.findMany({
          where: { isActive: true },
          orderBy: [{ category: { position: "asc" } }, { position: "asc" }],
          select: {
            id: true,
            slug: true,
            name: true,
            summary: true,
            icon: true,
            color: true,
            category: { select: { name: true } },
          },
        });

  return (
    <div className="space-y-7">
      <header className="animate-rise space-y-4">
        <h1 className="text-2xl leading-tight font-extrabold tracking-[-0.025em]">
          {query ? t.portal.resultCount(hits.length) : t.portal.allServices}
        </h1>
        <div className="max-w-2xl">
          <PortalSearch size="compact" autoFocus initialQuery={query} />
        </div>
      </header>

      {query.length >= 2 && hits.length === 0 ? (
        <Card className="animate-rise p-10 text-center">
          <p className="text-text-3 text-md">{t.portal.noResults(query)}</p>
        </Card>
      ) : null}

      {hits.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hits.map((hit) => (
            <li key={`${hit.kind}-${hit.id}`}>
              {hit.kind === "form" ? (
                <ServiceCard
                  href={`/portal/f/${hit.slug}`}
                  title={hit.title}
                  summary={hit.summary}
                  icon={hit.icon}
                  color={hit.color}
                  meta={hit.category}
                />
              ) : (
                <ArticleCard
                  href={`/portal/kb/${hit.slug}`}
                  title={hit.title}
                  summary={hit.summary}
                  meta={hit.category ? t.portal.inCategory(hit.category) : t.portal.answer}
                />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {everything.length > 0 ? (
        <section className="animate-rise">
          <BandHeader title={t.portal.browse} subtitle={t.portal.browseBlurb} />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {everything.map((form) => (
              <li key={form.id}>
                <ServiceCard
                  href={`/portal/f/${form.slug}`}
                  title={form.name}
                  summary={form.summary}
                  icon={form.icon}
                  color={form.color}
                  meta={form.category?.name}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
