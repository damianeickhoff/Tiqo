import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getMessages, getSettings } from "@/lib/settings";
import { THEME_COOKIE, readThemeChoice } from "@/lib/ui-preferences";
import { AuthCanvas } from "@/components/auth-canvas";
import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.auth.createAccount };
}

export default async function RegisterPage() {
  const [settings, userCount, t, jar] = await Promise.all([
    getSettings(),
    prisma.user.count(),
    getMessages(),
    cookies(),
  ]);
  const theme = readThemeChoice(jar.get(THEME_COOKIE)?.value);
  const isFirstUser = userCount === 0;

  const back = (
    <p className="text-text-2 text-md">
      {t.auth.haveAccount}{" "}
      <Link
        href="/login"
        className="text-brand-deep font-semibold underline-offset-4 hover:underline"
      >
        {t.auth.signIn}
      </Link>
    </p>
  );

  // Closing sign-ups never locks the instance out: with nobody in it, the first
  // account still has to come from somewhere.
  if (!settings.selfRegistration && !isFirstUser) {
    return (
      <AuthCanvas
        locale={settings.locale}
        theme={theme}
        title={t.auth.closedTitle}
        blurb={t.auth.closedBlurb}
        footer={back}
      >
        <Link href="/login" className="text-brand-deep text-md block text-center font-semibold">
          {t.auth.signIn}
        </Link>
      </AuthCanvas>
    );
  }

  return (
    <AuthCanvas
      locale={settings.locale}
      theme={theme}
      title={t.auth.createAccount}
      blurb={isFirstUser ? t.auth.firstUser : t.auth.laterUser}
      footer={back}
    >
      <RegisterForm locale={settings.locale} />
    </AuthCanvas>
  );
}
