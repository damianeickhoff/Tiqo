import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can, canOpenSettings } from "@/lib/permissions";
import { getMessages, getSettings } from "@/lib/settings";
import { FormBuilder } from "@/components/settings/form-builder";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const form = await prisma.portalForm.findUnique({
    where: { id: (await params).id },
    select: { name: true },
  });
  return { title: form?.name ?? (await getMessages()).forms.tabForms };
}

/**
 * The form designer, outside the settings shell.
 *
 * It sits in the `(editors)` group so it gets the app's chrome and none of
 * settings' — a three-column editor squeezed beside a 220px side-nav is the
 * version of this nobody could use. Leaving that layout also leaves the two
 * gates in front of it, so both are run here: the group deliberately has no
 * layout of its own, because the next editor to move in will have permissions
 * of its own and should have to say so.
 */
export default async function FormBuilderPage({ params }: { params: Params }) {
  const user = await requireUser();
  if (!canOpenSettings(user) || !can(user, "settings.tickets")) notFound();

  const { id } = await params;

  const [form, categories, teams, projects, plans, settings] = await Promise.all([
    prisma.portalForm.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        name: true,
        summary: true,
        description: true,
        confirmation: true,
        keywords: true,
        icon: true,
        color: true,
        type: true,
        priority: true,
        categoryId: true,
        teamId: true,
        projectId: true,
        planId: true,
        isActive: true,
        isFeatured: true,
        category: { select: { name: true } },
        translations: { select: { locale: true, name: true, summary: true, description: true } },
        sections: {
          orderBy: { position: "asc" },
          select: { id: true, title: true, description: true },
        },
        fields: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            label: true,
            hint: true,
            placeholder: true,
            kind: true,
            target: true,
            required: true,
            halfWidth: true,
            options: true,
            sectionId: true,
            showWhenFieldId: true,
            showWhenValue: true,
            translations: {
              select: { locale: true, label: true, hint: true, placeholder: true, options: true },
            },
          },
        },
      },
    }),
    prisma.portalCategory.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    prisma.team.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({
      where: { isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.changeTemplate.findMany({
      where: { steps: { some: {} } },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    getSettings(),
  ]);

  if (!form) notFound();

  return (
    <FormBuilder
      form={form}
      categories={categories}
      teams={teams}
      projects={projects}
      plans={plans}
      baseLocale={settings.locale}
    />
  );
}
