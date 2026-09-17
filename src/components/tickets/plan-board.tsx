"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, Lock, MessageSquare, Plus } from "lucide-react";
import type { StepStatus } from "@/generated/prisma/enums";
import { addStep, applyPlan, setStepAssignee, setStepStatus } from "@/lib/actions/steps";
import { blockedBy, formatEstimate, isStepSettled, planOrder, type Block } from "@/lib/plan";
import { NO_GATE, type ApprovalGate } from "@/lib/approvals";
import { Avatar } from "@/components/avatar";
import { Button, Input, Select } from "@/components/ui";
import { StepStatusPill } from "@/components/tickets/step-status";
import { BlockDialog } from "@/components/tickets/block-dialog";
import { useDateFormat, useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type BoardStep = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  phase: string | null;
  phaseOrder: number;
  status: StepStatus;
  blockedReason: string | null;
  skipReason: string | null;
  skipNeedsReason: boolean;
  dueAt: Date | null;
  estimateMinutes: number | null;
  blocksPhase: boolean;
  overdue: boolean;
  dependsOnId: string | null;
  assignee: { id: string; name: string; avatarVariant: number } | null;
  team: { id: string; name: string; color: string } | null;
  comments: number;
};

/**
 * The plan, in full, on its own page.
 *
 * Phases are numbered sections rather than rows with a tag, because a phase is
 * a gate and a gate you can see is one people stop arguing with. Everything
 * else about a step — when it is due, what it waits for, what was said about
 * it — is on the step's own page; this is the overview, not a spreadsheet.
 */
export function PlanBoard({
  ticketId,
  ticketNumber,
  steps,
  people,
  templates,
  canEdit,
  gate = NO_GATE,
}: {
  ticketId: string;
  ticketNumber: number;
  steps: BoardStep[];
  people: { id: string; name: string; avatarVariant: number }[];
  templates: { id: string; name: string }[];
  canEdit: boolean;
  /// Which phases a decision nobody has answered is holding up.
  gate?: ApprovalGate;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const ordered = planOrder(steps);

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  const groups: { phase: string | null; steps: BoardStep[] }[] = [];
  for (const step of ordered) {
    const last = groups.at(-1);
    if (last && last.phase === step.phase) last.steps.push(step);
    else groups.push({ phase: step.phase, steps: [step] });
  }
  // The phase being worked: the first one with anything left in it.
  const currentIndex = groups.findIndex((group) => !group.steps.every(isStepSettled));

  return (
    <div className="space-y-6">
      {error ? (
        <p className="bg-negative/[0.06] text-negative rounded-control px-4 py-2 text-base font-medium">
          {error}
        </p>
      ) : null}

      {groups.map((group, groupIndex) => {
        const blocks = group.steps.map((step) => blockedBy(step, ordered, gate));
        // A phase nobody has approved yet says so; one held by the phase before
        // it keeps the lock it has always had.
        const awaiting = blocks.every(
          (block) => block?.reason === "approval" || block?.reason === "change",
        );
        // Which sentence the lock gets: a gate on the whole change is not a
        // gate on this phase, and saying so sends people to the wrong card.
        const heldWhole = blocks.every((block) => block?.reason === "change");
        const locked = awaiting || blocks.every((block) => block?.reason === "phase");
        const done = group.steps.filter(isStepSettled).length;
        const current = groupIndex === currentIndex;

        return (
          <section key={`${group.phase ?? "none"}-${groupIndex}`}>
            <div className="flex items-center gap-2.5 px-1 pb-2">
              <span className="text-text-3 font-mono text-xs">
                {String(groupIndex + 1).padStart(2, "0")}
              </span>
              <h2 className={cn("text-md font-semibold", locked && "text-text-2")}>
                {group.phase ?? t.plan.noPhase}
              </h2>
              {locked ? <Lock size={12} className="text-text-3" /> : null}
              {awaiting ? (
                <span className="text-text-2 inline-flex h-[18px] items-center rounded-full bg-[color-mix(in_oklab,var(--text)_6%,transparent)] px-1.5 text-xs font-medium">
                  {heldWhole ? t.plan.lockedByChange : t.plan.lockedByApproval}
                </span>
              ) : null}
              {current ? (
                <span className="text-brand-deep rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-xs font-medium">
                  {t.plan.currentPhase}
                </span>
              ) : null}
              <span
                className={cn(
                  "tnum ml-auto font-mono text-xs",
                  done === group.steps.length ? "text-positive" : "text-text-3",
                )}
              >
                {done}/{group.steps.length}
              </span>
            </div>

            <ol className="card divide-line divide-y overflow-hidden">
              {group.steps.map((step) => (
                <StepRow
                  key={step.id}
                  step={step}
                  all={ordered}
                  gate={gate}
                  ticketNumber={ticketNumber}
                  people={people}
                  canEdit={canEdit}
                  pending={pending}
                  run={run}
                />
              ))}

              {/* A step is added where it belongs, not at the bottom of the
                  plan and dragged up afterwards. */}
              {canEdit ? (
                <li>
                  <AddToPhase
                    phase={group.phase}
                    pending={pending}
                    onAdd={(title) => run(() => addStep(ticketId, title, group.phase))}
                  />
                </li>
              ) : null}
            </ol>
          </section>
        );
      })}

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <form
            className="flex min-w-[18rem] flex-1 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const title = draft;
              if (!title.trim()) return;
              setDraft("");
              run(() => addStep(ticketId, title));
            }}
          >
            <Input
              value={draft}
              maxLength={160}
              placeholder={t.plan.addStep}
              aria-label={t.plan.addStep}
              onChange={(event) => setDraft(event.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="outline" disabled={pending || !draft.trim()}>
              <Plus size={14} strokeWidth={2.5} />
              {t.common.add}
            </Button>
          </form>

          {templates.length > 0 ? (
            <Select
              value=""
              aria-label={t.plan.applyTemplate}
              disabled={pending}
              onChange={(event) => {
                const id = event.target.value;
                if (id) run(() => applyPlan(ticketId, id));
              }}
              className="w-auto"
            >
              <option value="">{t.plan.applyTemplate}</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** One line at the foot of a phase, quiet until it is used. */
function AddToPhase({
  phase,
  pending,
  onAdd,
}: {
  phase: string | null;
  pending: boolean;
  onAdd: (title: string) => void;
}) {
  const t = useMessages();
  const [title, setTitle] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        onAdd(title);
        setTitle("");
      }}
      className="flex items-center gap-2 px-3 py-1.5"
    >
      <Plus size={14} className="text-text-3 ml-1 shrink-0" />
      <input
        value={title}
        maxLength={160}
        disabled={pending}
        placeholder={t.plan.addToPhase}
        aria-label={`${t.plan.addToPhase} — ${phase ?? t.plan.noPhase}`}
        onChange={(event) => setTitle(event.target.value)}
        className="placeholder:text-text-3 h-8 min-w-0 flex-1 bg-transparent text-base focus:outline-none"
      />
      {title.trim() ? (
        <Button type="submit" size="sm" disabled={pending}>
          {t.common.add}
        </Button>
      ) : null}
    </form>
  );
}

function StepRow({
  step,
  all,
  gate,
  ticketNumber,
  people,
  canEdit,
  pending,
  run,
}: {
  step: BoardStep;
  all: BoardStep[];
  gate: ApprovalGate;
  ticketNumber: number;
  people: { id: string; name: string; avatarVariant: number }[];
  canEdit: boolean;
  pending: boolean;
  run: (work: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const t = useMessages();
  const dateFormat = useDateFormat({ day: "numeric", month: "short" });
  // Which sentence is being asked for, if any: why it is stuck, or why it is
  // not going to be done.
  const [asking, setAsking] = useState<"BLOCKED" | "SKIPPED" | null>(null);

  const settled = isStepSettled(step);
  const block: Block | null = settled ? null : blockedBy(step, all, gate);
  const blocker = block ? all.find((row) => row.id === block.blocker) : null;

  return (
    <li
      className={cn(
        "group hover:bg-surface-2 transition-[background-color]",
        step.status === "IN_PROGRESS" && "bg-surface-2/60",
      )}
    >
      <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-1.5">
        <StepStatusPill
          status={step.status}
          blocked={Boolean(block)}
          disabled={!canEdit || pending}
          onChange={(next) => {
            if (next === "BLOCKED") setAsking("BLOCKED");
            else if (next === "SKIPPED" && step.skipNeedsReason) setAsking("SKIPPED");
            else run(() => setStepStatus(step.id, next));
          }}
        />

        <Link href={`/tickets/${ticketNumber}/steps/${step.id}`} className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "truncate text-base font-medium hover:underline",
                settled && "text-text-3",
              )}
            >
              {step.title}
            </span>
            {block ? (
              <span className="text-text-2 inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--text)_6%,transparent)] px-1.5 text-xs font-medium">
                <Lock size={9} />
                {block.reason === "change"
                  ? t.plan.lockedByChange
                  : block.reason === "approval"
                    ? t.plan.lockedByApproval
                    : block.reason === "phase"
                      ? t.plan.lockedByPhase
                      : t.plan.waitsForStep(blocker?.title ?? "")}
              </span>
            ) : null}
          </span>
          {step.description ? (
            <span className="text-text-3 block max-w-[60ch] truncate text-sm">
              {step.description}
            </span>
          ) : null}
        </Link>

        {/* Who has it, as a face. The name is on their profile; here it is one
          column wide and has to survive being one column wide. */}
        <AssigneeCell
          step={step}
          people={people}
          canEdit={canEdit}
          pending={pending}
          onPick={(id) => run(() => setStepAssignee(step.id, id))}
        />

        {/* How long it was reckoned to take, from the plan it came from. */}
        <span className="tnum text-text-3 w-12 shrink-0 text-right font-mono text-xs">
          {step.estimateMinutes ? formatEstimate(step.estimateMinutes, t.plan.units) : ""}
        </span>

        <span
          className={cn(
            "tnum w-14 shrink-0 text-right font-mono text-xs",
            step.overdue ? "text-negative font-semibold" : "text-text-3",
          )}
        >
          {step.dueAt ? dateFormat.format(step.dueAt) : ""}
        </span>

        <span className="text-text-3 flex w-8 shrink-0 items-center justify-end gap-1 font-mono text-xs">
          {step.comments > 0 ? (
            <>
              <MessageSquare size={11} />
              {step.comments}
            </>
          ) : null}
        </span>

        <Link
          href={`/tickets/${ticketNumber}/steps/${step.id}`}
          aria-label={t.plan.openStep}
          className="text-text-3 hover:text-text flex size-8 shrink-0 items-center justify-center"
        >
          <ChevronRight size={15} />
        </Link>
      </div>

      {asking ? (
        <BlockDialog
          pending={pending}
          skipping={asking === "SKIPPED"}
          onClose={() => setAsking(null)}
          onConfirm={(reason) => {
            const status = asking;
            setAsking(null);
            run(() => setStepStatus(step.id, status, reason));
          }}
        />
      ) : null}
    </li>
  );
}

/** The avatar is the control: the select sits invisibly on top of it. */
function AssigneeCell({
  step,
  people,
  canEdit,
  pending,
  onPick,
}: {
  step: BoardStep;
  people: { id: string; name: string; avatarVariant: number }[];
  canEdit: boolean;
  pending: boolean;
  onPick: (id: string | null) => void;
}) {
  const t = useMessages();
  const label = step.assignee?.name ?? step.team?.name ?? t.tickets.unassigned;

  // A group is who the plan handed the step to; a person is who picked it up,
  // so the person wins once there is one.
  const face = step.assignee ? (
    <Avatar name={step.assignee.name} variant={step.assignee.avatarVariant} size={24} />
  ) : step.team ? (
    <span
      aria-hidden
      className="text-text flex size-6 items-center justify-center rounded-full text-xs font-semibold"
      style={{ background: `color-mix(in oklab, ${step.team.color} 30%, transparent)` }}
    >
      {step.team.name.slice(0, 1).toUpperCase()}
    </span>
  ) : (
    <span className="border-line-strong block size-6 rounded-full border border-dashed" />
  );

  if (!canEdit) {
    return (
      <span className="w-6 shrink-0" title={label}>
        {face}
      </span>
    );
  }

  return (
    <span className="relative w-6 shrink-0" title={label}>
      {face}
      <select
        value={step.assignee?.id ?? ""}
        disabled={pending}
        aria-label={t.ticket.assignee}
        onChange={(event) => onPick(event.target.value || null)}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
      >
        <option value="">{t.tickets.unassigned}</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>
    </span>
  );
}
