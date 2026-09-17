import Link from "next/link";
import { DoorClosed } from "lucide-react";
import { messagesFor } from "@/lib/i18n";
import { brandStyleSheet } from "@/lib/brand";
import { Logo } from "@/components/shell/logo";

/**
 * The portal, shut.
 *
 * Not a redirect: somebody who has been told to raise their requests here and
 * arrives to find a bounce learns nothing, and phones instead. The door is
 * still answered — it says why it is closed, in the desk's own words, which is
 * why closing it asks for those words first.
 *
 * The layout returns this instead of the shell, so it carries the bar, the
 * ground and the brand sheet itself.
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
        {/* The same lockup the portal's bar wears, with nothing beside it:
            there is nowhere to go from here, and a row of dead links would
            only invite clicking. */}
        <header className="portal-wrap flex h-[68px] shrink-0 items-center gap-2.5">
          <Logo size={26} wordmark={false} />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">{title}</span>
        </header>

        <main className="portal-wrap flex flex-1 items-center justify-center py-12">
          <div className="pcard w-full max-w-[560px] px-9 py-12 text-center">
            <span
              aria-hidden
              className="bg-brand text-brand-fg mx-auto flex size-14 items-center justify-center rounded-full"
            >
              <DoorClosed size={26} />
            </span>

            <h1 className="mt-5 text-[26px] leading-tight font-semibold tracking-[-0.025em]">
              {t.portal.closedTitle}
            </h1>
            <p className="text-text-2 mx-auto mt-3 max-w-[46ch] text-[15px] leading-relaxed">
              {reason || t.portal.closedFallback}
            </p>

            {canUseDesk ? (
              <Link
                href="/"
                className="bg-surface-2 text-text hover:bg-bg mt-7 inline-flex h-[42px] items-center rounded-full px-[18px] text-[14px] font-semibold transition-colors"
              >
                {t.portal.toTheDesk}
              </Link>
            ) : null}
          </div>
        </main>
      </div>
    </>
  );
}
