import { Clock, MessageCircleReply } from "lucide-react";
import { describeHours } from "@/lib/clock";
import { typicalReplyMinutes } from "@/lib/portal";
import { getClock, getMessages } from "@/lib/settings";
import { shortSpan } from "@/lib/tickets";

/**
 * What the desk itself is doing: whether it is open and until when, and how
 * long an answer usually takes. The one card a requester reads before deciding
 * whether to wait.
 */
export async function PortalDeskCard() {
  const [clock, reply, t] = await Promise.all([getClock(), typicalReplyMinutes(), getMessages()]);
  const hours = describeHours(clock.hours);

  const rows: { icon: typeof Clock; label: string; value: string; open?: boolean }[] = [
    {
      icon: Clock,
      label: t.portal.openingHours,
      value:
        hours.open === null
          ? t.portal.alwaysOpen
          : hours.open
            ? `${t.portal.openUntil(hours.range.split("–")[1] ?? hours.range)} · ${hours.days} ${hours.range}`
            : `${t.portal.deskClosed} · ${hours.days} ${hours.range}`,
      open: hours.open !== false,
    },
    {
      icon: MessageCircleReply,
      label: t.portal.typicalReply,
      value:
        reply === null ? t.portal.noTypicalReply : t.portal.aboutSpan(shortSpan(reply * 60_000, t)),
    },
  ];

  return (
    <section className="pcard">
      <h2 className="px-5 pt-[18px] pb-3 text-[16px] font-semibold tracking-[-0.01em]">
        {t.portal.deskCard}
      </h2>
      <ul>
        {rows.map(({ icon: Icon, label, value, open }) => (
          <li
            key={label}
            className="border-line flex items-center gap-3.5 border-t px-5 py-3 text-base last:pb-[18px]"
          >
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full"
              style={
                open
                  ? {
                      background: "color-mix(in oklab, var(--positive) 14%, transparent)",
                      color: "var(--positive)",
                    }
                  : { background: "var(--surface-2)", color: "var(--text-2)" }
              }
            >
              <Icon size={16} />
            </span>
            <span className="min-w-0">
              <span className="text-text-3 block text-xs">{label}</span>
              <span className="block truncate font-medium">{value}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
