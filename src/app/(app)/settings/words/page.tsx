import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getMessages } from "@/lib/settings";
import { SettingsSection } from "@/components/settings/section";
import { SettingsSheet } from "@/components/settings/sheet";
import { BlockedWordManager } from "@/components/settings/blocked-word-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.settings.sections.words };
}

export default async function BlockedWordsPage() {
  const t = await getMessages();
  const words = await prisma.blockedWord.findMany({
    orderBy: { word: "asc" },
    select: { id: true, word: true },
  });

  return (
    <SettingsSheet>
      <SettingsSection title={t.settings.wordsTitle} description={t.settings.wordsBlurb}>
        <BlockedWordManager words={words} />
      </SettingsSection>
    </SettingsSheet>
  );
}
