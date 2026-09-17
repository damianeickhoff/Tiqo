"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { updateTicket } from "@/lib/actions/tickets";
import { Markdown } from "@/components/markdown";
import { MarkdownEditor } from "@/components/markdown-editor";
import { cn } from "@/lib/utils";
import { useMessages } from "@/components/shell/instance-context";

/**
 * Edit-in-place for the ticket's title and description. Both already flow
 * through `updateTicket`, so an edit here writes the same activity entry an
 * agent would get from any other route.
 */
export function EditableText({
  ticketId,
  field,
  value,
  canEdit,
  as,
  className,
  placeholder,
}: {
  ticketId: string;
  field: "title" | "description";
  value: string;
  canEdit: boolean;
  as: "title" | "body";
  className?: string;
  placeholder?: string;
}) {
  const t = useMessages();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const next = draft.trim();
    if (field === "title" && next.length < 3) {
      setError("A title needs at least 3 characters.");
      return;
    }
    if (next === value) {
      setEditing(false);
      return;
    }

    startTransition(async () => {
      const result = await updateTicket(ticketId, { [field]: next });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setEditing(false);
    });
  }

  function cancel() {
    setDraft(value);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    const trigger = canEdit ? (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        aria-label={field === "title" ? "Edit title" : "Edit description"}
        title={field === "title" ? "Edit title" : "Edit description"}
        className={cn(
          "text-text-2 transition-all",
          as === "title"
            ? "hover:bg-surface-3 hover:text-text rounded-control mt-1.5 shrink-0 p-1 opacity-0 group-hover/edit:opacity-100 focus-visible:opacity-100"
            : // In the corner of the card, in the same segmented shell a
              // comment's controls wear — the two read as the same affordance
              // rather than two different ideas about where an edit button goes.
              "border-border bg-surface hover:bg-surface-3 hover:text-text rounded-control absolute top-5 right-5 flex size-8 items-center justify-center border opacity-0 group-hover/body:opacity-100 focus-visible:opacity-100",
        )}
      >
        <Pencil size={15} />
      </button>
    ) : null;

    if (as === "body") {
      return (
        <>
          {value ? (
            <Markdown text={value} className={className} />
          ) : (
            <span className={cn(className, "text-text-3")}>{placeholder}</span>
          )}
          {trigger}
        </>
      );
    }

    return (
      <div className="group/edit flex flex-wrap items-start gap-2">
        {value ? (
          <span className={className}>{value}</span>
        ) : (
          <span className={cn(className, "text-text-3")}>{placeholder}</span>
        )}
        {trigger}
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-2">
      {as === "title" ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
            if (event.key === "Escape") cancel();
          }}
          aria-label="Ticket title"
          className="border-brand bg-surface rounded-control w-full border px-3 py-2 text-xl font-extrabold tracking-[-0.025em] ring-4 ring-[var(--brand-tint)] outline-none lg:text-2xl"
        />
      ) : (
        <MarkdownEditor
          autoFocus
          rows={6}
          value={draft}
          onChange={setDraft}
          className="border-brand ring-4 ring-[var(--brand-tint)]"
        />
      )}

      {error ? <p className="text-negative text-sm font-medium">{error}</p> : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="bg-brand rounded-control inline-flex h-8 items-center gap-1.5 px-3 text-base font-semibold text-[var(--brand-ink)] disabled:opacity-50"
        >
          <Check size={13} strokeWidth={2.5} />
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="text-text-2 hover:text-text rounded-control inline-flex h-8 items-center gap-1.5 px-2.5 text-base"
        >
          <X size={13} />
          {t.common.cancel}
        </button>
        <span className="text-text-3 text-sm">
          {as === "title" ? "Enter to save · Esc to cancel" : "Alt+Enter to save · Esc to cancel"}
        </span>
      </div>
    </div>
  );
}
