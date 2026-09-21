import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canOpenSettings } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { PageHeader } from "@/components/shell/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";

/**
 * The settings area, and the one gate in front of it. Every page underneath is
 * reached through this layout, so the check cannot be forgotten on a new
 * section — and `notFound` rather than a redirect, because a non-admin has no
 * business knowing the area exists.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!canOpenSettings(user)) notFound();

  const t = await getMessages();

  return (
    <>
      <PageHeader eyebrow={t.settings.eyebrow} title={t.settings.title}>
        {t.settings.blurb}
      </PageHeader>

      {/* The navigation sits on the ground beside the page's sheet, so the gap
          between them is the ground showing through rather than a gutter. */}
      <div className="px-5 py-5 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6 lg:px-6">
        <SettingsNav user={user} />
        {/* No narrow cap: a settings form that stops at 960px leaves a third of
            a wide screen empty while its own tables scroll sideways. */}
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
