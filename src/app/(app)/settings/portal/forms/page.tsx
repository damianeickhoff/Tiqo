import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getMessages, getSettings } from "@/lib/settings";
import { FormLibrary } from "@/components/settings/form-library";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).forms.tabForms };
}

/**
 * The form library.
 *
 * Fifty forms is the case this is designed for, not the exception: they are
 * grouped by section, searchable by name and keyword, filterable by what they
 * raise and whether they are live, and every row carries how many tickets it
 * has actually produced — which is the only honest way to find the forms
 * nobody uses.
 */
export default async function PortalFormsPage() {
  // "Used" means used lately: a form that raised forty tickets two years ago
  // and none since is not a form in use, and the lifetime total says it is.
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [forms, categories, settings] = await Promise.all([
    prisma.portalForm.findMany({
      orderBy: [{ position: "asc" }],
      select: {
        id: true,
        name: true,
        summary: true,
        icon: true,
        color: true,
        isActive: true,
        type: true,
        categoryId: true,
        _count: { select: { tickets: { where: { createdAt: { gte: monthStart } } } } },
      },
    }),
    prisma.portalCategory.findMany({
      orderBy: [{ position: "asc" }],
      select: { id: true, name: true, parentId: true },
    }),
    getSettings(),
  ]);

  return (
    <FormLibrary
      forms={forms.map((form) => ({
        id: form.id,
        name: form.name,
        summary: form.summary,
        icon: form.icon,
        color: form.color,
        isActive: form.isActive,
        type: form.type,
        categoryId: form.categoryId,
        raised: form._count.tickets,
      }))}
      categories={categories}
      language={(settings.locale.split("-")[0] ?? "en").toUpperCase()}
    />
  );
}
