import Link from "next/link";
import { DoorClosed } from "lucide-react";
import { messagesFor } from "@/lib/i18n";
import { brandStyleSheet } from "@/lib/brand";
import { Logo } from "@/components/shell/logo";
import { buttonClass } from "@/components/ui";

/**
 * The portal, shut.
 *
 * Not a redirect: somebody who has been told to raise their requests here and
 * arrives to find a bounce learns nothing, and phones instead. The door is
 * still answered — it says why it is closed, in the desk's own words, which is
 * why closing it asks for those words first.
 */
export function PortalClosed({
  locale,
  brandColor,
  title,
  reason,
  canUseDesk,
}: {
  locale: string;
  brandColor: string;
  title: string;
  reason: string | null;
  /// Operators keep a way back to the desk; a requester has nowhere to go.
  canUseDesk: boolean;
}) {
  const t = messagesFor(locale);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: brandStyleSheet(brandColor) }} />
      <div className="bg-bg flex min-h-dvh flex-col">
        <header className="border-line border-b">
          <div className="portal-width mx-auto flex h-14 w-full items-center gap-3 px-5 lg:px-6">
            <Logo size={26} />
            <span className="text-text-3 border-line border-l pl-3 text-base">{title}</span>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-5 py-16">
          <div className="w-full">
            <span
              aria-hidden
              className="text-brand-deep rounded-control flex size-11 items-center justify-center"
              style={{ background: "var(--brand-tint)" }}
            >
              <DoorClosed size={22} />
            </span>

            <h1 className="mt-4 text-xl font-semibold tracking-[-0.02em]">
              {t.portal.closedTitle}
            </h1>
            <p className="text-text-2 text-md mt-2 leading-relaxed">
              {reason || t.portal.closedFallback}
            </p>

            {canUseDesk ? (
              <Link href="/" className={`${buttonClass("outline", "md")} mt-6`}>
                {t.portal.toTheDesk}
              </Link>
            ) : null}
          </div>
        </main>
      </div>
    </>
  );
}
