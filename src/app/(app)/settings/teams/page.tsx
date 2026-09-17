import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { SettingsSection } from "@/components/settings/section";
import { TeamManager } from "@/components/settings/team-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.settings.sections.teams };
}

export default async function TeamSettingsPage() {
  const user = await requireUser();
  if (!can(user, "team.manage")) notFound();

  const [teams, staff, t] = await Promise.all([
    prisma.team.findMany({
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        members: { select: { id: true, name: true, avatarVariant: true } },
        _count: { select: { tickets: true } },
      },
    }),
    // Only people who can work a ticket are worth putting on a desk.
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { OR: [{ isMaster: true }, { permissions: { has: "ticket.edit" } }] },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, avatarVariant: true },
    }),
    getMessages(),
  ]);

  return (
    <SettingsSection title={t.settings.teamsTitle} description={t.settings.teamsBlurb}>
      <TeamManager
        teams={teams.map((team) => ({
          id: team.id,
          name: team.name,
          description: team.description,
          color: team.color,
          members: team.members,
          tickets: team._count.tickets,
        }))}
        staff={staff}
      />
    </SettingsSection>
  );
}
