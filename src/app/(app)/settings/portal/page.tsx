import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getMessages, getSettings } from "@/lib/settings";
import { PortalGeneralForm } from "@/components/settings/portal-general-form";
import { Card } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).forms.title };
}

/** How the portal presents itself, plus a count of what is on it. */
export default async function PortalGeneralPage() {
  const [settings, counts, t] = await Promise.all([
    getSettings(),
    Promise.all([
      prisma.portalForm.count({ where: { isActive: true } }),
      prisma.portalCategory.count({ where: { isActive: true } }),
      prisma.portalArticle.count({ where: { isPublished: true } }),
      prisma.ticket.count({ where: { portalFormId: { not: null } } }),
    ]),
    getMessages(),
  ]);

  const [forms, sections, articles, raised] = counts;

  const stats = [
    { label: t.forms.tabForms, value: forms },
    { label: t.forms.tabCatalogue, value: sections },
    { label: t.forms.tabKnowledge, value: articles },
    { label: t.forms.raisedThroughPortal, value: raised },
  ];

  return (
    <div className="space-y-5">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <li key={stat.label}>
            <Card className="animate-rise p-4">
              <p className="label">{stat.label}</p>
              <p className="tnum mt-1 text-2xl leading-none font-bold">{stat.value}</p>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="animate-rise p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="text-md font-semibold">{t.forms.portalTitle}</h3>
            <p className="text-text-3 mt-0.5 text-base">{t.forms.generalBlurb}</p>
          </div>
          <Link
            href="/portal"
            className="text-text-2 hover:text-brand-deep flex items-center gap-1.5 text-base font-medium transition-colors"
          >
            {t.forms.visit}
            <ExternalLink size={13} />
          </Link>
        </div>

        <PortalGeneralForm
          enabled={settings.portalEnabled}
          portalTitle={settings.portalTitle}
          welcome={settings.portalWelcome}
          deskPhone={settings.deskPhone ?? ""}
        />
      </Card>
    </div>
  );
}
