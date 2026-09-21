import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageDocs } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { docReviewDefaults } from "@/lib/doc-sweep";
import { isStale } from "@/lib/docs";
import { SettingsSection } from "@/components/settings/section";
import { SettingsSheet } from "@/components/settings/sheet";
import { SpaceManager } from "@/components/settings/space-manager";
import { DocDefaultsForm } from "@/components/settings/doc-defaults-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.docs.spacesTitle };
}

/**
 * Where the shelves are made, and how hard the desk chases what is on them.
 *
 * Separate from the documentation itself, and behind `doc.manage`, because
 * deciding what bodies of writing exist is a different act from writing in one
 * — and it is the decision that a page's review clock, portal section and
 * default owner all start from.
 */
export default async function DocSettingsPage() {
  const user = await requireUser();
  if (!canManageDocs(user)) notFound();

  const [t, defaults, spaces, teams, categories] = await Promise.all([
    getMessages(),
    docReviewDefaults(),
    prisma.docSpace.findMany({
      orderBy: { position: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        color: true,
        teamId: true,
        reviewDays: true,
        portalCategoryId: true,
        docs: {
          where: { archivedAt: null },
          select: { reviewDays: true, reviewedAt: true, createdAt: true },
        },
      },
    }),
    prisma.team.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.portalCategory.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <SettingsSheet>
      <SettingsSection title={t.docs.spacesTitle} description={t.docs.spacesBlurb}>
        <SpaceManager
          teams={teams}
          categories={categories}
          spaces={spaces.map((space) => ({
            id: space.id,
            key: space.key,
            name: space.name,
            description: space.description,
            color: space.color,
            teamId: space.teamId,
            reviewDays: space.reviewDays,
            portalCategoryId: space.portalCategoryId,
            docs: space.docs.length,
            // The arithmetic no `where` clause can do, done where the clock is.
            stale: space.docs.filter((doc) => isStale(doc)).length,
          }))}
        />
      </SettingsSection>

      <SettingsSection title={t.docs.reviewDefaults} description={t.docs.reviewDefaultsBlurb}>
        {/* Whether anything can reach the poll route at all. The whole of
            the reminder scheme depends on it, and an instance with no token
            set is one where nothing below will ever be sent. */}
        <DocDefaultsForm defaults={defaults} polled={Boolean(process.env.MAIL_POLL_TOKEN)} />
      </SettingsSection>
    </SettingsSheet>
  );
}
