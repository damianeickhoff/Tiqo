import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { SettingsSection } from "@/components/settings/section";
import { SettingsSheet } from "@/components/settings/sheet";
import { PlanManager } from "@/components/settings/plan-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.plan.templatesTitle };
}

export default async function PlanSettingsPage() {
  const user = await requireUser();
  if (!can(user, "settings.tickets")) notFound();

  const [templates, t] = await Promise.all([
    prisma.changeTemplate.findMany({
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        phases: { orderBy: { position: "asc" }, select: { id: true, name: true } },
        steps: { select: { id: true } },
      },
    }),
    getMessages(),
  ]);

  return (
    <SettingsSheet>
      <SettingsSection title={t.plan.templatesTitle} description={t.plan.templatesBlurb}>
        <PlanManager templates={templates} />
      </SettingsSection>
    </SettingsSheet>
  );
}
