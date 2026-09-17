"use client";

import { ChevronDown, Lock } from "lucide-react";
import type { StepStatus } from "@/generated/prisma/enums";
import { STEP_STATUSES } from "@/lib/plan";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/** What colour a step's state is drawn in, wherever it is drawn. */
export const STEP_COLOR: Record<StepStatus, string> = {
  OPEN: "var(--text-3)",
  IN_PROGRESS: "var(--brand)",
  BLOCKED: "var(--p-urgent)",
  DONE: "var(--positive)",
  SKIPPED: "var(--text-3)",
};

/** The same ring the queue draws for a ticket's status, for a step's. */
export function StepRing({ status }: { status: StepStatus }) {
  const r = 5;
  const circumference = 2 * Math.PI * r;
  const color = STEP_COLOR[status];

  return (
    <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden style={{ color }}>
      <circle
        cx="7"
        cy="7"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity={status === "DONE" ? 1 : 0.4}
        strokeDasharray={status === "SKIPPED" ? "2 2" : undefined}
      />
      {status === "DONE" ? (
        <path
          d="M4.6 7.3 6.6 9.3 9.6 5.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : status === "IN_PROGRESS" ? (
        <circle
          cx="7"
          cy="7"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeDasharray={`${circumference * 0.5} ${circumference}`}
          transform="rotate(-90 7 7)"
        />
      ) : status === "BLOCKED" ? (
        // A bar across it: stopped, rather than part-way round.
        <path d="M4.4 7h5.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

const TONE: Record<StepStatus, string> = {
  OPEN: "border-transparent bg-surface-2 text-text-2",
  IN_PROGRESS:
    "border-[color-mix(in_oklab,var(--brand)_45%,transparent)] bg-[var(--brand-tint)] text-brand-deep",
  BLOCKED:
    "border-[color-mix(in_oklab,var(--p-urgent)_45%,transparent)] bg-p-urgent/10 text-p-urgent",
  DONE: "border-[color-mix(in_oklab,var(--positive)_45%,transparent)] bg-positive/10 text-positive",
  SKIPPED: "border-line-strong bg-surface text-text-3 line-through",
};

/**
 * A step's state as a select that looks like a chip. Five states rather than a
 * checkbox: "someone is on it", "we are stuck" and "we decided not to" are
 * different answers, and a plan that cannot say them gets them written in the
 * notes instead.
 */
export function StepStatusPill({
  status,
  blocked,
  disabled,
  onChange,
}: {
  status: StepStatus;
  /// Held by a gate the plan works out for itself, as opposed to the BLOCKED
  /// state, which a person sets and a person clears.
  blocked: boolean;
  disabled: boolean;
  onChange: (next: StepStatus) => void;
}) {
  const t = useMessages();

  return (
    <span
      className={cn(
        "relative inline-flex h-7 w-[124px] shrink-0 items-center gap-1.5 rounded-full border pr-1.5 pl-2 text-sm font-medium whitespace-nowrap",
        TONE[status],
        disabled || blocked ? "opacity-90" : "cursor-pointer",
      )}
      title={blocked ? t.plan.lockedByPhase : undefined}
    >
      {blocked && status === "OPEN" ? (
        <Lock size={11} className="text-text-3 shrink-0" />
      ) : (
        <StepRing status={status} />
      )}
      <span className="min-w-0 flex-1 truncate">{t.plan.status[status]}</span>
      {/* The arrow says the chip is a choice — without one it reads as a label
          and nobody clicks it. */}
      {disabled ? null : <ChevronDown size={13} className="shrink-0 opacity-60" />}

      {/* The whole chip is the control: a separate caret would double the
          target for something that is already small. */}
      <select
        value={status}
        // A gated step can still be *skipped*, blocked or reopened — what the
        // gate stops is starting it, not deciding what becomes of it.
        disabled={disabled}
        aria-label={t.ticket.status}
        onChange={(event) => onChange(event.target.value as StepStatus)}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
      >
        {STEP_STATUSES.map((value) => (
          <option key={value} value={value}>
            {t.plan.status[value]}
          </option>
        ))}
      </select>
    </span>
  );
}
