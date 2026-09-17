import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getMessages } from "@/lib/settings";
import { CatalogueManager } from "@/components/settings/catalogue-manager";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).forms.tabCatalogue };
}

/** The shelves the portal is browsed by. */
export default async function CataloguePage() {
  const categories = await prisma.portalCategory.findMany({
    orderBy: [{ position: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      color: true,
      isActive: true,
      parentId: true,
      leadsPortal: true,
      _count: { select: { forms: true, articles: true, children: true } },
    },
  });

  return <CatalogueManager categories={categories} />;
}
