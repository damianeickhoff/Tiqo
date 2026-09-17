import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, Info, OctagonAlert } from "lucide-react";
import type { AnnouncementTone } from "@/generated/prisma/enums";
import { PortalIcon } from "@/components/portal/portal-icon";
import { messagesFor } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The portal's vocabulary of cards and rows, in one place so every band of
 * the front page, every catalogue page and every search result is made of the
 * same pieces. A portal assembled from one kit reads as a product; one where
 * each page invents its own cards reads as a series of screens.
 *
 * Round 12: contrast by fill. Cards are white on the grey ground with a low
 * shadow and no border; category colour is used solid on round tiles.
 */

/** A round tile in a section's colour, the icon white on it. */
export function Tile({
  icon,
  color,
  size = 42,
  className,
}: {
  icon?: string | null;
  color: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-full text-white", className)}
      style={{ width: size, height: size, background: color }}
    >
      <PortalIcon name={icon ?? null} size={Math.round(size * 0.45)} />
    </span>
  );
}

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
  return (
    <Link
      href={href}
      className="pcard pcard-interactive group flex h-full min-h-[164px] flex-col gap-3.5 px-[22px] pt-[22px] pb-[18px]"
    >
      <Tile icon={icon} color={color ?? "var(--brand)"} />
      <span className="block text-[15.5px] leading-[1.25] font-semibold tracking-[-0.015em]">
        {title}
      </span>
      {summary ? (
        <span className="text-text-2 -mt-2 line-clamp-2 block text-[13.5px] leading-[1.45]">
          {summary}
        </span>
      ) : null}
      <span className="text-text-3 mt-auto flex items-center text-[12.5px]">
        {meta}
        <ArrowRight
          size={14}
          aria-hidden
          className={cn(
            "group-hover:text-text ml-auto transition-opacity",
            alwaysArrow ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        />
      </span>
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
    <Link
      href={href}
      className="pcard pcard-interactive group flex h-full items-start gap-3.5 px-[22px] py-[18px]"
    >
      <span
        aria-hidden
        className="bg-surface-2 text-text-2 flex size-[34px] shrink-0 items-center justify-center rounded-full"
      >
        <BookOpen size={15} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] leading-[1.3] font-semibold">{title}</span>
        {summary ? (
          <span className="text-text-2 mt-[3px] line-clamp-2 block text-[13px]">{summary}</span>
        ) : null}
        {meta ? <span className="text-text-3 mt-1.5 block text-xs">{meta}</span> : null}
      </span>
    </Link>
  );
}

/**
 * One answer inside the two-column answers card. The card holds the rows;
 * a row is a link with a book tile, and the hover is a well rather than a lift
 * because the rows share one surface.
 */
export function AnswerRow({
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
    <Link
      href={href}
      className="hover:bg-surface-2 flex gap-3.5 rounded-xl px-[18px] py-4 transition-colors"
    >
      <span
        aria-hidden
        className="bg-surface-2 text-text-2 flex size-[34px] shrink-0 items-center justify-center rounded-full"
      >
        <BookOpen size={15} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14.5px] leading-[1.3] font-semibold">{title}</span>
        {summary ? (
          <span className="text-text-2 mt-[3px] line-clamp-2 block text-[13px]">{summary}</span>
        ) : null}
        {meta ? <span className="text-text-3 mt-1.5 block text-xs">{meta}</span> : null}
      </span>
    </Link>
  );
}

const TONES: Record<AnnouncementTone, { icon: typeof Info; bar: string; text: string }> = {
  INFO: { icon: Info, bar: "var(--info)", text: "text-info" },
  WARNING: { icon: AlertTriangle, bar: "var(--brand)", text: "text-brand-deep" },
  OUTAGE: { icon: OctagonAlert, bar: "var(--negative)", text: "text-negative" },
};

/**
 * A notice everyone should read before raising a ticket about it: a card with
 * the tone's colour down its left edge. The band under the bar is the same
 * notice on every page; this is the one in the front page's flow.
 */
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
    <div className="pcard relative flex items-start gap-3 overflow-hidden py-4 pr-[22px] pl-[26px]">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: bar }} />
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

/**
 * How many there are, beside a heading.
 *
 * Mono, because it is a number the eye compares down a page of headings, and
 * the proportional face makes 7 and 11 the same width.
 */
export function Count({ n }: { n: number }) {
  return <span className="tnum font-mono text-[12.5px] font-medium">{n}</span>;
}

/** A section's heading: the title, what it is in a few words, and a way through to everything in it. */
export function BandHeader({
  title,
  subtitle,
  href,
  linkLabel,
}: {
  title: string;
  /// A few words, or a count — the pages that put a number here draw it in
  /// mono, which a string could not carry.
  subtitle?: ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-[18px] flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
      <h2 className="text-[24px] leading-tight font-semibold tracking-[-0.025em]">{title}</h2>
      {subtitle ? <p className="text-text-3 text-base">{subtitle}</p> : null}
      {href ? (
        <Link
          href={href}
          className="bg-surface text-text-2 hover:text-text group ml-auto inline-flex h-8 items-center gap-1.5 self-center rounded-full px-3 text-[13.5px] font-semibold shadow-[var(--highlight)] transition-colors"
        >
          {linkLabel}
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}
