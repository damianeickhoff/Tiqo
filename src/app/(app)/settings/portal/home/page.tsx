import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getMessages } from "@/lib/settings";
import { PageBuilder } from "@/components/settings/page-builder";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).forms.tabHome };
}

/** The portal's front page, band by band. */
export default async function PortalHomeSettings() {
  const [blocks, categories, portalStatuses] = await Promise.all([
    prisma.portalBlock.findMany({
      orderBy: { position: "asc" },
      select: {
        id: true,
        kind: true,
        title: true,
        subtitle: true,
        limit: true,
        categoryId: true,
        isActive: true,
        span: true,
      },
    }),
    prisma.portalCategory.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    prisma.status.count({ where: { showOnPortal: true } }),
  ]);

  return <PageBuilder blocks={blocks} categories={categories} portalStatuses={portalStatuses} />;
}
