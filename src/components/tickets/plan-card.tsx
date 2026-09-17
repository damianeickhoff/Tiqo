import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import type { StepStatus } from "@/generated/prisma/enums";
import { blockedBy, isStepSettled, planOrder, planProgress } from "@/lib/plan";
import { NO_GATE, type ApprovalGate } from "@/lib/approvals";
import { getMessages } from "@/lib/settings";
import { cn } from "@/lib/utils";

export type PlanCardStep = {
  id: string;
  title: string;
  phase: string | null;
  phaseOrder: number;
  position: number;
  status: StepStatus;
  dueAt: Date | null;
  blocksPhase: boolean;
  dependsOnId: string | null;
};

/** The same ring the plan page draws for a step, for a whole phase. */
function PhaseRing({ state }: { state: "done" | "now" | "todo" }) {
  const r = 5;
  const circumference = 2 * Math.PI * r;
  const color =
    state === "done" ? "var(--positive)" : state === "now" ? "var(--brand)" : "var(--text-3)";
  return (
    <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden style={{ color }}>
      <circle
        cx="7"
        cy="7"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity={state === "done" ? 1 : 0.4}
      />
      {state === "done" ? (
        <path
          d="M4.6 7.3 6.6 9.3 9.6 5.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : state === "now" ? (
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
      ) : null}
    </svg>
  );
}

/**
 * The plan, summarised on the change itself: which template it came from, how
 * far it is, and one cell per phase with the step that is being worked or the
 * one that is stuck. Enough to answer "where is this?" without leaving the
 * conversation; the plan page has the rest.
 */
export async function PlanCard({
  ticketNumber,
  steps,
  template,
  gate = NO_GATE,
}: {
  ticketNumber: number;
  steps: PlanCardStep[];
  /// The template the plan was applied from, when the trail remembers one.
  template: string | null;
  /// Which phases a decision nobody has answered is holding up.
  gate?: ApprovalGate;
}) {
  const t = await getMessages();
  const ordered = planOrder(steps);
  const { settled, total, pct } = planProgress(ordered);

  const phases: { name: string | null; steps: PlanCardStep[] }[] = [];
  for (const step of ordered) {
    const last = phases.at(-1);
    if (last && last.name === step.phase) last.steps.push(step);
    else phases.push({ name: step.phase, steps: [step] });
  }
  const currentIndex = phases.findIndex((phase) => !phase.steps.every(isStepSettled));

  return (
    <div className="card overflow-hidden">
      <div className="border-line flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5">
        <span className="text-base font-semibold">{t.plan.title}</span>
        {template ? (
          <span className="text-text-3 text-sm">{t.plan.fromTemplate(template)}</span>
        ) : null}
        <span className="ml-auto flex items-center gap-3">
          <span className="text-text-3 font-mono text-xs">{t.plan.progress(settled, total)}</span>
          <span className="bg-surface-3 relative hidden h-1 w-28 overflow-hidden rounded-full sm:block">
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? "var(--positive)" : "var(--brand)",
              }}
            />
          </span>
          <Link
            href={`/tickets/${ticketNumber}/plan`}
            className="text-brand-deep flex items-center gap-1 text-sm font-medium hover:underline"
          >
            {t.plan.openPlan}
            <ChevronRight size={13} />
          </Link>
        </span>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${Math.min(phases.length, 4)}, minmax(0, 1fr))` }}
      >
        {phases.map((phase, index) => {
          const done = phase.steps.filter(isStepSettled).length;
          const state =
            done === phase.steps.length ? "done" : index === currentIndex ? "now" : "todo";
          // What to say about the phase, in the order it matters: something
          // stuck, then something being worked, then whatever is next.
          const stuck = phase.steps.find((step) => step.status === "BLOCKED");
          const working = phase.steps.find((step) => step.status === "IN_PROGRESS");
          const next = phase.steps.find((step) => !isStepSettled(step));
          const held = next && !working && !stuck ? blockedBy(next, ordered, gate) : null;
          const callout = stuck ?? working ?? next;

          return (
            <div
              key={`${phase.name ?? "none"}-${index}`}
              className={cn(
                "border-line min-w-0 px-4 py-3",
                index > 0 && "border-l",
                index >= 4 && "border-t",
                state === "now" && "bg-surface-2",
              )}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <PhaseRing state={state} />
                <span className="truncate">{phase.name ?? t.plan.noPhase}</span>
                <span className="text-text-3 ml-auto shrink-0 font-mono text-xs font-normal">
                  {done}/{phase.steps.length}
                </span>
              </div>
              <p className="text-text-3 mt-1.5 flex items-center gap-1 truncate text-xs">
                {state === "done" ? (
                  t.plan.done
                ) : callout ? (
                  <>
                    {stuck ? (
                      <span className="text-p-urgent font-medium">{t.plan.status.BLOCKED}</span>
                    ) : held ? (
                      <Lock size={10} className="shrink-0" />
                    ) : working ? (
                      <span className="text-brand-deep font-medium">
                        {t.plan.status.IN_PROGRESS}
                      </span>
                    ) : null}
                    <Link
                      href={`/tickets/${ticketNumber}/steps/${callout.id}`}
                      className="hover:text-text truncate"
                    >
                      {callout.title}
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
