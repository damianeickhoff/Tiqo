"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import { addBlockedWord, removeBlockedWord } from "@/lib/actions/settings";
import { Button, FieldError, FormError, Input } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

export function BlockedWordManager({ words }: { words: { id: string; word: string }[] }) {
  const t = useMessages();
  const [state, formAction] = useActionState(addBlockedWord, undefined);
  const errors = state?.errors ?? {};

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-2">
        <FormError>{errors.form}</FormError>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="label mb-1.5 block">{t.settings.addWord}</span>
            <Input
              name="word"
              placeholder={t.settings.oneWord}
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              className="w-56"
              aria-invalid={Boolean(errors.word)}
            />
          </label>
          <AddButton />
        </div>

        <FieldError>{errors.word}</FieldError>
      </form>

      {words.length === 0 ? (
        <p className="border-border text-text-3 rounded-card text-md border border-dashed px-4 py-8 text-center">
          {t.settings.nothingBlocked}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {words.map((entry) => (
            <BlockedWordChip key={entry.id} id={entry.id} word={entry.word} />
          ))}
        </ul>
      )}
    </div>
  );
}

function BlockedWordChip({ id, word }: { id: string; word: string }) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li>
      <span
        className="bg-surface-3 inline-flex items-center gap-1.5 rounded-full py-1 pr-1 pl-3 text-base"
        title={error ?? undefined}
      >
        <span className="font-mono">{word}</span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await removeBlockedWord(id);
              if (!result.ok) setError(result.error);
            })
          }
          aria-label={t.settings.unblock(word)}
          className="text-text-3 hover:bg-negative/12 hover:text-negative flex size-5 items-center justify-center rounded-full transition-colors disabled:opacity-50"
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      </span>
    </li>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" disabled={pending}>
      <Plus size={15} strokeWidth={2.5} />
      {pending ? t.common.adding : t.settings.blockIt}
    </Button>
  );
}
