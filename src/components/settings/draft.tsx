"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/**
 * An edit in progress.
 *
 * Everything someone types, picks or ticks inside an editor changes this and
 * nothing else; the database hears about it when they press Save. That is the
 * rule for the whole settings area — see CLAUDE.md — and it lives in one hook
 * so a panel cannot half-follow it.
 *
 * The committed copy is kept beside the working one rather than compared
 * against a prop, because after a save the two are the same by definition and
 * a prop that arrives late would otherwise throw away what is on screen.
 */
export function useDraft<T extends object>(initial: T) {
  const [committed, setCommitted] = useState(initial);
  const [draft, setDraft] = useState(initial);

  const dirty = (Object.keys(draft) as (keyof T)[]).some((key) => draft[key] !== committed[key]);

  const set = useCallback(
    (patch: Partial<T>) => setDraft((current) => ({ ...current, ...patch })),
    [],
  );

  const reset = useCallback(() => setDraft(committed), [committed]);

  const commit = useCallback((next: T) => {
    setCommitted(next);
    setDraft(next);
  }, []);

  // The committed copy is handed back too, so a caller can say *what* changed
  // rather than only that something did — a Save bar reading "unsaved" makes
  // you go and find out which field it meant.
  return { draft, committed, dirty, set, reset, commit };
}

type Result = { ok: boolean; error?: string };

/**
 * The Save control for a draft: idle until there is something to save, then a
 * pair of buttons, then a tick that fades.
 *
 * `save` returns the values that were sent, so the hook can treat them as the
 * new committed state without waiting for the server to send them back.
 */
export function SaveBar<T extends object>({
  draft,
  onSaved,
  onCancel,
  save,
  label,
  summary,
  variant = "floating",
  hideWhenIdle = false,
  className,
}: {
  draft: { draft: T; dirty: boolean; reset: () => void; commit: (next: T) => void };
  onSaved?: () => void;
  /// Given when the editor can be left rather than only reset — an editor that
  /// was opened needs a way out even when nothing has been typed in it.
  onCancel?: () => void;
  save: (values: T) => Promise<Result>;
  label?: string;
  /// What is about to change, in a few words — "High → Urgent", "Phone
  /// changed". Shown in place of the bare "unsaved", because a bar that says
  /// only that something is unsaved makes you go and find out what.
  summary?: string;
  /// "footer" seats the bar inside a card as its bottom row instead of letting
  /// it float: a card that already ends in a hairline does not need a second
  /// one hovering over it.
  variant?: "footer" | "floating";
  /// Draw nothing at all while there is nothing to save. Decided here rather
  /// than by the caller, because the caller cannot see the saved tick — hiding
  /// the bar from outside takes the confirmation away with it.
  hideWhenIdle?: boolean;
  className?: string;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function submit() {
    const values = draft.draft;
    startTransition(async () => {
      const result = await save(values);
      if (!result.ok) {
        setError(result.error ?? t.errors.generic);
        return;
      }
      setError(null);
      draft.commit(values);
      onSaved?.();
      setFlash(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(false), 2400);
    });
  }

  // Nothing to save, nothing saved a moment ago, nothing to report: no bar.
  // The tick is why this is decided here — it lives past the dirty state, and a
  // caller hiding the bar itself would take the confirmation with it.
  if (hideWhenIdle && !draft.dirty && !flash && !pending && !error) return null;

  return (
    // Idle, the bar sits in the flow under its form. Dirty, it sticks to the
    // foot of the scrollport, so a long form never hides the way to save it —
    // unless it was given a card to be the bottom of, which is already in view.
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        variant === "footer"
          ? "border-line bg-surface-2 border-t px-2.5 py-2"
          : draft.dirty &&
              "border-line bg-surface rounded-card sticky bottom-3 z-20 -mx-1 border px-3 py-2 shadow-[var(--shadow-float)]",
        className,
      )}
    >
      <Button type="button" size="sm" disabled={!draft.dirty || pending} onClick={submit}>
        {pending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Check size={14} strokeWidth={2.5} />
        )}
        {pending ? t.common.saving : (label ?? t.common.save)}
      </Button>

      {onCancel && !pending ? (
        <button
          type="button"
          onClick={() => {
            draft.reset();
            setError(null);
            onCancel();
          }}
          className="text-text-3 hover:text-text rounded-full px-2 py-1 text-base font-medium transition-colors"
        >
          {t.common.cancel}
        </button>
      ) : null}

      {!onCancel && draft.dirty && !pending ? (
        <button
          type="button"
          onClick={() => {
            draft.reset();
            setError(null);
          }}
          className="text-text-3 hover:text-text rounded-full px-2 py-1 text-base font-medium transition-colors"
        >
          {t.common.discard}
        </button>
      ) : null}

      {draft.dirty && !pending ? (
        <span className={cn("text-text-3 text-sm", variant === "footer" && "ml-auto truncate")}>
          {summary ?? t.common.unsaved}
        </span>
      ) : null}

      {flash && !draft.dirty ? (
        <span className="animate-fade text-positive inline-flex items-center gap-1 text-sm font-medium">
          <Check size={13} strokeWidth={2.5} />
          {t.common.saved}
        </span>
      ) : null}

      {error ? <span className="text-negative text-sm font-medium">{error}</span> : null}
    </div>
  );
}
