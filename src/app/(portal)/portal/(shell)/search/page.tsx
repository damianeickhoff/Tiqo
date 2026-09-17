import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMessages } from "@/lib/settings";
import { portalSearch, type SearchHit } from "@/lib/portal";
import { PortalSearch } from "@/components/portal/portal-search";
import { ArticleCard, BandHeader, Count, ServiceCard } from "@/components/portal/portal-pieces";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).portal.searchTitle };
}

type SearchParams = Promise<{ q?: string }>;

/**
 * Results, and — when nobody has typed anything — the whole catalogue as a
 * flat list. "Everything you can ask for" is a page a portal has to have, and
 * this is the natural place for it.
 *
 * Hits are split into requests and answers rather than interleaved: the two
 * are different offers — do it yourself, or ask us — and a mixed grid makes
 * the reader sort them by eye.
 */
export default async function PortalSearchPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();

  const query = (await searchParams).q?.trim() ?? "";
  const t = await getMessages();

  const hits = query.length >= 2 ? await portalSearch(query, 50) : [];
  const forms = hits.filter(
    (hit): hit is Extract<SearchHit, { kind: "form" }> => hit.kind === "form",
  );
  const answers = hits.filter(
    (hit): hit is Extract<SearchHit, { kind: "article" }> => hit.kind === "article",
  );

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
    <div className="portal-wrap pb-14">
      <header className="animate-rise pt-9 pb-[30px]">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-5">
          <div className="min-w-[17rem] flex-1">
            <h1 className="text-[36px] leading-[1.1] font-semibold tracking-[-0.035em]">
              {query ? t.portal.resultCount(hits.length) : t.portal.allServices}
            </h1>
            <p className="text-text-2 mt-2.5 max-w-[60ch] text-[16px]">
              {query ? t.portal.forQuery(query) : t.portal.browseBlurb}
            </p>
          </div>

          {/* The query stays in the box: the page somebody lands on after
              searching is also the page they narrow the search from. */}
          <div className="w-full sm:w-[420px]">
            <PortalSearch size="compact" autoFocus initialQuery={query} />
          </div>
        </div>
      </header>

      {query.length >= 2 && hits.length === 0 ? (
        <div className="pcard animate-rise p-10 text-center">
          <p className="text-text-3 text-md">{t.portal.noResults(query)}</p>
        </div>
      ) : null}

      <div className="space-y-12">
        {forms.length > 0 ? (
          <section className="animate-rise">
            <BandHeader title={t.portal.requests} subtitle={<Count n={forms.length} />} />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {forms.map((hit) => (
                <li key={`form-${hit.id}`}>
                  <ServiceCard
                    href={`/portal/f/${hit.slug}`}
                    title={hit.title}
                    summary={hit.summary}
                    icon={hit.icon}
                    color={hit.color}
                    meta={hit.category}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {answers.length > 0 ? (
          <section className="animate-rise">
            <BandHeader title={t.portal.answers} subtitle={<Count n={answers.length} />} />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {answers.map((hit) => (
                <li key={`article-${hit.id}`}>
                  <ArticleCard
                    href={`/portal/kb/${hit.slug}`}
                    title={hit.title}
                    summary={hit.summary}
                    meta={hit.category ? t.portal.inCategory(hit.category) : t.portal.answer}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {everything.length > 0 ? (
          <section className="animate-rise">
            <BandHeader title={t.portal.requests} subtitle={<Count n={everything.length} />} />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
