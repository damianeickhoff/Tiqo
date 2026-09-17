import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canUseDesk } from "@/lib/permissions";
import { DeskClosed } from "@/components/shell/desk-closed";
import { dateLocaleOf, getClock, getSettings } from "@/lib/settings";
import { AppShell } from "@/components/shell/app-shell";
import { listNotifications } from "@/lib/actions/notifications";
import { SIDEBAR_COOKIE, THEME_COOKIE, readThemeChoice } from "@/lib/ui-preferences";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // The desk is a permission now, not a side effect of having an account. An
  // account without it belongs on the portal — and is sent there, unless the
  // portal is shut, in which case it is told rather than bounced: two guards
  // redirecting at each other is how a page ends in "too many redirects".
  if (!canUseDesk(user)) {
    const settings = await getSettings();
    if (settings.portalEnabled) redirect("/portal");
    return <DeskClosed locale={settings.locale} brandColor={settings.brandColor} />;
  }

  // Read here so the sidebar renders at its remembered width server-side.
  // The bell's contents ride along with the page rather than polling: every
  // navigation is already a round trip, and opening the bell refetches.
  const [jar, clock, settings, bell] = await Promise.all([
    cookies(),
    getClock(),
    getSettings(),
    listNotifications(),
  ]);

  return (
    <AppShell
      user={user}
      defaultCollapsed={jar.get(SIDEBAR_COOKIE)?.value === "1"}
      clock={clock}
      locale={settings.locale}
      dateLocale={dateLocaleOf(settings)}
      notices={bell.notices}
      unread={bell.unread}
      portalOpen={settings.portalEnabled}
      theme={readThemeChoice(jar.get(THEME_COOKIE)?.value)}
      avatarFallback={settings.avatarFallback}
    >
      {children}
    </AppShell>
  );
}
