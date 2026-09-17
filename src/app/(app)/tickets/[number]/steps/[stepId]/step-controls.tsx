"use client";

import { useState, useTransition } from "react";
import type { StepStatus } from "@/generated/prisma/enums";
import { setStepAssignee, setStepDependency, setStepDue, setStepStatus } from "@/lib/actions/steps";
import { BlockDialog } from "@/components/tickets/block-dialog";
import { STEP_STATUSES, type Block } from "@/lib/plan";
import { Select } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

/** The three things a step is: finished or not, due or not, waiting or not. */
export function StepControls({
  stepId,
  status,
  block,
  assigneeId,
  people,
  dueAt,
  dependsOnId,
  skipNeedsReason,
  earlier,
  canEdit,
}: {
  stepId: string;
  status: StepStatus;
  /// What the plan says is holding this step, if anything — an unanswered
  /// approval, an unfinished phase, or the step it waits for.
  block: Block | null;
  assigneeId: string | null;
  people: { id: string; name: string }[];
  dueAt: Date | null;
  dependsOnId: string | null;
  /// Whether the plan said dropping this step has to be justified.
  skipNeedsReason: boolean;
  earlier: { id: string; title: string }[];
  canEdit: boolean;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<"BLOCKED" | "SKIPPED" | null>(null);

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  return (
    <div className="space-y-4">
      <p className="label">{t.plan.stepName}</p>

      {canEdit ? (
        <label className="block">
          <span className="label mb-1.5 block">{t.ticket.status}</span>
          <Select
            value={status}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.value as StepStatus;
              // Blocking asks for the reason first, here as on the plan: the
              // state and the sentence that explains it are one decision.
              if (next === "BLOCKED") setAsking("BLOCKED");
              else if (next === "SKIPPED" && skipNeedsReason) setAsking("SKIPPED");
              else run(() => setStepStatus(stepId, next));
            }}
            className="h-9 w-full text-base"
          >
            {STEP_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t.plan.status[value]}
              </option>
            ))}
          </Select>
        </label>
      ) : (
        <p className="text-text-2 text-md">{t.plan.status[status]}</p>
      )}

      {block ? (
        <p className="text-text-3 text-sm">
          {block.reason === "change"
            ? t.plan.lockedByChange
            : block.reason === "approval"
              ? t.plan.lockedByApproval
              : t.plan.lockedByPhase}
        </p>
      ) : null}

      {asking ? (
        <BlockDialog
          pending={pending}
          skipping={asking === "SKIPPED"}
          onClose={() => setAsking(null)}
          onConfirm={(reason) => {
            const next = asking;
            setAsking(null);
            run(() => setStepStatus(stepId, next, reason));
          }}
        />
      ) : null}

      {canEdit ? (
        <label className="block">
          <span className="label mb-1.5 block">{t.ticket.assignee}</span>
          <Select
            value={assigneeId ?? ""}
            disabled={pending}
            onChange={(event) => run(() => setStepAssignee(stepId, event.target.value || null))}
            className="h-9 w-full text-base"
          >
            <option value="">{t.tickets.unassigned}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}

      {error ? <p className="text-negative text-sm font-medium">{error}</p> : null}

      {canEdit ? (
        <>
          <label className="block">
            <span className="label mb-1.5 block">{t.plan.due}</span>
            <input
              type="date"
              defaultValue={dueAt ? dueAt.toISOString().slice(0, 10) : ""}
              disabled={pending}
              onChange={(event) => run(() => setStepDue(stepId, event.target.value))}
              className="border-border bg-surface focus:border-brand rounded-control h-9 w-full border px-2.5 text-base focus:ring-4 focus:ring-[var(--brand-tint)] focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="label mb-1.5 block">{t.plan.waitsFor}</span>
            <Select
              value={dependsOnId ?? ""}
              disabled={pending || earlier.length === 0}
              onChange={(event) => run(() => setStepDependency(stepId, event.target.value || null))}
              className="h-9 w-full text-base"
            >
              <option value="">{t.plan.waitsForNothing}</option>
              {earlier.map((step) => (
                <option key={step.id} value={step.id}>
                  {step.title}
                </option>
              ))}
            </Select>
          </label>
        </>
      ) : null}
    </div>
  );
}
