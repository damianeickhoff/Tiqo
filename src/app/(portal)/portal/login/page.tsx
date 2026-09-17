import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { getMessages, getSettings } from "@/lib/settings";
import { THEME_COOKIE, readThemeChoice } from "@/lib/ui-preferences";
import { AuthCanvas } from "@/components/auth-canvas";
import { LoginForm } from "@/app/(auth)/login/login-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.signIn };
}

/**
 * The portal's own way in.
 *
 * Same accounts, same session, same canvas — a separate door, not a separate
 * identity. It lands people back on the portal rather than the desk, which is
 * the whole point: a requester who signs in here should never see a queue.
 */
export default async function PortalLogin() {
  const [user, settings, t, jar] = await Promise.all([
    getCurrentUser(),
    getSettings(),
    getMessages(),
    cookies(),
  ]);
  const theme = readThemeChoice(jar.get(THEME_COOKIE)?.value);

  if (user) redirect("/portal");
  if (!settings.portalEnabled) redirect("/login");

  return (
    <AuthCanvas
      locale={settings.locale}
      theme={theme}
      title={settings.portalTitle}
      blurb={t.portal.signInBlurb}
    >
      <LoginForm locale={settings.locale} next="/portal" />
    </AuthCanvas>
  );
}
