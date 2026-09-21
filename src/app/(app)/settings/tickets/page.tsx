import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getMessages, getPriorityTargets, getSettings } from "@/lib/settings";
import { SettingsSection } from "@/components/settings/section";
import { SettingsSheet } from "@/components/settings/sheet";
import { TicketDefaultsForm } from "@/components/settings/ticket-defaults-form";
import { PriorityTargetsForm } from "@/components/settings/priority-targets-form";
import { StatusManager } from "@/components/settings/status-manager";
import { CannedManager } from "@/components/settings/canned-manager";
import { BusinessHoursForm } from "@/components/settings/business-hours-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.settings.sections.tickets };
}

export default async function TicketSettingsPage() {
  const [settings, targets, projects, statuses, cannedReplies, t] = await Promise.all([
    getSettings(),
    getPriorityTargets(),
    prisma.project.findMany({
      where: { isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.status.findMany({
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        settles: true,
        isDefault: true,
        isClosing: true,
        isCancelling: true,
        showOnPortal: true,
        pausesClock: true,
        _count: { select: { tickets: true } },
      },
    }),
    prisma.cannedReply.findMany({
      orderBy: { position: "asc" },
      select: { id: true, title: true, body: true, isActive: true },
    }),
    getMessages(),
  ]);

  return (
    <SettingsSheet>
      <SettingsSection title={t.settings.defaultsTitle} description={t.settings.defaultsBlurb}>
        <TicketDefaultsForm
          defaultType={settings.defaultType}
          defaultPriority={settings.defaultPriority}
          defaultProjectId={settings.defaultProjectId}
          projects={projects}
        />
      </SettingsSection>

      <SettingsSection
        title={t.settings.targetsTitle}
        index={1}
        description={t.settings.targetsBlurb}
      >
        <PriorityTargetsForm targets={targets} />
      </SettingsSection>

      <SettingsSection
        title={t.settings.statusesTitle}
        index={2}
        description={t.settings.statusesBlurb}
      >
        <StatusManager
          statuses={statuses.map((status) => ({
            id: status.id,
            name: status.name,
            color: status.color,
            settles: status.settles,
            isDefault: status.isDefault,
            isClosing: status.isClosing,
            isCancelling: status.isCancelling,
            showOnPortal: status.showOnPortal,
            pausesClock: status.pausesClock,
            tickets: status._count.tickets,
          }))}
        />
      </SettingsSection>

      <SettingsSection
        title={t.settings.cannedTitleSection}
        description={t.settings.cannedBlurb}
      >
        <CannedManager replies={cannedReplies} />
      </SettingsSection>

      <SettingsSection
        title={t.settings.businessTitle}
        index={3}
        description={t.settings.businessBlurb}
      >
        <BusinessHoursForm settings={settings} />
      </SettingsSection>
    </SettingsSheet>
  );
}
