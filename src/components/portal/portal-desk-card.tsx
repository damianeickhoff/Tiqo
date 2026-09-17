import { Clock, MessageCircleReply, Phone } from "lucide-react";
import { describeHours } from "@/lib/clock";
import { typicalReplyMinutes } from "@/lib/portal";
import { getClock, getMessages, getSettings } from "@/lib/settings";
import { shortSpan } from "@/lib/tickets";

/**
 * What the desk itself is doing: whether it is open and until when, how long
 * an answer usually takes, and — when the desk has one — the number to ring
 * when it is closed. The one card a requester reads before deciding between a
 * form and the phone.
 *
 * The phone row only exists when a number is set: a row saying "no phone"
 * would be the desk apologising for something nobody asked about.
 */
export async function PortalDeskCard() {
  const [settings, clock, reply, t] = await Promise.all([
    getSettings(),
    getClock(),
    typicalReplyMinutes(),
    getMessages(),
  ]);
  const hours = describeHours(clock.hours);

  // `lead` says which of the two lines carries the weight. On every row it is
  // the value — the hours, the usual wait. On the phone row it is the
  // condition: a number set in the strong line under a small grey caption is
  // read as the service desk's number, and rung at ten in the morning.
  const rows: {
    icon: typeof Clock;
    label: string;
    value: string;
    open?: boolean;
    lead?: "label";
  }[] = [
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
    ...(settings.deskPhone
      ? [
          {
            icon: Phone,
            label: t.portal.deskPhoneRow,
            value: settings.deskPhone,
            lead: "label" as const,
          },
        ]
      : []),
  ];

  return (
    <section className="pcard">
      <h2 className="px-5 pt-[18px] pb-3 text-[16px] font-semibold tracking-[-0.01em]">
        {t.portal.deskCard}
      </h2>
      <ul>
        {rows.map(({ icon: Icon, label, value, open, lead }) => (
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
              {lead === "label" ? (
                <>
                  <span className="block font-medium">{label}</span>
                  <span className="text-text-2 mt-0.5 block truncate">{value}</span>
                </>
              ) : (
                <>
                  <span className="text-text-3 block text-xs">{label}</span>
                  <span className="block truncate font-medium">{value}</span>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
