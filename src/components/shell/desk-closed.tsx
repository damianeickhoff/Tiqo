import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { messagesFor } from "@/lib/i18n";
import { brandStyleSheet } from "@/lib/brand";
import { logout } from "@/lib/actions/auth";
import { Card, buttonClass } from "@/components/ui";

/**
 * What an account without desk access sees if it reaches the desk with the
 * portal shut.
 *
 * A page rather than a redirect on purpose: with nowhere to send them, a
 * redirect is a loop. Telling someone plainly that their account works
 * elsewhere is also simply better than bouncing them around.
 */
export function DeskClosed({ locale, brandColor }: { locale: string; brandColor: string }) {
  const t = messagesFor(locale);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: brandStyleSheet(brandColor) }} />
      <div className="bg-bg flex min-h-dvh items-center justify-center px-5 py-10">
        <Card className="w-full max-w-[420px] p-7 text-center">
          <span
            aria-hidden
            className="text-brand-deep rounded-card mx-auto flex size-12 items-center justify-center bg-[var(--brand-tint)]"
          >
            <LifeBuoy size={22} />
          </span>

          <h1 className="mt-4 text-xl font-extrabold tracking-[-0.02em]">{t.nav.deskOnly}</h1>
          <p className="text-text-2 text-md mt-2 leading-relaxed">{t.nav.deskOnlyBody}</p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link href="/portal" className={buttonClass("primary", "md")}>
              {t.nav.toPortal}
            </Link>
            <form action={logout}>
              <button type="submit" className={buttonClass("ghost", "md")}>
                {t.nav.signOut}
              </button>
            </form>
          </div>
        </Card>
      </div>
    </>
  );
}
