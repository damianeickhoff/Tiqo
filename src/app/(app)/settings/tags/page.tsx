import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getMessages } from "@/lib/settings";
import { SettingsSection } from "@/components/settings/section";
import { TagManager } from "@/components/settings/tag-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.settings.sections.tags };
}

export default async function TagSettingsPage() {
  const t = await getMessages();
  const tags = await prisma.label.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      _count: { select: { tickets: true } },
    },
  });

  return (
    <SettingsSection title={t.settings.tagsTitle} description={t.settings.tagsBlurb}>
      <TagManager
        tags={tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          tickets: tag._count.tickets,
        }))}
      />
    </SettingsSection>
  );
}
