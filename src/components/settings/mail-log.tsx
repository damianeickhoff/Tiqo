"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  RotateCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import type { MailDirection, MailStatus } from "@/generated/prisma/enums";
import { resendMail } from "@/lib/actions/mail";
import { Button, buttonClass, FormError, Input } from "@/components/ui";
import { useDateFormat, useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type MailLogRow = {
  id: string;
  direction: MailDirection;
  status: MailStatus;
  /// The other end of the message: who it went to, or — inbound — who sent it.
  to: string;
  subject: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  ticket: { number: number; reference: string } | null;
};

/** What each state looks like. Only the two that need saying are coloured: a
 *  queue of green ticks is a queue nobody scans for the red one. */
const TONE: Record<MailStatus, string> = {
  PENDING: "text-text-2 bg-[color-mix(in_oklab,var(--text)_6%,transparent)]",
  SENDING: "text-text-2 bg-[color-mix(in_oklab,var(--text)_6%,transparent)]",
  SENT: "text-positive bg-[color-mix(in_oklab,var(--positive)_12%,transparent)]",
  RECEIVED: "text-text-2 bg-[color-mix(in_oklab,var(--text)_6%,transparent)]",
  FAILED: "text-negative bg-[color-mix(in_oklab,var(--negative)_12%,transparent)]",
};

const COLUMNS =
  "grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 gap-y-1 lg:grid-cols-[1rem_minmax(0,1.6fr)_minmax(0,1.1fr)_7rem_5.5rem_5.5rem_5.5rem] lg:items-center";

type Filter = "all" | "out" | "in" | "failed";

/**
 * What the mailbox has actually done.
 *
 * The log is the only place the server's own refusal — "550 relay denied" — is
 * readable by the person who can do something about it, so the failed row keeps
 * its whole sentence rather than a tooltip.
 *
 * The filter and the search run over the fifty rows already on screen rather
 * than going back to the server: fifty is the whole of what this page holds, and
 * a round trip to narrow fifty rows is a round trip to watch a spinner.
 *
 * Sending again is a list-level command and happens on the click. It does not
 * send: it puts the row back on the queue, and the next drain does the work,
 * which is the shape of every other send in this feature.
 */
export function MailLog({ rows }: { rows: MailLogRow[] }) {
  const t = useMessages();
  const when = useDateFormat({
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const [, startTransition] = useTransition();
  const [resending, setResending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const failed = rows.filter((row) => row.status === "FAILED").length;

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "out" && row.direction !== "OUT") return false;
      if (filter === "in" && row.direction !== "IN") return false;
      if (filter === "failed" && row.status !== "FAILED") return false;
      if (!needle) return true;
      return [row.subject, row.to, row.ticket?.reference ?? ""].some((field) =>
        field.toLowerCase().includes(needle),
      );
    });
  }, [rows, filter, query]);

  if (rows.length === 0) {
    return <p className="text-text-3 text-base">{t.mail.logEmpty}</p>;
  }

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: t.mail.logAll },
    { key: "out", label: t.mail.logStatus.SENT },
    { key: "in", label: t.mail.logStatus.RECEIVED },
    { key: "failed", label: t.mail.logStatus.FAILED, count: failed },
  ];

  return (
    <div className="space-y-2">
      <FormError>{error ?? undefined}</FormError>

      <div className="card overflow-hidden">
        <div className="bg-surface-2 flex flex-wrap items-center gap-2 px-3 py-2">
          <div className="bg-surface rounded-control flex border border-transparent p-0.5 shadow-[var(--highlight)]">
            {filters.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                aria-pressed={filter === option.key}
                className={cn(
                  buttonClass(filter === option.key ? "outline" : "ghost", "sm"),
                  "h-7 border-0 shadow-none",
                  filter === option.key && "bg-surface-3 text-text",
                )}
              >
                {option.label}
                {option.count ? <span className="font-mono text-xs">{option.count}</span> : null}
              </button>
            ))}
          </div>

          <label className="relative min-w-0 flex-1 basis-[14rem]">
            <Search
              size={13}
              className="text-text-3 pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.mail.logSearch}
              aria-label={t.mail.logSearch}
              className="h-8 pl-7 text-sm"
            />
          </label>

          <span className="text-text-3 ml-auto text-xs">{t.mail.logFoot}</span>
        </div>

        {shown.length === 0 ? (
          <p className="text-text-3 px-3 py-6 text-center text-base">{t.mail.logNoMatch}</p>
        ) : (
          <ul className="divide-line divide-y">
            {shown.map((row) => (
              <li key={row.id}>
                <div
                  className={cn(
                    COLUMNS,
                    "px-3 py-2",
                    row.status === "FAILED" &&
                      "bg-[color-mix(in_oklab,var(--negative)_5%,transparent)]",
                  )}
                >
                  {/* Which way it went, as a shape rather than a word: the
                      column is read down, and two arrows are quicker than two
                      nouns. */}
                  <span
                    title={row.direction === "IN" ? t.mail.logIn : t.mail.logOut}
                    className="text-text-3 flex shrink-0"
                  >
                    {row.direction === "IN" ? (
                      <ArrowDownLeft size={13} aria-label={t.mail.logIn} />
                    ) : (
                      <ArrowUpRight size={13} aria-label={t.mail.logOut} />
                    )}
                  </span>

                  <span className="min-w-0 truncate text-base font-medium">{row.subject}</span>

                  <span className="text-text-2 min-w-0 truncate font-mono text-xs">{row.to}</span>

                  <span className="min-w-0 truncate">
                    {row.ticket ? (
                      <Link
                        href={`/tickets/${row.ticket.number}`}
                        className="hover:text-brand-deep text-text-2 font-mono text-xs transition-colors"
                      >
                        {row.ticket.reference}
                      </Link>
                    ) : (
                      <span className="text-text-3 text-xs">—</span>
                    )}
                  </span>

                  <span>
                    <span
                      className={cn(
                        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
                        TONE[row.status],
                      )}
                    >
                      {t.mail.logStatus[row.status]}
                    </span>
                  </span>

                  <span className="text-text-3 font-mono text-xs">
                    {when.format(row.createdAt)}
                  </span>

                  <span className="flex justify-end">
                    {row.status === "FAILED" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={resending === row.id}
                        onClick={() => {
                          setResending(row.id);
                          setError(null);
                          startTransition(async () => {
                            const result = await resendMail(row.id);
                            setResending(null);
                            if (!result.ok) setError(result.error ?? t.errors.generic);
                          });
                        }}
                      >
                        {resending === row.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <RotateCw size={13} />
                        )}
                        {resending === row.id ? t.mail.logResending : t.mail.logResend}
                      </Button>
                    ) : row.attempts > 1 ? (
                      // Only where it means something. One try is what every
                      // sent message took, and saying so on all fifty rows is a
                      // column of noise.
                      <span className="text-text-3 font-mono text-xs">
                        {t.mail.logAttempts(row.attempts)}
                      </span>
                    ) : null}
                  </span>
                </div>

                {/* The server's own sentence, under the row rather than in a
                    tooltip: it is the whole reason somebody opened this list. */}
                {row.lastError ? (
                  <div className="flex items-start gap-2 bg-[color-mix(in_oklab,var(--negative)_5%,transparent)] px-3 pt-0 pb-2 pl-9">
                    <TriangleAlert size={13} className="text-negative mt-0.5 shrink-0" />
                    <p className="text-negative min-w-0 font-mono text-xs break-words">
                      {row.lastError}
                    </p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
