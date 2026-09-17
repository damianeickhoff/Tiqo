import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getMessages, getSettings } from "@/lib/settings";
import { THEME_COOKIE, readThemeChoice } from "@/lib/ui-preferences";
import { AuthCanvas } from "@/components/auth-canvas";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.auth.signIn };
}

export default async function LoginPage() {
  const [t, settings, jar] = await Promise.all([getMessages(), getSettings(), cookies()]);
  const theme = readThemeChoice(jar.get(THEME_COOKIE)?.value);

  return (
    <AuthCanvas
      locale={settings.locale}
      theme={theme}
      title={t.auth.welcome}
      blurb={t.auth.signInBlurb}
      footer={
        settings.selfRegistration ? (
          <p className="text-text-2 text-md">
            {t.auth.noAccount}{" "}
            <Link
              href="/register"
              className="text-brand-deep font-semibold underline-offset-4 hover:underline"
            >
              {t.auth.createOne}
            </Link>
          </p>
        ) : null
      }
    >
      <LoginForm locale={settings.locale} />
    </AuthCanvas>
  );
}
