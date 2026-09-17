"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { setStepDescription } from "@/lib/actions/steps";
import { Button, Textarea } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

/** What the step involves. Comes from the plan, and the change may know better
 *  by the time anyone does it — so it is editable here. */
export function StepDescription({
  stepId,
  description,
  canEdit,
}: {
  stepId: string;
  description: string | null;
  canEdit: boolean;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description ?? "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    startTransition(async () => {
      const result = await setStepDescription(stepId, draft);
      if (result.ok) {
        setEditing(false);
        setError(null);
      } else {
        setError(result.error ?? t.errors.generic);
      }
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="label">{t.plan.description}</p>
        {canEdit && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-text-3 hover:text-text flex items-center gap-1 text-sm font-medium transition-colors"
          >
            <Pencil size={12} />
            {t.common.edit}
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            rows={5}
            autoFocus
            maxLength={4000}
            placeholder={t.plan.descriptionHint}
            aria-label={t.plan.description}
            onChange={(event) => setDraft(event.target.value)}
          />
          {error ? <p className="text-negative text-sm font-medium">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(description ?? "");
                setEditing(false);
              }}
            >
              <X size={14} />
              {t.common.cancel}
            </Button>
            <Button type="button" size="sm" disabled={pending} onClick={save}>
              <Check size={14} strokeWidth={2.5} />
              {pending ? t.common.saving : t.common.save}
            </Button>
          </div>
        </div>
      ) : description ? (
        <p className="text-md leading-relaxed whitespace-pre-wrap">{description}</p>
      ) : (
        <p className="text-text-3 text-md">{t.plan.noDescription}</p>
      )}
    </div>
  );
}
