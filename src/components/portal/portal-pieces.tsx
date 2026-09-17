import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Info,
  MessageSquare,
  OctagonAlert,
} from "lucide-react";
import type { AnnouncementTone } from "@/generated/prisma/enums";
import { PortalIcon } from "@/components/portal/portal-icon";
import { messagesFor } from "@/lib/i18n";
import { getMessages } from "@/lib/settings";
import { shortAge } from "@/lib/tickets";
import { cn } from "@/lib/utils";

/**
 * The portal's vocabulary of cards and banners, in one place so every band of
 * the front page, every catalogue page and every search result is made of the
 * same pieces. A portal assembled from one kit reads as a product; one where
 * each page invents its own cards reads as a series of screens.
 */

export function ServiceCard({
  href,
  title,
  summary,
  icon,
  color,
  meta,
  alwaysArrow = false,
}: {
  href: string;
  title: string;
  summary?: string | null;
  icon?: string | null;
  color?: string;
  meta?: string | null;
  /// The arrow stays put rather than waiting for a hover — on a card that is
  /// offered as a way out, the way out should be visible.
  alwaysArrow?: boolean;
}) {
  const tone = color ?? "var(--brand)";

  return (
    <Link href={href} className="card card-interactive group flex h-full items-start gap-3.5 p-4">
      <span
        aria-hidden
        className="rounded-control flex size-10 shrink-0 items-center justify-center"
        style={{ background: `color-mix(in oklab, ${tone} 15%, transparent)`, color: tone }}
      >
        <PortalIcon name={icon ?? null} size={19} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="group-hover:text-brand-deep text-md block leading-snug font-semibold transition-colors">
          {title}
        </span>
        {summary ? (
          <span className="text-text-3 mt-1 block text-base leading-snug">{summary}</span>
        ) : null}
        {meta ? <span className="text-text-3 mt-1.5 block text-xs">{meta}</span> : null}
      </span>

      <ArrowRight
        size={15}
        aria-hidden
        className={cn(
          "text-text-3 mt-0.5 shrink-0 transition-all group-hover:translate-x-0.5",
          alwaysArrow ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      />
    </Link>
  );
}

export function ArticleCard({
  href,
  title,
  summary,
  meta,
}: {
  href: string;
  title: string;
  summary?: string | null;
  meta?: string | null;
}) {
  return (
    <Link href={href} className="card card-interactive group flex h-full items-start gap-3.5 p-4">
      <span
        aria-hidden
        className="bg-surface-3 text-text-2 rounded-control flex size-10 shrink-0 items-center justify-center"
      >
        <BookOpen size={18} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="group-hover:text-brand-deep text-md block leading-snug font-semibold transition-colors">
          {title}
        </span>
        {summary ? (
          <span className="text-text-3 mt-1 line-clamp-2 block text-base leading-snug">
            {summary}
          </span>
        ) : null}
        {meta ? <span className="text-text-3 mt-1.5 block text-xs">{meta}</span> : null}
      </span>
    </Link>
  );
}

/** A hairline card with a bar of the tone's colour down its left edge. */
const TONES: Record<AnnouncementTone, { icon: typeof Info; bar: string; text: string }> = {
  INFO: { icon: Info, bar: "var(--text-3)", text: "text-text-2" },
  WARNING: { icon: AlertTriangle, bar: "var(--brand)", text: "text-brand-deep" },
  OUTAGE: { icon: OctagonAlert, bar: "var(--negative)", text: "text-negative" },
};

/** A notice everyone should read before raising a ticket about it. */
export function Announcement({
  title,
  body,
  tone,
  endsAt,
  locale = "en-GB",
}: {
  title: string;
  body: string | null;
  tone: AnnouncementTone;
  /// When it stops being true. Shown, because "the lift is out" means something
  /// different on its own than it does with "until Friday" after it.
  endsAt?: Date | null;
  locale?: string;
}) {
  const { icon: Icon, bar, text } = TONES[tone];
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
    <div className="card relative flex items-start gap-3 overflow-hidden py-3.5 pr-4 pl-5">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: bar }} />
      <Icon size={16} className={cn("mt-0.5 shrink-0", text)} />
      <div className="min-w-0 flex-1">
        <p className="text-md font-semibold">{title}</p>
        {body ? <p className="text-text-2 mt-0.5 text-base leading-relaxed">{body}</p> : null}
      </div>
      {until ? (
        <span className="text-text-3 shrink-0 font-mono text-xs whitespace-nowrap">
          {t.portal.until(until)}
        </span>
      ) : null}
    </div>
  );
}

/** A band's heading, with a way through to everything in it. */
export function BandHeader({
  title,
  subtitle,
  href,
  linkLabel,
}: {
  title: string;
  subtitle?: string | null;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.01em]">{title}</h2>
        {subtitle ? <p className="text-text-3 mt-0.5 text-sm">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="text-text-2 hover:text-brand-deep group flex items-center gap-1 text-base font-medium transition-colors"
        >
          {linkLabel}
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * The desk has asked this person something and is waiting on the answer.
 *
 * The same banner on the front page and on their list of requests: it is the
 * one thing on the portal that is addressed to them personally, and a person
 * who meets it in two places should meet the same object twice.
 */
export async function WaitingBanner({
  href,
  who,
  reference,
  title,
  since,
}: {
  href: string;
  who: string;
  reference: string;
  title: string;
  /// When the desk stopped the clock and started waiting on them.
  since: Date;
}) {
  const t = await getMessages();

  return (
    <Link
      href={href}
      className="border-brand/35 flex items-center gap-3 rounded-[var(--radius-card)] border px-4 py-3 transition-colors hover:border-[var(--brand)]"
      style={{ background: "var(--brand-wash)" }}
    >
      <MessageSquare size={16} className="text-brand-deep shrink-0" aria-hidden />
      <span className="text-md min-w-0 flex-1">
        <span className="font-semibold">{t.portal.waitingFor(who.split(" ")[0] ?? who)}</span>{" "}
        <span className="font-semibold underline underline-offset-2">{reference}</span>
        <span className="text-text-2"> · {title}</span>
      </span>
      {/* How long they have been kept waiting, in the same mono the rest of
          the portal counts in. "Two days" is the part of this that makes
          somebody answer today. */}
      <span className="text-text-2 hidden shrink-0 font-mono text-xs whitespace-nowrap sm:block">
        {t.portal.longestWait(shortAge(since))}
      </span>

      <span className="text-brand-deep inline-flex shrink-0 items-center gap-1 text-base font-semibold">
        {t.portal.replyNow}
        <ChevronRight size={14} />
      </span>
    </Link>
  );
}
