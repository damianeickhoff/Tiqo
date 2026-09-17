import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMessages } from "@/lib/settings";
import { PortalSearch } from "@/components/portal/portal-search";
import { ArticleCard, BandHeader, ServiceCard, Tile } from "@/components/portal/portal-pieces";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const category = await prisma.portalCategory.findUnique({
    where: { slug: (await params).slug },
    select: { name: true },
  });
  return { title: category?.name ?? "" };
}

/** Two hundred words a minute, rounded up, never nought. */
function readingMinutes(body: string) {
  return Math.max(1, Math.round(body.trim().split(/\s+/).length / 200));
}

/** One shelf of the catalogue: its sub-shelves, its forms and its answers. */
export default async function CategoryPage({ params }: { params: Params }) {
  await requireUser();
  const { slug } = await params;

  const category = await prisma.portalCategory.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      color: true,
      isActive: true,
      parent: { select: { slug: true, name: true } },
      children: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          icon: true,
          color: true,
          _count: { select: { forms: true } },
        },
      },
      forms: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        select: { id: true, slug: true, name: true, summary: true, icon: true, color: true },
      },
      articles: {
        where: { isPublished: true },
        orderBy: { position: "asc" },
        // The body is read for its length alone: "3 min read" is what makes
        // somebody open an answer rather than raise a request.
        select: { id: true, slug: true, title: true, summary: true, body: true },
      },
    },
  });

  if (!category || !category.isActive) notFound();

  const t = await getMessages();
  const empty =
    category.children.length === 0 && category.forms.length === 0 && category.articles.length === 0;

  return (
    <div className="portal-wrap pb-14">
      <header className="animate-rise pt-9 pb-[30px]">
        <nav className="text-text-3 mb-4 flex flex-wrap items-center gap-1.5 text-[13.5px]">
          <Link href="/portal" className="hover:text-text transition-colors">
            {t.portal.home}
          </Link>
          {category.parent ? (
            <>
              <ChevronRight size={12} aria-hidden />
              <Link
                href={`/portal/c/${category.parent.slug}`}
                className="hover:text-text transition-colors"
              >
                {category.parent.name}
              </Link>
            </>
          ) : null}
          <ChevronRight size={12} aria-hidden />
          <span className="text-text-2">{category.name}</span>
        </nav>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-5">
          <div className="flex min-w-[17rem] flex-1 items-center gap-[18px]">
            <Tile icon={category.icon} color={category.color} size={56} />
            <div className="min-w-0">
              <h1 className="text-[36px] leading-[1.1] font-semibold tracking-[-0.035em]">
                {category.name}
              </h1>
              {category.description ? (
                <p className="text-text-2 mt-2.5 max-w-[60ch] text-[16px]">
                  {category.description}
                </p>
              ) : null}
            </div>
          </div>

          {/* The box keeps this section's name in its placeholder: somebody who
              arrived here by browsing is asking about this shelf, not the whole
              catalogue, and the prompt should say so. */}
          <div className="w-full sm:w-[320px]">
            <PortalSearch size="compact" placeholder={t.portal.searchInSection(category.name)} />
          </div>
        </div>
      </header>

      {empty ? (
        <div className="pcard animate-rise p-10 text-center">
          <p className="text-text-3 text-md">{t.portal.noItems}</p>
        </div>
      ) : null}

      {category.children.length > 0 ? (
        <section className="animate-rise mb-12">
          {/* A list, not tiles: the sub-shelves are a way through, and the eye
              runs down one column faster than it scans four. */}
          <ul className="pcard p-1.5">
            {category.children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/portal/c/${child.slug}`}
                  className="hover:bg-surface-2 flex items-center gap-4 rounded-xl px-3 py-3 transition-colors"
                >
                  <Tile icon={child.icon} color={child.color} />
                  <span className="min-w-0 flex-1">
                    <span className="text-md block font-semibold">{child.name}</span>
                    {child.description ? (
                      <span className="text-text-2 mt-0.5 block truncate text-base">
                        {child.description}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-text-3 shrink-0 font-mono text-xs">
                    {t.forms.formCount(child._count.forms)}
                  </span>
                  <ArrowRight size={14} className="text-text-3 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {category.forms.length > 0 ? (
        <section className="animate-rise mb-12">
          <BandHeader
            title={t.portal.requests}
            subtitle={t.portal.inThisSection(category.forms.length)}
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {category.forms.map((form) => (
              <li key={form.id}>
                <ServiceCard
                  href={`/portal/f/${form.slug}`}
                  title={form.name}
                  summary={form.summary}
                  icon={form.icon}
                  color={form.color}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {category.articles.length > 0 ? (
        <section className="animate-rise">
          <BandHeader title={t.portal.answers} subtitle={t.portal.answersBlurb} />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {category.articles.map((article) => (
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
      ) : null}
    </div>
  );
}
