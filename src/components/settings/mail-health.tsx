"use client";

import { useState, useTransition } from "react";
import { Clock, Inbox, Loader2, Play, RotateCw, Send } from "lucide-react";
import { pollMailNow, retryFailedMail } from "@/lib/actions/mail";
import { Button } from "@/components/ui";
import { CopyValue } from "@/components/copy-value";
import { useMessages } from "@/components/shell/instance-context";
import { shortAge } from "@/lib/tickets";
import { cn } from "@/lib/utils";

/**
 * Whether mail is working, above every tab.
 *
 * The four things somebody opening this screen at two in the morning wants to
 * know, and the two commands that follow from them. It sits over the tabs
 * rather than inside one because the answer does not depend on which tab you
 * are standing on: a mailbox that has stopped answering is the same news while
 * you are rewording a template as it is while you are reading the log.
 *
 * "Working" means something actually got through — a passing test or a drain
 * that sent or collected. A form with a host typed into it proves nothing, and
 * a green tick over one is the most misleading thing this strip could say.
 */

export type MailHealth = {
  /// Whether there is anywhere to send or collect at all. Without a host the
  /// card says so and offers nothing: a red state on an instance that has
  /// deliberately no mail server reads as a fault somebody caused.
  canSend: boolean;
  canCollect: boolean;
  lastSentAt: Date | null;
  lastPolledAt: Date | null;
  sentToday: number;
  poll: { filed?: number; bounced?: number; skipped?: number } | null;
  failed: number;
  pending: number;
  pollUrl: string;
  tokenSet: boolean;
};

export function MailHealthStrip({ health }: { health: MailHealth }) {
  const t = useMessages();

  return (
    // Four across only where four fit. Squeezed into a settings column beside
    // the side-nav they truncate, and a card whose whole job is one short
    // sentence must not be the thing that clips it.
    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      <HealthCard
        icon={<Send size={16} />}
        tone={health.canSend ? (health.lastSentAt ? "positive" : "quiet") : "quiet"}
        label={t.mail.healthSending}
        state={
          !health.canSend
            ? t.mail.healthOff
            : health.lastSentAt
              ? t.mail.healthWorking
              : t.mail.healthUntried
        }
        detail={
          health.lastSentAt
            ? `${t.mail.healthSentToday(health.sentToday)} · ${t.mail.healthLastSent(
                t.common.ago(shortAge(health.lastSentAt, undefined, t)),
              )}`
            : t.mail.healthNothingSent
        }
      />

      <HealthCard
        icon={<Inbox size={16} />}
        tone={health.canCollect ? (health.lastPolledAt ? "positive" : "quiet") : "quiet"}
        label={t.mail.healthCollecting}
        state={
          !health.canCollect
            ? t.mail.healthOff
            : health.lastPolledAt
              ? t.mail.healthWorking
              : t.mail.healthUntried
        }
        detail={
          health.lastPolledAt
            ? `${t.mail.healthLastPolled(
                t.common.ago(shortAge(health.lastPolledAt, undefined, t)),
              )} · ${t.mail.pollCounts(
                health.poll?.filed ?? 0,
                health.poll?.bounced ?? 0,
                health.poll?.skipped ?? 0,
              )}`
            : t.mail.pollNever
        }
      />

      <QueueCard failed={health.failed} pending={health.pending} />
      <PollCard pollUrl={health.pollUrl} tokenSet={health.tokenSet} />
    </div>
  );
}

/** The queue, and the one thing to do about a dead one. Retry is a verb on its
 *  own, so it happens on the click. */
function QueueCard({ failed, pending }: { failed: number; pending: number }) {
  const t = useMessages();
  const [running, startTransition] = useTransition();

  return (
    <HealthCard
      icon={<RotateCw size={16} />}
      tone={failed > 0 ? "negative" : "quiet"}
      label={t.mail.healthQueue}
      state={failed > 0 ? t.mail.healthFailed(failed) : t.mail.healthQueueClear}
      detail={t.mail.healthWaiting(pending)}
      action={
        failed > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={running}
            onClick={() => startTransition(async () => void (await retryFailedMail()))}
          >
            {running ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />}
            {running ? t.mail.healthRetrying : t.mail.healthRetry}
          </Button>
        ) : undefined
      }
    />
  );
}

/**
 * The route somebody has to call, and a way to call it once by hand.
 *
 * Nothing in the app runs on a clock, so the route is the whole of how mail
 * moves — and the ten minutes in which somebody is setting it up for the first
 * time is exactly when waiting a minute for a cron entry is intolerable.
 */
function PollCard({ pollUrl, tokenSet }: { pollUrl: string; tokenSet: boolean }) {
  const t = useMessages();
  const [running, startTransition] = useTransition();
  const [said, setSaid] = useState<string | null>(null);

  return (
    <HealthCard
      icon={<Clock size={16} />}
      tone="brand"
      label={t.mail.healthPoll}
      state={t.mail.healthOnDemand}
      detail={said ?? (tokenSet ? t.mail.pollTokenSet : t.mail.pollTokenMissing)}
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={running}
          onClick={() =>
            startTransition(async () => {
              const result = await pollMailNow();
              setSaid(
                result.ok
                  ? t.mail.pollRan(result.counts.sent, result.counts.filed)
                  : (result.error ?? t.errors.generic),
              );
            })
          }
        >
          {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          {running ? t.mail.healthRunning : t.mail.healthNow}
        </Button>
      }
    >
      <CopyValue value={pollUrl} className="text-text-3 font-mono text-xs" />
    </HealthCard>
  );
}

const TONE = {
  positive: "bg-[color-mix(in_oklab,var(--positive)_14%,transparent)] text-positive",
  negative: "bg-[color-mix(in_oklab,var(--negative)_14%,transparent)] text-negative",
  brand: "bg-[var(--brand-tint)] text-brand-deep",
  quiet: "bg-surface-2 text-text-3",
};

function HealthCard({
  icon,
  tone,
  label,
  state,
  detail,
  action,
  children,
}: {
  icon: React.ReactNode;
  tone: keyof typeof TONE;
  label: string;
  state: string;
  detail: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="card flex items-center gap-2.5 px-3.5 py-3">
      <span
        className={cn(
          "rounded-control flex size-8 shrink-0 items-center justify-center",
          TONE[tone],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="label">{label}</p>
        <p className="text-md mt-0.5 truncate font-semibold">{state}</p>
        <p className="text-text-3 mt-0.5 truncate text-xs">{detail}</p>
        {children}
      </div>
      {action}
    </div>
  );
}
