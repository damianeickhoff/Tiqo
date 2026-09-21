import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can, canViewDirectory } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { SettingsSection } from "@/components/settings/section";
import { SettingsSheet } from "@/components/settings/sheet";
import { RoleManager } from "@/components/settings/role-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.settings.sections.roles };
}

export default async function RoleSettingsPage() {
  const user = await requireUser();
  if (!can(user, "settings.roles")) notFound();

  const [t, people, roles] = await Promise.all([
    getMessages(),
    // Everyone who could be moved into a role, so the picker can search them
    // without a round trip per keystroke.
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, avatarVariant: true, roleId: true },
    }),
    prisma.role.findMany({
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        isMaster: true,
        isDefault: true,
        permissions: true,
        _count: { select: { users: true } },
      },
    }),
  ]);

  return (
    <SettingsSheet>
      <SettingsSection title={t.settings.rolesTitle} description={t.settings.rolesBlurb}>
        <RoleManager
          people={people}
          roles={roles.map((role) => ({
            id: role.id,
            name: role.name,
            description: role.description,
            isMaster: role.isMaster,
            isDefault: role.isDefault,
            permissions: role.permissions,
            users: role._count.users,
          }))}
        />
      </SettingsSection>

      {canViewDirectory(user) ? (
        <SettingsSection
          title={t.settings.peopleTitle}
          index={1}
          description={t.settings.peopleBlurb}
        >
          <Link
            href="/people"
            className="bg-surface hover:border-brand hover:text-brand-deep rounded-control text-md inline-flex h-11 items-center gap-2 border border-transparent px-4 font-semibold shadow-[var(--highlight)] transition-colors"
          >
            {t.settings.openPeople}
            <ArrowRight size={15} />
          </Link>
        </SettingsSection>
      ) : null}
    </SettingsSheet>
  );
}
