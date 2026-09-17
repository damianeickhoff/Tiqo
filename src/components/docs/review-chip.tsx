"use client";

import { AlertTriangle, CircleCheck, Infinity as Forever } from "lucide-react";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * How far a page is from being suspect.
 *
 * Three states and one of them is not a warning: a page that never goes stale
 * says so, because "no date" and "no date needed" are different facts and a
 * blank reads as the first. Nothing is ever hidden for being stale — the marker
 * is the whole of the consequence, which is what keeps people writing.
 *
 * `days` is worked out on the server and handed down: a clock read while
 * rendering on the client is a hydration mismatch waiting for midnight.
 */
export function ReviewChip({
  days,
  size = "md",
  className,
}: {
  /// Days until the review is due, negative once it is overdue, null when the
  /// page never expires.
  days: number | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useMessages();

  const stale = days !== null && days <= 0;
  const Icon = days === null ? Forever : stale ? AlertTriangle : CircleCheck;

  const label =
    days === null
      ? t.docs.neverStale
      : days < 0
        ? t.docs.overdueBy(-days)
        : days === 0
          ? t.docs.dueToday
          : t.docs.dueIn(days);

  return (
    <span
      title={stale ? t.docs.staleHint : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "h-5 px-2 text-xs" : "h-6 px-2.5 text-sm",
        stale
          ? "text-negative bg-[color-mix(in_oklab,var(--negative)_12%,transparent)]"
          : "text-text-2 bg-[color-mix(in_oklab,var(--text)_6%,transparent)]",
        className,
      )}
    >
      <Icon size={size === "sm" ? 11 : 12} className="shrink-0" />
      {/* The real sentence, not the word "Stale" over the top of it. How far
          past its date a page is decides whether somebody reads it this
          afternoon or next month, and "overdue by 94 days" says that where one
          flat word for everything from today to a year ago does not. */}
      {label}
    </span>
  );
}

/** The same fact as one word, for a row in a list where a sentence would not
 *  fit. Absent entirely when the page is fine — a list of thirty rows should
 *  only mark the ones that need something. */
export function StaleDot({ days }: { days: number | null }) {
  const t = useMessages();
  if (days === null || days > 0) return null;

  return (
    <span className="text-negative inline-flex items-center gap-1 text-xs font-semibold">
      <AlertTriangle size={11} />
      {t.docs.stale}
    </span>
  );
}
