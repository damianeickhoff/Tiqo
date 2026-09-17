import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import { brandStyleSheet } from "@/lib/brand";
import { getMessages, getSettings } from "@/lib/settings";
import Script from "next/script";
import { THEME_COOKIE, THEME_SCRIPT, readThemeChoice } from "@/lib/ui-preferences";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: { default: "Tiqo", template: "%s · Tiqo" },
    description: t.nav.description,
    applicationName: "Tiqo",
    appleWebApp: { capable: true, title: "Tiqo", statusBarStyle: "default" },
  };
}

/** The colour the browser paints its own chrome with. It follows the choice
 *  when one has been made, and the machine otherwise. */
export async function generateViewport(): Promise<Viewport> {
  const choice = readThemeChoice((await cookies()).get(THEME_COOKIE)?.value);

  if (choice === "light") return { themeColor: "#fafafa" };
  if (choice === "dark") return { themeColor: "#0c0c0e" };

  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#fafafa" },
      { media: "(prefers-color-scheme: dark)", color: "#0c0c0e" },
    ],
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, jar] = await Promise.all([getSettings(), cookies()]);
  const choice = readThemeChoice(jar.get(THEME_COOKIE)?.value);

  return (
    // `lang` follows the instance locale so screen readers and the browser's own
    // typography rules match what is on screen.
    //
    // The theme is on the element from the very first byte. An explicit choice
    // is rendered here; "system" is left for the script below to resolve, which
    // it does before anything paints.
    <html
      lang={settings.locale}
      data-theme-choice={choice}
      data-theme={choice === "system" ? undefined : choice}
      suppressHydrationWarning
    >
      <head>
        {/* Through next/script rather than a bare <script>: React refuses to
            run a script element it renders itself, and says so on every load.
            "beforeInteractive" puts this in the document before hydration,
            which is the only moment it needs to run — it resolves "system" on
            the element before anything paints. */}
        <Script id="tiqo-theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        {/* The brand tokens are written into the document rather than the
            stylesheet: the stylesheet is a build artefact and this is a value an
            admin changes at runtime. Only the derived set is emitted, so every
            other token in globals.css still applies. */}
        <style
          id="tiqo-brand"
          dangerouslySetInnerHTML={{ __html: brandStyleSheet(settings.brandColor) }}
        />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} antialiased`}>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
