import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMessages } from "@/lib/settings";
import { PortalSearch } from "@/components/portal/portal-search";
import { ArticleCard, BandHeader, ServiceCard } from "@/components/portal/portal-pieces";
import { PortalIcon } from "@/components/portal/portal-icon";
import { Card } from "@/components/ui";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const category = await prisma.portalCategory.findUnique({
    where: { slug: (await params).slug },
    select: { name: true },
  });
  return { title: category?.name ?? "" };
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
        select: { id: true, slug: true, title: true, summary: true },
      },
    },
  });

  if (!category || !category.isActive) notFound();

  const t = await getMessages();
  const empty =
    category.children.length === 0 && category.forms.length === 0 && category.articles.length === 0;

  return (
    <div className="space-y-8">
      <nav className="text-text-3 flex flex-wrap items-center gap-1 text-base">
        <Link href="/portal" className="hover:text-text transition-colors">
          {t.portal.home}
        </Link>
        {category.parent ? (
          <>
            <ChevronRight size={13} aria-hidden />
            <Link
              href={`/portal/c/${category.parent.slug}`}
              className="hover:text-text transition-colors"
            >
              {category.parent.name}
            </Link>
          </>
        ) : null}
        <ChevronRight size={13} aria-hidden />
        <span className="text-text-2">{category.name}</span>
      </nav>

      <header className="animate-rise flex flex-wrap items-start gap-4">
        <span
          aria-hidden
          className="rounded-panel flex size-14 shrink-0 items-center justify-center"
          style={{
            background: `color-mix(in oklab, ${category.color} 15%, transparent)`,
            color: category.color,
          }}
        >
          <PortalIcon name={category.icon} size={26} />
        </span>

        <div className="min-w-[16rem] flex-1">
          <h1 className="text-2xl leading-tight font-extrabold tracking-[-0.03em]">
            {category.name}
          </h1>
          {category.description ? (
            <p className="text-text-2 text-md mt-1.5 max-w-[60ch]">{category.description}</p>
          ) : null}
        </div>

        <div className="w-full max-w-sm">
          <PortalSearch size="compact" />
        </div>
      </header>

      {empty ? (
        <Card className="animate-rise p-10 text-center">
          <p className="text-text-3 text-md">{t.portal.noItems}</p>
        </Card>
      ) : null}

      {category.children.length > 0 ? (
        <section className="animate-rise">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {category.children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/portal/c/${child.slug}`}
                  className="card card-interactive group flex h-full items-center gap-3 p-4"
                >
                  <span
                    aria-hidden
                    className="rounded-control flex size-9 shrink-0 items-center justify-center"
                    style={{
                      background: `color-mix(in oklab, ${child.color} 15%, transparent)`,
                      color: child.color,
                    }}
                  >
                    <PortalIcon name={child.icon} size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="group-hover:text-brand-deep text-md block truncate font-semibold transition-colors">
                      {child.name}
                    </span>
                    <span className="text-text-3 block text-sm">
                      {t.forms.formCount(child._count.forms)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {category.forms.length > 0 ? (
        <section className="animate-rise">
          <BandHeader title={t.portal.request + "en"} />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <BandHeader title={t.portal.answers} />
          <ul className="grid gap-3 sm:grid-cols-2">
            {category.articles.map((article) => (
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
      ) : null}
    </div>
  );
}
