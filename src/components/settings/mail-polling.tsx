"use client";

import { useState, useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { pollMailNow } from "@/lib/actions/mail";
import { Button } from "@/components/ui";
import { CopyValue } from "@/components/copy-value";
import { useDateFormat, useMessages } from "@/components/shell/instance-context";
import type { PollSummary } from "@/lib/settings";

/**
 * The route somebody outside the app has to call, and what it did last time.
 *
 * The third card on the Connection tab, and the only one with nothing to save:
 * the address is derived and the token is an environment variable, so the
 * decisions here were taken outside this screen. What it can do is the same as
 * the other two — run the thing and say whether it worked.
 */
export function MailPollingCard({
  url,
  tokenSet,
  tokenMatters,
  lastPolledAt,
  summary,
}: {
  url: string;
  tokenSet: boolean;
  /// Whether a missing token is worth saying loudly. An instance that collects
  /// no mail has no reason to be polled at all.
  tokenMatters: boolean;
  lastPolledAt: Date | null;
  summary: PollSummary | null;
}) {
  const t = useMessages();
  const when = useDateFormat({
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const [running, startTransition] = useTransition();
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="space-y-5">
      <dl className="text-md space-y-3">
        <div>
          <dt className="label mb-1">{t.mail.pollRoute}</dt>
          {/* Copyable, because the only thing anybody does with this line is
              paste it into a cron entry — and a ragged wrapped address is one
              somebody retypes by hand and gets wrong. */}
          <dd className="text-text-2 min-w-0 font-mono text-sm">
            <CopyValue value={url} />
          </dd>
        </div>

        <div>
          <dt className="label mb-1">{t.mail.pollToken}</dt>
          <dd
            className={!tokenSet && tokenMatters ? "text-negative text-sm" : "text-text-2 text-sm"}
          >
            {tokenSet ? t.mail.pollTokenSet : t.mail.pollTokenMissing}
          </dd>
        </div>

        <div>
          <dt className="label mb-1">{t.mail.pollLastRun}</dt>
          <dd className="text-text-2 text-sm">
            {lastPolledAt
              ? `${when.format(lastPolledAt)} · ${t.mail.pollCounts(
                  summary?.filed ?? 0,
                  summary?.bounced ?? 0,
                  summary?.skipped ?? 0,
                )}`
              : t.mail.pollNever}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={running}
          onClick={() =>
            startTransition(async () => {
              setSaid(null);
              const result = await pollMailNow();
              setSaid(
                result.ok
                  ? { ok: true, text: t.mail.pollRan(result.counts.sent, result.counts.filed) }
                  : { ok: false, text: result.error ?? t.errors.generic },
              );
            })
          }
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {running ? t.mail.healthRunning : t.mail.healthNow}
        </Button>

        {said ? (
          <span
            className={
              said.ok
                ? "text-positive animate-fade text-sm font-medium"
                : "text-negative animate-fade min-w-0 text-sm font-medium"
            }
          >
            {said.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
