import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import type { AnnouncementTone } from "@/generated/prisma/enums";
import { messagesFor } from "@/lib/i18n";

/**
 * A notice under the bar, as a solid band: one colour per tone, so an outage
 * and a heads-up are told apart before a word is read. Blue is information,
 * the brand colour is a warning, red is an outage.
 *
 * Under the bar rather than above it: above, it read as part of the browser
 * rather than the portal, and the thing it had to say was the first thing
 * scrolled away.
 */
// Blue, orange, red — the three colours a notice can be, and none of them the
// tenant's. A warning painted in the brand colour is the same amber as the
// buttons and the pills, so the one band that has to mean "read this" looked
// like part of the furniture.
const TONES: Record<AnnouncementTone, { icon: typeof Info; background: string }> = {
  INFO: { icon: Info, background: "var(--info)" },
  WARNING: { icon: AlertTriangle, background: "var(--p-high)" },
  OUTAGE: { icon: OctagonAlert, background: "var(--negative)" },
};

export function NoticeBand({
  title,
  body,
  tone,
  endsAt,
  locale = "en-GB",
  wrap = true,
}: {
  title: string;
  body: string | null;
  tone: AnnouncementTone;
  /// False drops the portal's column around it, for the settings preview,
  /// which shows the band inside a panel that already has its own width.
  wrap?: boolean;
  /// When it stops being true. Shown, because "the lift is out" means something
  /// different on its own than it does with "until Friday" after it.
  endsAt?: Date | null;
  locale?: string;
}) {
  const { icon: Icon, background } = TONES[tone];
  const t = messagesFor(locale);
  const until = endsAt
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(endsAt)
    : null;

  return (
    <div className={wrap ? "portal-wrap mt-2" : undefined}>
      <div
        className="flex min-h-[52px] items-center gap-3 rounded-[14px] px-5 py-2 text-base text-white"
        style={{ background }}
      >
        <Icon size={16} className="shrink-0" aria-hidden />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">{title}</span>
          {body ? <span className="opacity-90"> · {body}</span> : null}
        </p>
        {until ? (
          <span className="shrink-0 text-sm whitespace-nowrap opacity-80">
            {t.portal.until(until)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
