"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { createTag, deleteTag, renameTag } from "@/lib/actions/settings";
import { Button, FieldError, FormError, Input } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

type Tag = { id: string; name: string; color: string; tickets: number };

export function TagManager({ tags }: { tags: Tag[] }) {
  const t = useMessages();
  const [state, formAction] = useActionState(createTag, undefined);
  const [editing, setEditing] = useState<string | null>(null);
  const errors = state?.errors ?? {};

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-3">
        <FormError>{errors.form}</FormError>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="label mb-1.5 block">{t.settings.newTag}</span>
            <Input
              name="name"
              placeholder={t.settings.name}
              maxLength={30}
              className="w-48"
              aria-invalid={Boolean(errors.name)}
            />
          </label>

          <CreateButton />
        </div>

        <FieldError>{errors.name}</FieldError>
      </form>

      {tags.length === 0 ? (
        <p className="border-border text-text-3 rounded-card text-md border border-dashed px-4 py-8 text-center">
          {t.settings.noTags}
        </p>
      ) : (
        <ul className="card divide-border-soft divide-y">
          {tags.map((tag) =>
            editing === tag.id ? (
              <TagEditRow key={tag.id} tag={tag} onDone={() => setEditing(null)} />
            ) : (
              <TagRow key={tag.id} tag={tag} onEdit={() => setEditing(tag.id)} />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function TagRow({ tag, onEdit }: { tag: Tag; onEdit: () => void }) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function remove() {
    startTransition(async () => {
      const result = await deleteTag(tag.id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <li className="group flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="text-md min-w-0 flex-1 truncate font-medium">{tag.name}</span>

      <span className="tnum text-text-3 shrink-0 text-base">
        {t.settings.ticketCount(tag.tickets)}
      </span>

      {error ? <span className="text-negative text-sm font-medium">{error}</span> : null}

      {confirming ? (
        <span className="flex shrink-0 items-center gap-2">
          {/* Deleting takes the tag off the tickets that carry it, which is not
              obvious from a bin icon — so the count is repeated in the ask. */}
          <span className="text-text-2 text-base">{t.settings.removeFrom(tag.tickets)}</span>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
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
        <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            aria-label={t.common.editThing(tag.name)}
            className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-7 items-center justify-center transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={t.common.deleteThing(tag.name)}
            className="text-text-3 hover:bg-negative/12 hover:text-negative rounded-control flex size-7 items-center justify-center transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </span>
      )}
    </li>
  );
}

function TagEditRow({ tag, onDone }: { tag: Tag; onDone: () => void }) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(tag.name);
  // The colour is no longer shown or chosen, but the column is still on the
  // row and the action still validates it, so it is carried through unchanged.
  const color = tag.color;
  const [error, setError] = useState<string | null>(null);

  function save() {
    startTransition(async () => {
      const result = await renameTag(tag.id, name, color);
      if (result.ok) onDone();
      else setError(result.error);
    });
  }

  return (
    <li className="bg-surface-2 flex flex-wrap items-center gap-3 px-4 py-2.5">
      <Input
        value={name}
        autoFocus
        maxLength={30}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") onDone();
        }}
        aria-label={t.common.renameThing(tag.name)}
        className="h-9 w-48"
      />

      {error ? <span className="text-negative text-sm font-medium">{error}</span> : null}

      <span className="ml-auto flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={save}
          disabled={pending || !name.trim()}
          aria-label={t.common.save}
          className="bg-brand rounded-control flex size-8 items-center justify-center text-[var(--brand-ink)] disabled:opacity-40"
        >
          <Check size={15} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={onDone}
          aria-label={t.common.cancel}
          className="text-text-3 hover:bg-surface-3 hover:text-text rounded-control flex size-8 items-center justify-center"
        >
          <X size={15} />
        </button>
      </span>
    </li>
  );
}

function CreateButton() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" disabled={pending}>
      <Plus size={15} strokeWidth={2.5} />
      {pending ? t.common.adding : t.settings.addTag}
    </Button>
  );
}
