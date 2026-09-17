"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronUp, Flag, Plus, Trash2 } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  addMilestone,
  deleteMilestone,
  moveMilestone,
  updateMilestone,
} from "@/lib/actions/projects";
import { daysUntil } from "@/lib/projects";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { SaveBar, useDraft } from "@/components/settings/draft";
import { useDateFormat, useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

export type MilestoneRow = {
  id: string;
  title: string;
  description: string | null;
  dueOn: Date | null;
  reachedAt: Date | null;
  total: number;
  done: number;
  /// Open tickets on this milestone that are past their response target.
  late: number;
};

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

function asDay(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

/**
 * The dated points a project is working towards.
 *
 * Reaching one is a declaration and takes effect at once; describing one is a
 * draft with a Save. That split is the same one the whole app follows, and it
 * is the difference between saying a thing happened and writing down what the
 * thing is.
 *
 * Only the card being edited carries a form. Every card used to, which put five
 * textareas and five Save buttons on a page whose job is to say where the work
 * has got to.
 */
export function MilestoneManager({
  projectId,
  milestones,
  canEdit,
}: {
  projectId: string;
  milestones: MilestoneRow[];
  canEdit: boolean;
}) {
  const t = useMessages();
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  function add() {
    run(async () => {
      const result = await addMilestone(projectId, title);
      if (result.ok) setTitle("");
      return result;
    });
  }

  // The first point still to be reached: the one being worked on, and the only
  // one that gets the ring.
  const currentId = milestones.find((milestone) => !milestone.reachedAt)?.id ?? null;

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p className="bg-negative/[0.06] text-negative rounded-control px-4 py-2 text-base font-medium">
          {error}
        </p>
      ) : null}

      {/* The add line leads, because a page of milestones is a page you come to
          in order to add one. Dashed, so it reads as a slot rather than a card. */}
      {canEdit ? (
        <div className="border-line-strong rounded-card flex items-center gap-2.5 border border-dashed px-3 py-2.5">
          <Flag size={15} className="text-text-3 shrink-0" aria-hidden />
          <Input
            value={title}
            maxLength={120}
            aria-label={t.projects.milestoneName}
            placeholder={t.projects.milestoneAddPlaceholder}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && title.trim()) {
                event.preventDefault();
                add();
              }
            }}
            // Its own border, not the dashed row's: without one the whole line
            // reads as a button, and nobody tries to type in a button.
            className="h-8"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !title.trim()}
            onClick={add}
          >
            <Plus size={14} strokeWidth={2.5} />
            {t.projects.addMilestone}
          </Button>
        </div>
      ) : null}

      {milestones.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-text-3 text-md">{t.projects.noMilestones}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {milestones.map((milestone, index) => (
            <li key={milestone.id}>
              <MilestoneCard
                milestone={milestone}
                current={milestone.id === currentId}
                first={index === 0}
                last={index === milestones.length - 1}
                canEdit={canEdit}
                pending={pending}
                editing={editing === milestone.id}
                onEdit={() => setEditing(milestone.id)}
                onDone={() => setEditing(null)}
                run={run}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MilestoneCard({
  milestone,
  current,
  first,
  last,
  canEdit,
  pending,
  editing,
  onEdit,
  onDone,
  run,
}: {
  milestone: MilestoneRow;
  current: boolean;
  first: boolean;
  last: boolean;
  canEdit: boolean;
  pending: boolean;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  run: (work: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const t = useMessages();
  const day = useDateFormat(DAY);
  const draft = useDraft({
    description: milestone.description ?? "",
    dueOn: asDay(milestone.dueOn),
  });
  const { draft: d, set } = draft;

  const reached = Boolean(milestone.reachedAt);
  const left = milestone.dueOn ? daysUntil(milestone.dueOn) : null;
  const pct = milestone.total === 0 ? 0 : Math.round((milestone.done / milestone.total) * 100);
  const stamp = milestone.reachedAt ?? milestone.dueOn;

  return (
    <div
      // The card has no border of its own any more, so the brand edge while
      // editing has to bring one.
      className={cn("card px-4 py-3.5", reached && "opacity-75", editing && "border")}
      style={
        editing ? { borderColor: "color-mix(in oklab, var(--brand) 45%, transparent)" } : undefined
      }
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            reached && "bg-positive text-white",
            !reached &&
              current &&
              "bg-brand text-[var(--brand-ink)] ring-4 ring-[var(--brand-tint)]",
            !reached && !current && "bg-surface-3 text-text-3",
          )}
        >
          {reached ? <Check size={14} strokeWidth={3} /> : <Flag size={13} />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-md truncate font-semibold">{milestone.title}</p>
          <p className="text-text-3 mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm">
            {reached ? (
              <span className="text-positive font-medium">{t.projects.reachedOn}</span>
            ) : left === null ? (
              <span>{t.projects.noDates}</span>
            ) : left < 0 ? (
              <span className="text-negative font-medium">{t.projects.overdueBy(-left)}</span>
            ) : left === 0 ? (
              <span className="text-brand-deep font-medium">{t.projects.dueToday}</span>
            ) : (
              <span>{t.projects.dueIn(left)}</span>
            )}
            {stamp ? (
              <>
                <span aria-hidden>·</span>
                <span className="tnum font-mono">{day.format(stamp)}</span>
              </>
            ) : null}
            <span aria-hidden>·</span>
            {/* The tally is a way in: "4 of 9" is only useful if you can go and
                see which nine. */}
            <Link
              href={`/tickets?milestone=`}
              className="text-text-2 tnum font-mono hover:underline"
            >
              {t.projects.milestoneTickets(milestone.done, milestone.total)}
            </Link>
            {milestone.late > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span className="text-negative">{t.projects.pastTargetCount(milestone.late)}</span>
              </>
            ) : null}
          </p>
        </div>

        {canEdit ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={reached ? "ghost" : "outline"}
              disabled={pending}
              className="h-[26px]"
              onClick={() => run(() => updateMilestone(milestone.id, { reached: !reached }))}
            >
              {reached ? t.projects.reopenMilestone : t.projects.markReached}
            </Button>

            <span aria-hidden className="bg-line mx-0.5 h-4 w-px" />

            <IconButton
              label={t.common.moveUp(milestone.title)}
              disabled={pending || first}
              onClick={() => run(() => moveMilestone(milestone.id, "up"))}
            >
              <ChevronUp size={14} />
            </IconButton>
            <IconButton
              label={t.common.moveDown(milestone.title)}
              disabled={pending || last}
              onClick={() => run(() => moveMilestone(milestone.id, "down"))}
            >
              <ChevronDown size={14} />
            </IconButton>
            <ConfirmDelete
              title={t.common.deleteThing(milestone.title)}
              run={async () => run(() => deleteMilestone(milestone.id))}
            >
              {(ask) => (
                <IconButton label={t.common.deleteThing(milestone.title)} danger onClick={ask}>
                  <Trash2 size={13} />
                </IconButton>
              )}
            </ConfirmDelete>
          </span>
        ) : null}
      </div>

      <div className="bg-surface-3 mt-3 h-[5px] overflow-hidden rounded-full">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: reached ? "var(--positive)" : "var(--brand)" }}
        />
      </div>

      {editing ? (
        <div className="animate-rise mt-3.5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <label className="block">
              <span className="label mb-1.5 block">{t.projects.descriptionLabel}</span>
              <Textarea
                value={d.description}
                rows={2}
                maxLength={600}
                autoFocus
                placeholder={t.common.optional}
                onChange={(event) => set({ description: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="label mb-1.5 block">{t.projects.due}</span>
              <Input
                type="date"
                value={d.dueOn}
                onChange={(event) => set({ dueOn: event.target.value })}
              />
            </label>
          </div>

          <SaveBar
            draft={draft}
            onCancel={onDone}
            onSaved={onDone}
            save={(values) =>
              updateMilestone(milestone.id, {
                title: milestone.title,
                description: values.description,
                dueOn: values.dueOn || null,
              })
            }
          />
        </div>
      ) : milestone.description ? (
        <p className="text-text-2 mt-2 max-w-[620px] text-base leading-relaxed">
          {milestone.description}
          {canEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="text-text-3 hover:text-text ml-2 text-sm transition-colors"
            >
              {t.common.edit}
            </button>
          ) : null}
        </p>
      ) : canEdit ? (
        <p className="text-text-3 mt-2 text-base">
          {t.projects.noDescription} ·{" "}
          <button type="button" onClick={onEdit} className="text-brand-deep hover:underline">
            {t.projects.addDescription}
          </button>
        </p>
      ) : null}
    </div>
  );
}

/** The 26px square controls that sit after the hairline on every card. */
function IconButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "bg-surface rounded-control flex size-[26px] items-center justify-center border border-transparent",
        "shadow-[var(--highlight)] transition-[border-color,color] disabled:opacity-40",
        danger
          ? "text-text-3 hover:border-negative/40 hover:text-negative"
          : "text-text-2 hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
