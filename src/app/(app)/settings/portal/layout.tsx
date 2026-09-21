import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { PortalSwitch } from "@/components/settings/portal-switch";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getMessages, getSettings } from "@/lib/settings";
import { PortalAdminNav } from "@/components/settings/portal-admin-nav";
import { SettingsSheet } from "@/components/settings/sheet";

/**
 * The portal has enough moving parts — a front page, a catalogue, forms,
 * knowledge, notices — that it needs a second level of navigation of its own.
 * Folding all of it into one settings page is how you end up with the wall of
 * fifty forms this replaces.
 */
export default async function PortalSettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!can(user, "settings.tickets")) notFound();

  const [t, settings] = await Promise.all([getMessages(), getSettings()]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-md font-semibold">{t.forms.title}</h2>
        <p className="text-text-3 text-sm">{t.forms.portalBlurb}</p>
        <span className="ml-auto flex items-center gap-3">
          <PortalSwitch open={settings.portalEnabled} reason={settings.portalClosedReason} />
          <span aria-hidden className="bg-line h-5 w-px" />
          <Link href="/portal" className={buttonClass("outline", "sm")}>
            <ExternalLink size={13} />
            {t.nav.portalSide}
          </Link>
        </span>
      </div>

      <PortalAdminNav />

      {/* The header and the tabs are this area's chrome and stay on the
          ground; the page under them is the sheet. */}
      <SettingsSheet className="p-5 lg:p-6">{children}</SettingsSheet>
    </div>
  );
}
