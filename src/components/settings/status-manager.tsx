"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createStatus,
  deleteStatus,
  moveStatus,
  setStatusFlag,
  updateStatus,
} from "@/lib/actions/statuses";
import { Button, FieldError, FormError, Input } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

type Status = {
  id: string;
  name: string;
  color: string;
  settles: boolean;
  isDefault: boolean;
  isClosing: boolean;
  isCancelling: boolean;
  showOnPortal: boolean;
  pausesClock: boolean;
  tickets: number;
};

export function StatusManager({ statuses }: { statuses: Status[] }) {
  const t = useMessages();
  const [state, formAction] = useActionState(createStatus, undefined);
  const errors = state?.errors ?? {};

  return (
    <div className="space-y-4">
      <ul className="card divide-border-soft divide-y">
        {statuses.map((status, index) => (
          <StatusRow
            key={status.id}
            status={status}
            first={index === 0}
            last={index === statuses.length - 1}
          />
        ))}
      </ul>

      <form action={formAction} className="space-y-3 pt-4">
        <FormError>{errors.form}</FormError>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="label mb-1.5 block">{t.settings.newStatus}</span>
            <Input name="name" placeholder={t.settings.name} maxLength={40} className="w-44" />
          </label>
          <label className="block">
            <span className="label mb-1.5 block">{t.settings.colour}</span>
            <input
              type="color"
              name="color"
              defaultValue="#9a9287"
              aria-label={t.settings.colour}
              className="bg-surface rounded-control h-11 w-12 cursor-pointer border border-transparent p-1 shadow-[var(--highlight)]"
            />
          </label>
          <label className="bg-surface rounded-control flex h-11 cursor-pointer items-center gap-2 border border-transparent px-3 text-base shadow-[var(--highlight)]">
            <input type="checkbox" name="settles" className="size-4 accent-[var(--brand)]" />
            {t.settings.countsAsSettled}
          </label>
          <label className="bg-surface rounded-control flex h-11 cursor-pointer items-center gap-2 border border-transparent px-3 text-base shadow-[var(--highlight)]">
            <input type="checkbox" name="showOnPortal" className="size-4 accent-[var(--brand)]" />
            {t.settings.showOnPortal}
          </label>
          <label className="bg-surface rounded-control flex h-11 cursor-pointer items-center gap-2 border border-transparent px-3 text-base shadow-[var(--highlight)]">
            <input type="checkbox" name="pausesClock" className="size-4 accent-[var(--brand)]" />
            {t.settings.stopsClock}
          </label>
          <AddButton />
        </div>

        <FieldError>{errors.name}</FieldError>
        <p className="text-text-3 text-sm">{t.settings.settledHint}</p>
        <p className="text-text-3 text-sm">{t.settings.portalStatusHint}</p>
        <p className="text-text-3 text-sm">{t.settings.clockStopHint}</p>
      </form>
    </div>
  );
}

function StatusRow({ status, first, last }: { status: Status; first: boolean; last: boolean }) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(status.name);
  const [color, setColor] = useState(status.color);
  const [settles, setSettles] = useState(status.settles);
  const [onPortal, setOnPortal] = useState(status.showOnPortal);
  const [pauses, setPauses] = useState(status.pausesClock);
  const [confirming, setConfirming] = useState(false);

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await work();
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  if (editing) {
    return (
      <li className="bg-surface-2 flex flex-wrap items-center gap-3 px-4 py-2.5">
        <input
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          aria-label={t.settings.colour}
          className="bg-surface rounded-control h-9 w-10 shrink-0 cursor-pointer border border-transparent p-1 shadow-[var(--highlight)]"
        />
        <Input
          value={name}
          autoFocus
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          className="h-9 w-44"
          aria-label={t.settings.name}
        />
        <label className="flex cursor-pointer items-center gap-2 text-base">
          <input
            type="checkbox"
            checked={settles}
            onChange={(event) => setSettles(event.target.checked)}
            className="size-4 accent-[var(--brand)]"
          />
          {t.settings.countsAsSettled}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-base">
          <input
            type="checkbox"
            checked={onPortal}
            onChange={(event) => setOnPortal(event.target.checked)}
            className="size-4 accent-[var(--brand)]"
          />
          {t.settings.showOnPortal}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-base">
          <input
            type="checkbox"
            checked={pauses}
            onChange={(event) => setPauses(event.target.checked)}
            className="size-4 accent-[var(--brand)]"
          />
          {t.settings.stopsClock}
        </label>

        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            disabled={pending || !name.trim()}
            onClick={() =>
              run(async () => {
                const result = await updateStatus(status.id, {
                  name,
                  color,
                  settles,
                  showOnPortal: onPortal,
                  pausesClock: pauses,
                });
                if (result.ok) setEditing(false);
                return result;
              })
            }
            aria-label={t.common.save}
            className="bg-brand rounded-control flex size-8 items-center justify-center text-[var(--brand-ink)] disabled:opacity-40"
          >
            <Check size={15} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => {
              setName(status.name);
              setColor(status.color);
              setSettles(status.settles);
              setOnPortal(status.showOnPortal);
              setPauses(status.pausesClock);
              setEditing(false);
            }}
            aria-label={t.common.cancel}
            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-8 items-center justify-center"
          >
            <X size={15} />
          </button>
        </span>
      </li>
    );
  }

  return (
    // Columns, not a flowing row. Every cell starts at the same x on every
    // line, so a status carrying four traits and one carrying none no longer
    // put their neighbours in different places down the list.
    <li className="group grid grid-cols-[auto_minmax(0,1fr)_auto_3rem] items-center gap-x-3 px-4 py-3">
      <span
        aria-hidden
        className="size-3 shrink-0 rounded-full"
        style={{ background: status.color }}
      />
      <span className="text-md min-w-0 font-medium">{status.name}</span>

      <span className="flex w-[15rem] shrink-0 items-center justify-end gap-1.5">
        {status.settles ? <Trait>{t.settings.settled}</Trait> : null}
        {status.showOnPortal ? <Trait>{t.settings.onPortal}</Trait> : null}
        {status.pausesClock ? <Trait>{t.settings.clockStops}</Trait> : null}
        {status.isDefault ? <Trait accent>{t.settings.startsHere}</Trait> : null}
        {status.isClosing ? <Trait accent>{t.settings.closesHere}</Trait> : null}
        {status.isCancelling ? <Trait accent>{t.settings.cancelsHere}</Trait> : null}
      </span>

      <span className="tnum text-text-3 text-right text-base">{status.tickets || "—"}</span>

      {error ? <span className="text-negative col-span-4 text-sm font-medium">{error}</span> : null}

      {confirming ? (
        <span className="col-span-4 flex flex-wrap items-center justify-end gap-2">
          <span className="text-text-2 text-base">
            {status.tickets > 0 ? t.settings.leaveWithout(status.tickets) : t.settings.deleteStatus}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteStatus(status.id))}
            className="bg-negative rounded-control px-2.5 py-1 text-base font-semibold text-white disabled:opacity-50"
          >
            {t.common.delete}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-text-3 hover:text-text text-base"
          >
            {t.common.cancel}
          </button>
        </span>
      ) : (
        <span className="col-span-4 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {status.isDefault ? null : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setStatusFlag(status.id, "isDefault"))}
              className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control px-2 py-1 text-sm"
              title={t.settings.startsHereHint}
            >
              {t.settings.makeStart}
            </button>
          )}
          {status.isClosing ? null : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setStatusFlag(status.id, "isClosing"))}
              className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control px-2 py-1 text-sm"
              title={t.settings.closeSendsHere}
            >
              {t.settings.makeClose}
            </button>
          )}
          {status.isCancelling ? null : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setStatusFlag(status.id, "isCancelling"))}
              className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control px-2 py-1 text-sm"
              title={t.settings.cancelSendsHere}
            >
              {t.settings.makeCancel}
            </button>
          )}
          <button
            type="button"
            disabled={pending || first}
            onClick={() => run(() => moveStatus(status.id, "up"))}
            aria-label={t.common.moveUp(status.name)}
            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-7 items-center justify-center disabled:opacity-25"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            disabled={pending || last}
            onClick={() => run(() => moveStatus(status.id, "down"))}
            aria-label={t.common.moveDown(status.name)}
            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-7 items-center justify-center disabled:opacity-25"
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={t.common.editThing(status.name)}
            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-7 items-center justify-center"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={t.common.deleteThing(status.name)}
            className="text-text-3 hover:bg-negative/12 hover:text-negative rounded-control flex size-7 items-center justify-center"
          >
            <Trash2 size={14} />
          </button>
        </span>
      )}
    </li>
  );
}

function Trait({ children, accent = false }: { children: string; accent?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
        accent
          ? "text-brand-deep bg-[var(--brand-tint)] font-semibold"
          : "bg-surface-3 text-text-2 font-medium",
      )}
    >
      {children}
    </span>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" disabled={pending}>
      <Plus size={15} strokeWidth={2.5} />
      {pending ? t.common.adding : t.settings.addStatus}
    </Button>
  );
}
