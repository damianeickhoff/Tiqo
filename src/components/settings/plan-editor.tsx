"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Eye,
  GripVertical,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  Stamp,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  addPhase,
  addTemplateStep,
  deletePhase,
  deleteTemplate,
  deleteTemplateStep,
  duplicateTemplate,
  movePhase,
  moveTemplateStep,
  reorderTemplateSteps,
  updatePhase,
  updateTemplate,
  updateTemplateStep,
} from "@/lib/actions/change-templates";
import { formatEstimate, parseEstimate } from "@/lib/plan";
import { Button, Input, Select, Textarea, buttonClass } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Modal } from "@/components/modal";
import { Avatar } from "@/components/avatar";
import { StatusRing } from "@/components/tickets/glyphs";
import type { TicketStatus } from "@/lib/tickets";
import { PanelCard } from "@/components/tickets/panel-card";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

type Phase = { id: string; name: string; approverId: string | null };
type Step = {
  id: string;
  title: string;
  description: string | null;
  phaseId: string | null;
  dueDays: number | null;
  assigneeId: string | null;
  teamId: string | null;
  estimateMinutes: number | null;
  blocksPhase: boolean;
  skipNeedsReason: boolean;
  dependsOnId: string | null;
};
type Plan = {
  id: string;
  name: string;
  description: string | null;
  approverId: string | null;
  defaultAssigneeId: string | null;
  phases: Phase[];
  steps: Step[];
};

type Person = { id: string; name: string; avatarVariant: number };
type Group = { id: string; name: string };
export type PlanUse = {
  number: number;
  reference: string;
  title: string;
  status: TicketStatus;
};

/// The table's columns, written once: the header and every row have to agree,
/// and two copies of seven widths do not stay agreed.
const COLUMNS = "18px 26px minmax(0,1fr) 160px 200px 60px 28px";

/** What is selected, and therefore what the inspector is about. */
type Selection = { kind: "template" } | { kind: "phase" | "step"; id: string };

/**
 * A plan, as a document rather than a stack of cards.
 *
 * A phase strip over a dense table: twelve steps in four phases fit on one
 * screen, which is what a plan of that size is actually like. Nothing is edited
 * in a row — the row says what the step will do and the inspector is where it
 * is said — because a row carrying seven controls is the version of this
 * nobody could read.
 *
 * Adding, removing and reordering happen at once; everything with a text box
 * next to it is a draft with a Save.
 */
export function PlanEditor({
  plan,
  people,
  teams,
  approvers,
  usedBy,
  usedCount,
}: {
  plan: Plan;
  people: Person[];
  teams: Group[];
  /// Only the people who may be *named* on a request — a plan written today is
  /// applied for years, and a default nobody is allowed to ask would lay down a
  /// gate with nobody behind it every time it ran.
  approvers: Person[];
  /// The changes this plan has already been laid down on.
  usedBy: PlanUse[];
  usedCount: number;
}) {
  const t = useMessages();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection>({ kind: "template" });
  const [filter, setFilter] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [addingPhase, setAddingPhase] = useState(false);

  // The server's order, held here so a drag shows at once and the write happens
  // behind it. Reset during render rather than in an effect, so the table never
  // paints the order the drag has already left behind.
  const [order, setOrder] = useState(plan.steps);
  const [known, setKnown] = useState(plan.steps);
  if (known !== plan.steps) {
    setKnown(plan.steps);
    setOrder(plan.steps);
  }

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  /** A step lands where it was dropped, phase and all. */
  function move(stepId: string, onto: string | null, phaseId: string | null) {
    const from = order.findIndex((row) => row.id === stepId);
    if (from < 0) return;
    // Dropped on a row above, the step takes that row's place; dropped on one
    // below, it lands under it. Either way it ends up where the cursor was,
    // which is the only rule anybody dragging is holding in their head.
    const downwards = from < order.findIndex((row) => row.id === onto);

    const next = [...order];
    const [held] = next.splice(from, 1);
    const landing = onto === null ? next.length : next.findIndex((row) => row.id === onto);
    const to = landing < 0 ? next.length : landing + (downwards ? 1 : 0);
    next.splice(to, 0, { ...held!, phaseId });
    if (
      next.every(
        (row, index) => row.id === order[index]!.id && row.phaseId === order[index]!.phaseId,
      )
    )
      return;

    setOrder(next);
    run(() =>
      reorderTemplateSteps(
        plan.id,
        next.map(({ id, phaseId }) => ({ id, phaseId })),
      ),
    );
  }

  // Phases in their own order, with whatever has no phase last — the same shape
  // the plan takes once it is laid down on a change.
  const groups = [
    ...plan.phases.map((phase) => ({
      phase,
      steps: order.filter((step) => step.phaseId === phase.id),
    })),
    { phase: null, steps: order.filter((step) => !step.phaseId) },
  ].filter((group) => group.phase || group.steps.length > 0);

  const numbers = new Map(order.map((step, index) => [step.id, index + 1]));
  const minutes = order.reduce((total, step) => total + (step.estimateMinutes ?? 0), 0);
  const shown = filter ? groups.filter((group) => group.phase?.id === filter) : groups;
  const last = groups.at(-1);

  const activeStep =
    selected.kind === "step" ? order.find((step) => step.id === selected.id) : undefined;
  const activePhase =
    selected.kind === "phase" ? plan.phases.find((phase) => phase.id === selected.id) : undefined;

  return (
    <>
      <div className="border-line flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-1 border-b px-5 py-2 lg:px-6">
        <Link
          href="/settings/plans"
          className="text-text-2 hover:text-text -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-base font-medium transition-colors"
        >
          <ArrowLeft size={14} />
          {t.plan.templatesTitle}
        </Link>

        <span aria-hidden className="bg-line hidden h-[18px] w-px sm:block" />

        <span className="text-md font-medium">{plan.name}</span>
        <span className="text-text-3 text-sm">
          {t.plan.phaseCount(plan.phases.length)} · {t.plan.stepCount(order.length)}
          {minutes > 0 ? ` · ${t.plan.aboutEstimate(formatEstimate(minutes, t.plan.units))}` : ""}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={order.length === 0}
            onClick={() => setPreviewing(true)}
          >
            <Eye size={13} />
            {t.plan.previewOnChange}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await duplicateTemplate(plan.id);
                if (result.ok && result.id) router.push(`/settings/plans/${result.id}`);
                else setError(result.ok ? null : (result.error ?? t.errors.generic));
              })
            }
          >
            <Copy size={13} />
            {t.plan.duplicate}
          </Button>

          <ConfirmDelete
            title={t.common.deleteThing(plan.name)}
            blurb={t.plan.deleteTemplateBlurb}
            run={async () => {
              const result = await deleteTemplate(plan.id);
              if (result.ok) router.push("/settings/plans");
              return result;
            }}
          >
            {(ask) => (
              <button
                type="button"
                onClick={ask}
                className={cn(buttonClass("ghost", "sm"), "text-negative hover:bg-negative/10")}
              >
                <Trash2 size={13} />
                {t.common.delete}
              </button>
            )}
          </ConfirmDelete>
        </div>
      </div>

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 px-5 py-5 lg:px-6">
          <div className="flex flex-wrap items-start gap-3 pb-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl leading-tight font-semibold tracking-[-0.02em]">
                {plan.name}
              </h1>
              <p className="text-text-2 mt-1 text-base">
                {plan.description}
                {plan.description ? " " : null}
                <span className="text-text-3">
                  · {approverOf(plan.approverId, approvers, t.plan.noSignOff, t.plan.signOffBy)} ·{" "}
                  {plan.defaultAssigneeId
                    ? `${t.plan.templateDefaultAssignee} ${nameOf(plan.defaultAssigneeId, people)}`
                    : t.plan.nobody}
                </span>
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelected({ kind: "template" })}
            >
              <Pencil size={13} />
              {t.plan.editDetails}
            </Button>
          </div>

          {error ? (
            <p className="bg-negative/[0.06] text-negative rounded-control mb-3 px-4 py-2 text-base font-medium">
              {error}
            </p>
          ) : null}

          {/* The strip: what the plan is made of, and a way to look at one part
              of it without losing the shape of the whole. */}
          <div className="flex flex-wrap items-center gap-1.5 pb-3">
            <Chip on={filter === null} onClick={() => setFilter(null)}>
              {t.plan.allSteps}
              <span className="text-text-3 tnum font-mono text-xs">{order.length}</span>
            </Chip>

            {plan.phases.map((phase, index) => {
              const count = order.filter((step) => step.phaseId === phase.id).length;
              return (
                <Chip
                  key={phase.id}
                  on={filter === phase.id}
                  onClick={() => setFilter(filter === phase.id ? null : phase.id)}
                >
                  <span className="text-text-3 font-mono text-xs">{index + 1}</span>
                  {phase.name}
                  <span className="text-text-3 tnum font-mono text-xs">{count}</span>
                  {phase.approverId ? (
                    <Stamp
                      size={12}
                      className="text-brand-deep"
                      aria-label={t.plan.signOffBy(nameOf(phase.approverId, approvers))}
                    />
                  ) : null}
                </Chip>
              );
            })}

            {addingPhase ? (
              <form
                className="flex items-center gap-1.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = new FormData(event.currentTarget).get("name");
                  if (typeof name !== "string" || !name.trim()) return;
                  setAddingPhase(false);
                  startTransition(async () => {
                    const result = await addPhase(plan.id, name);
                    if (result.ok && result.id) setSelected({ kind: "phase", id: result.id });
                    else setError(result.ok ? null : (result.error ?? t.errors.generic));
                  });
                }}
              >
                <Input
                  name="name"
                  autoFocus
                  maxLength={60}
                  aria-label={t.plan.addPhase}
                  placeholder={t.plan.phaseName}
                  onBlur={(event) => {
                    if (!event.currentTarget.value.trim()) setAddingPhase(false);
                  }}
                  className="h-8 w-44 text-base"
                />
                <Button type="submit" size="sm" disabled={pending}>
                  {t.common.add}
                </Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAddingPhase(true)}
                className="border-line text-text-3 hover:border-line-strong hover:text-text flex h-8 items-center gap-1.5 rounded-full border border-dashed px-3 text-base font-medium transition-colors"
              >
                <Plus size={13} />
                {t.plan.phaseName}
              </button>
            )}
          </div>

          <div className="card overflow-hidden">
            <div
              className="label border-line grid h-8 items-center gap-2.5 border-b pr-2.5 pl-3"
              style={{ gridTemplateColumns: COLUMNS }}
            >
              <span />
              <span>#</span>
              <span>{t.plan.stepName}</span>
              <span>{t.plan.columnWho}</span>
              <span>{t.plan.columnAfter}</span>
              <span className="text-right">{t.plan.columnEstimate}</span>
              <span />
            </div>

            {shown.map((group, index) => (
              <div key={group.phase?.id ?? "none"}>
                <PhaseRow
                  phase={group.phase}
                  index={plan.phases.findIndex((row) => row.id === group.phase?.id)}
                  count={group.steps.length}
                  approvers={approvers}
                  first={index === 0}
                  selected={selected.kind === "phase" && selected.id === group.phase?.id}
                  pending={pending}
                  onSelect={() =>
                    group.phase ? setSelected({ kind: "phase", id: group.phase.id }) : undefined
                  }
                  onDropStep={(stepId) => move(stepId, null, group.phase?.id ?? null)}
                  onAdd={(title) =>
                    startTransition(async () => {
                      const result = await addTemplateStep(plan.id, title, group.phase?.id);
                      if (result.ok && result.id) setSelected({ kind: "step", id: result.id });
                      else setError(result.ok ? null : (result.error ?? t.errors.generic));
                    })
                  }
                  run={run}
                />

                {group.steps.map((step) => (
                  <StepRow
                    key={step.id}
                    step={step}
                    number={numbers.get(step.id) ?? 0}
                    waitsFor={order.find((row) => row.id === step.dependsOnId)?.title ?? null}
                    people={people}
                    teams={teams}
                    selected={selected.kind === "step" && selected.id === step.id}
                    onSelect={() => setSelected({ kind: "step", id: step.id })}
                    onDropStep={(stepId) => move(stepId, step.id, step.phaseId)}
                    run={run}
                  />
                ))}
              </div>
            ))}

            <AddStep
              phase={last?.phase ?? null}
              pending={pending}
              onAdd={(title) =>
                startTransition(async () => {
                  const result = await addTemplateStep(plan.id, title, last?.phase?.id);
                  if (result.ok && result.id) setSelected({ kind: "step", id: result.id });
                  else setError(result.ok ? null : (result.error ?? t.errors.generic));
                })
              }
            />
          </div>

          <p className="text-text-3 mt-3 flex items-start gap-2 text-sm">
            <Info size={14} className="mt-0.5 shrink-0" />
            {t.plan.dragHint}
          </p>
        </div>

        <aside className="bg-chrome border-line flex flex-col gap-3 border-t p-3 xl:border-t-0 xl:border-l">
          {activeStep ? (
            <StepInspector
              key={activeStep.id}
              step={activeStep}
              number={numbers.get(activeStep.id) ?? 0}
              phase={plan.phases.find((row) => row.id === activeStep.phaseId) ?? null}
              earlier={order.slice(
                0,
                order.findIndex((row) => row.id === activeStep.id),
              )}
              people={people}
              teams={teams}
              onClose={() => setSelected({ kind: "template" })}
            />
          ) : activePhase ? (
            <PhaseInspector
              key={activePhase.id}
              phase={activePhase}
              approvers={approvers}
              onClose={() => setSelected({ kind: "template" })}
            />
          ) : (
            <TemplateInspector plan={plan} people={people} approvers={approvers} />
          )}

          <PanelCard
            title={t.plan.whereUsed}
            action={<span className="text-text-3 tnum font-mono text-xs">{usedCount}</span>}
          >
            {usedBy.length === 0 ? (
              <p className="text-text-3 px-3.5 py-3 text-sm">{t.plan.whereUsedNone}</p>
            ) : (
              <ul className="py-1">
                {usedBy.map((use) => (
                  <li key={use.number}>
                    <Link
                      href={`/tickets/${use.number}`}
                      className="hover:bg-surface-2 flex items-center gap-2.5 px-3.5 py-1.5"
                    >
                      <StatusRing status={use.status} title={use.status?.name} />
                      <span className="min-w-0">
                        <span className="text-text-3 block font-mono text-xs">{use.reference}</span>
                        <span className="block truncate text-base font-medium">{use.title}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-text-3 px-3.5 pt-1 pb-3 text-sm">{t.plan.whereUsedHint}</p>
          </PanelCard>
        </aside>
      </div>

      {previewing ? (
        <Modal
          title={t.plan.previewOnChange}
          description={t.plan.previewBlurb}
          size="lg"
          onClose={() => setPreviewing(false)}
        >
          <Preview groups={groups} numbers={numbers} people={people} teams={teams} />
        </Modal>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ bits -- */

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border px-3 text-base font-medium transition-colors",
        on
          ? "text-brand-deep border-[color-mix(in_oklab,var(--brand)_45%,transparent)] bg-[var(--brand-tint)]"
          : "border-line bg-surface text-text-2 hover:border-line-strong hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function nameOf(id: string | null, people: { id: string; name: string }[]) {
  return people.find((person) => person.id === id)?.name ?? "";
}

function approverOf(
  id: string | null,
  approvers: Person[],
  none: string,
  named: (name: string) => string,
) {
  return id ? named(nameOf(id, approvers)) : none;
}

/** Move, remove, and whatever else a row can have done to it from the keyboard. */
function RowMenu({ label, items }: { label: string; items: { label: string; run: () => void }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative flex justify-end">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((was) => !was);
        }}
        className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-6 items-center justify-center transition-colors"
      >
        <MoreHorizontal size={14} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            role="menu"
            className="animate-rise border-line bg-surface rounded-card absolute top-7 right-0 z-50 w-48 overflow-hidden border p-1 shadow-[var(--shadow-float)]"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  item.run();
                }}
                className="hover:bg-surface-2 rounded-control flex w-full items-center px-2.5 py-1.5 text-left text-base font-medium transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------- the table -- */

function PhaseRow({
  phase,
  index,
  count,
  approvers,
  first,
  selected,
  pending,
  onSelect,
  onDropStep,
  onAdd,
  run,
}: {
  phase: Phase | null;
  index: number;
  count: number;
  approvers: Person[];
  first: boolean;
  selected: boolean;
  pending: boolean;
  onSelect: () => void;
  onDropStep: (stepId: string) => void;
  onAdd: (title: string) => void;
  run: (work: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const t = useMessages();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div
        role={phase ? "button" : undefined}
        tabIndex={phase ? 0 : undefined}
        onClick={() => onSelect()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          const id = event.dataTransfer.getData("text/plain");
          if (id) onDropStep(id);
        }}
        className={cn(
          "bg-surface-2 flex h-9 items-center gap-2.5 px-3 text-left",
          !first && "border-line border-t",
          selected && "bg-[var(--brand-tint)]",
          phase && "cursor-pointer",
        )}
      >
        {phase ? (
          <span className="bg-surface-3 flex size-5 items-center justify-center rounded-[5px] font-mono text-xs font-semibold">
            {index + 1}
          </span>
        ) : null}
        <span className="text-base font-semibold">{phase?.name ?? t.plan.noPhase}</span>
        <span className="text-text-3 text-sm">{t.plan.stepCount(count)}</span>

        {phase?.approverId ? (
          <span className="text-brand-deep ml-auto flex items-center gap-1 rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-xs font-semibold">
            <Stamp size={11} />
            {t.plan.signOffBy(nameOf(phase.approverId, approvers))}
          </span>
        ) : (
          <span className="text-text-3 ml-auto text-sm">{t.plan.noSignOff}</span>
        )}

        <button
          type="button"
          aria-label={t.plan.addToPhase}
          title={t.plan.addToPhase}
          onClick={(event) => {
            event.stopPropagation();
            setAdding(true);
          }}
          className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-6 items-center justify-center transition-colors"
        >
          <Plus size={14} />
        </button>

        {phase ? (
          <RowMenu
            label={t.common.more}
            items={[
              {
                label: t.common.moveUp(phase.name),
                run: () => run(() => movePhase(phase.id, "up")),
              },
              {
                label: t.common.moveDown(phase.name),
                run: () => run(() => movePhase(phase.id, "down")),
              },
              {
                label: t.common.deleteThing(phase.name),
                run: () => run(() => deletePhase(phase.id)),
              },
            ]}
          />
        ) : (
          <span className="w-6" />
        )}
      </div>

      {adding ? (
        <AddStep
          phase={phase}
          pending={pending}
          autoFocus
          onAdd={(title) => {
            setAdding(false);
            onAdd(title);
          }}
        />
      ) : null}
    </>
  );
}

function StepRow({
  step,
  number,
  waitsFor,
  people,
  teams,
  selected,
  onSelect,
  onDropStep,
  run,
}: {
  step: Step;
  number: number;
  waitsFor: string | null;
  people: Person[];
  teams: Group[];
  selected: boolean;
  onSelect: () => void;
  onDropStep: (stepId: string) => void;
  run: (work: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const t = useMessages();
  const [over, setOver] = useState(false);
  const person = people.find((row) => row.id === step.assigneeId);
  const team = teams.find((row) => row.id === step.teamId);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onClick={() => onSelect()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", step.id)}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false);
        const id = event.dataTransfer.getData("text/plain");
        if (id && id !== step.id) onDropStep(id);
      }}
      className={cn(
        "border-line relative grid h-9 cursor-pointer items-center gap-2.5 border-t pr-2.5 pl-3 text-left",
        selected ? "bg-[var(--brand-tint)]" : "hover:bg-surface-2",
        over && "border-t-brand",
      )}
      style={{ gridTemplateColumns: COLUMNS }}
    >
      {selected ? (
        <span aria-hidden className="bg-brand absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm" />
      ) : null}

      <GripVertical size={13} className="text-text-3 cursor-grab opacity-60" aria-hidden />
      <span className="text-text-3 tnum font-mono text-xs">{number}</span>
      <span className="truncate text-base font-medium">{step.title}</span>

      <span className="flex min-w-0 items-center gap-1.5 text-sm">
        {person ? (
          <>
            <Avatar name={person.name} variant={person.avatarVariant} size={18} />
            <span className="text-text-2 truncate">{person.name}</span>
          </>
        ) : team ? (
          <>
            <Users size={13} className="text-text-3 shrink-0" />
            <span className="text-text-2 truncate">{team.name}</span>
          </>
        ) : (
          <span className="text-text-3">{t.plan.usesDefault}</span>
        )}
      </span>

      <span className="text-text-3 truncate text-sm">
        {waitsFor ? t.plan.afterStep(waitsFor) : ""}
      </span>

      <span className="text-text-3 tnum text-right font-mono text-xs">
        {step.estimateMinutes ? formatEstimate(step.estimateMinutes, t.plan.units) : ""}
      </span>

      <RowMenu
        label={t.common.more}
        items={[
          {
            label: t.common.moveUp(step.title),
            run: () => run(() => moveTemplateStep(step.id, "up")),
          },
          {
            label: t.common.moveDown(step.title),
            run: () => run(() => moveTemplateStep(step.id, "down")),
          },
          {
            label: t.common.deleteThing(step.title),
            run: () => run(() => deleteTemplateStep(step.id)),
          },
        ]}
      />
    </div>
  );
}

/** One line at the foot of a phase, quiet until it is used. */
function AddStep({
  phase,
  pending,
  autoFocus = false,
  onAdd,
}: {
  phase: Phase | null;
  pending: boolean;
  autoFocus?: boolean;
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
      className="border-line flex items-center gap-2 border-t px-3 py-2"
    >
      <Input
        value={title}
        autoFocus={autoFocus}
        maxLength={160}
        disabled={pending}
        placeholder={phase ? t.plan.addStepTo(phase.name) : t.plan.addStep}
        aria-label={phase ? t.plan.addStepTo(phase.name) : t.plan.addStep}
        onChange={(event) => setTitle(event.target.value)}
        className="h-8 flex-1 text-base"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending || !title.trim()}>
        <Plus size={13} strokeWidth={2.5} />
        {t.common.add}
      </Button>
    </form>
  );
}

/* --------------------------------------------------------- the inspector -- */

function InspectorCard({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useMessages();
  return (
    <PanelCard
      title={title}
      action={
        <button
          type="button"
          onClick={onClose}
          aria-label={t.plan.deselect}
          className="text-text-3 hover:text-text rounded-control flex size-6 items-center justify-center"
        >
          <X size={14} />
        </button>
      }
    >
      {children}
    </PanelCard>
  );
}

function Labelled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {hint ? <span className="text-text-3 mt-1 block text-sm">{hint}</span> : null}
    </label>
  );
}

/**
 * Everything one step says about itself, as one draft.
 *
 * "Who does it" is one question with two kinds of answer, so it is one control:
 * a person or a group, never both, because two owners is two people each
 * waiting for the other.
 */
function StepInspector({
  step,
  number,
  phase,
  earlier,
  people,
  teams,
  onClose,
}: {
  step: Step;
  number: number;
  phase: Phase | null;
  earlier: Step[];
  people: Person[];
  teams: Group[];
  onClose: () => void;
}) {
  const t = useMessages();
  const draft = useDraft({
    title: step.title,
    description: step.description ?? "",
    who: step.teamId ? `team:${step.teamId}` : (step.assigneeId ?? ""),
    dependsOnId: step.dependsOnId ?? "",
    estimate: step.estimateMinutes ? formatEstimate(step.estimateMinutes, t.plan.units) : "",
    dueDays: step.dueDays === null ? "" : String(step.dueDays),
    skipNeedsReason: step.skipNeedsReason,
    blocksPhase: step.blocksPhase,
  });
  const { draft: d, set } = draft;

  async function save(values: typeof d) {
    const minutes = parseEstimate(values.estimate);
    if (minutes === undefined) return { ok: false as const, error: t.errors.badEstimate };

    const team = values.who.startsWith("team:") ? values.who.slice(5) : null;
    return updateTemplateStep(step.id, {
      title: values.title,
      description: values.description,
      assigneeId: team ? null : values.who || null,
      teamId: team,
      dependsOnId: values.dependsOnId || null,
      estimateMinutes: minutes,
      dueDays: values.dueDays === "" ? null : Number.parseInt(values.dueDays, 10),
      skipNeedsReason: values.skipNeedsReason,
      blocksPhase: values.blocksPhase,
    });
  }

  return (
    <InspectorCard
      title={phase ? t.plan.stepInPhase(number, phase.name) : t.plan.stepNumber(number)}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3 px-3.5 py-3.5">
        <Labelled label={t.settings.name}>
          <Input
            value={d.title}
            maxLength={160}
            onChange={(event) => set({ title: event.target.value })}
          />
        </Labelled>

        <Labelled label={t.plan.instructions} hint={t.plan.instructionsHint}>
          <Textarea
            value={d.description}
            rows={3}
            maxLength={4000}
            placeholder={t.common.optional}
            onChange={(event) => set({ description: event.target.value })}
            className="text-base"
          />
        </Labelled>

        <Labelled label={t.plan.whoDoesIt} hint={t.plan.whoDoesItHint}>
          <Select value={d.who} onChange={(event) => set({ who: event.target.value })}>
            <option value="">{t.plan.whoDefault}</option>
            <optgroup label={t.plan.peopleGroup}>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </optgroup>
            <optgroup label={t.plan.teamsGroup}>
              {teams.map((team) => (
                <option key={team.id} value={`team:${team.id}`}>
                  {team.name}
                </option>
              ))}
            </optgroup>
          </Select>
        </Labelled>

        <Labelled label={t.plan.after} hint={t.plan.afterHint}>
          <Select
            value={d.dependsOnId}
            disabled={earlier.length === 0}
            onChange={(event) => set({ dependsOnId: event.target.value })}
          >
            <option value="">{t.plan.waitsForNothing}</option>
            {earlier.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title}
              </option>
            ))}
          </Select>
        </Labelled>

        <div className="grid grid-cols-2 gap-3">
          <Labelled label={t.plan.estimate}>
            <Input
              value={d.estimate}
              maxLength={12}
              placeholder={t.plan.estimateHint}
              onChange={(event) => set({ estimate: event.target.value })}
              className="font-mono"
            />
          </Labelled>

          {/* How long it takes and when it is wanted are different questions:
              one is the work, the other is the date the change carries. */}
          <Labelled label={t.plan.dueAfter}>
            <Input
              type="number"
              min={0}
              max={365}
              value={d.dueDays}
              placeholder={t.plan.days}
              onChange={(event) => set({ dueDays: event.target.value })}
              className="tnum"
            />
          </Labelled>
        </div>

        <Labelled label={t.plan.ifSkipped}>
          <Select
            value={d.skipNeedsReason ? "reason" : "free"}
            onChange={(event) => set({ skipNeedsReason: event.target.value === "reason" })}
          >
            <option value="free">{t.plan.skipFree}</option>
            <option value="reason">{t.plan.skipNeedsReason}</option>
          </Select>
        </Labelled>

        <label className="text-text-2 flex items-center gap-2 text-base">
          <input
            type="checkbox"
            checked={d.blocksPhase}
            onChange={(event) => set({ blocksPhase: event.target.checked })}
            className="size-4 accent-[var(--brand)]"
          />
          {t.plan.blocksPhase}
        </label>
      </div>

      <SaveBar draft={draft} save={save} variant="footer" />
    </InspectorCard>
  );
}

/** What a phase is called and who signs it off — the gate is what a phase is
 *  for, so the two are one decision. */
function PhaseInspector({
  phase,
  approvers,
  onClose,
}: {
  phase: Phase;
  approvers: Person[];
  onClose: () => void;
}) {
  const t = useMessages();
  const draft = useDraft({ name: phase.name, approverId: phase.approverId ?? "" });

  return (
    <InspectorCard title={t.plan.phaseName} onClose={onClose}>
      <div className="flex flex-col gap-3 px-3.5 py-3.5">
        <Labelled label={t.settings.name}>
          <Input
            value={draft.draft.name}
            maxLength={60}
            onChange={(event) => draft.set({ name: event.target.value })}
          />
        </Labelled>

        <Labelled label={t.plan.signOff} hint={t.plan.phaseSignOffHint}>
          <Select
            value={draft.draft.approverId}
            onChange={(event) => draft.set({ approverId: event.target.value })}
          >
            <option value="">{t.plan.noSignOff}</option>
            {approvers.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </Labelled>
      </div>

      <SaveBar
        draft={draft}
        variant="footer"
        save={(values) =>
          updatePhase(phase.id, { ...values, approverId: values.approverId || null })
        }
      />
    </InspectorCard>
  );
}

/** The plan's own details: what it is called, what it covers, who signs it off
 *  and who its steps go to when nobody is named. */
function TemplateInspector({
  plan,
  people,
  approvers,
}: {
  plan: Plan;
  people: Person[];
  approvers: Person[];
}) {
  const t = useMessages();
  const draft = useDraft({
    name: plan.name,
    description: plan.description ?? "",
    approverId: plan.approverId ?? "",
    defaultAssigneeId: plan.defaultAssigneeId ?? "",
  });
  const { draft: d, set } = draft;

  return (
    <PanelCard title={t.plan.templateDetails}>
      <div className="flex flex-col gap-3 px-3.5 py-3.5">
        <Labelled label={t.settings.name}>
          <Input value={d.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
        </Labelled>

        <Labelled label={t.plan.whatItCovers}>
          <Input
            value={d.description}
            maxLength={160}
            placeholder={t.common.optional}
            onChange={(event) => set({ description: event.target.value })}
          />
        </Labelled>

        <Labelled label={t.plan.signOff} hint={t.plan.signOffHint}>
          <Select
            value={d.approverId}
            onChange={(event) => set({ approverId: event.target.value })}
          >
            <option value="">{t.plan.noSignOff}</option>
            {approvers.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </Labelled>

        <Labelled label={t.plan.templateDefaultAssignee} hint={t.plan.templateDefaultAssigneeHint}>
          <Select
            value={d.defaultAssigneeId}
            onChange={(event) => set({ defaultAssigneeId: event.target.value })}
          >
            <option value="">{t.plan.nobody}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </Labelled>

        <p className="text-text-3 text-sm">{t.plan.gateHint}</p>
      </div>

      <SaveBar
        draft={draft}
        variant="footer"
        save={(values) =>
          updateTemplate(plan.id, {
            name: values.name,
            description: values.description,
            approverId: values.approverId || null,
            defaultAssigneeId: values.defaultAssigneeId || null,
          })
        }
      />
    </PanelCard>
  );
}

/* ------------------------------------------------------------- preview --- */

/**
 * The plan as the desk will meet it: phases as numbered sections, the gate
 * between them, and nothing to tick. Drawn from the plan rather than from a
 * real change, so it can be looked at before anybody is given one.
 */
function Preview({
  groups,
  numbers,
  people,
  teams,
}: {
  groups: { phase: Phase | null; steps: Step[] }[];
  numbers: Map<string, number>;
  people: Person[];
  teams: Group[];
}) {
  const t = useMessages();

  return (
    <div className="max-h-[60vh] space-y-5 overflow-y-auto">
      {groups.map((group, index) => (
        <section key={group.phase?.id ?? "none"}>
          <div className="flex items-center gap-2.5 px-1 pb-2">
            <span className="text-text-3 font-mono text-xs">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="text-md font-semibold">{group.phase?.name ?? t.plan.noPhase}</h3>
            {group.phase?.approverId ? (
              <span className="text-text-2 inline-flex h-[18px] items-center rounded-full bg-[color-mix(in_oklab,var(--text)_6%,transparent)] px-1.5 text-xs font-medium">
                {t.plan.lockedByApproval}
              </span>
            ) : null}
            <span className="text-text-3 ml-auto font-mono text-xs">0/{group.steps.length}</span>
          </div>

          <ol className="card divide-line divide-y overflow-hidden">
            {group.steps.map((step) => {
              const person = people.find((row) => row.id === step.assigneeId);
              const team = teams.find((row) => row.id === step.teamId);
              return (
                <li key={step.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-text-3 tnum w-5 shrink-0 font-mono text-xs">
                    {numbers.get(step.id)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium">{step.title}</span>
                    {step.description ? (
                      <span className="text-text-3 block truncate text-sm">{step.description}</span>
                    ) : null}
                  </span>
                  <span className="text-text-3 shrink-0 text-sm">
                    {person?.name ?? team?.name ?? ""}
                  </span>
                  <span className="text-text-3 tnum w-12 shrink-0 text-right font-mono text-xs">
                    {step.estimateMinutes ? formatEstimate(step.estimateMinutes, t.plan.units) : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
