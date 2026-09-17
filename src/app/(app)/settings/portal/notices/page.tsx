import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getMessages } from "@/lib/settings";
import { NoticeManager } from "@/components/settings/notice-manager";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).forms.tabNotices };
}

/** What everyone should read before raising a ticket about it. */
export default async function NoticesPage() {
  const notices = await prisma.portalAnnouncement.findMany({
    orderBy: [{ position: "asc" }],
    select: {
      id: true,
      title: true,
      body: true,
      tone: true,
      isActive: true,
      endsAt: true,
      isBanner: true,
    },
  });

  return <NoticeManager notices={notices} />;
}
