"use client";

import { useState, useTransition } from "react";
import { Check, OctagonX } from "lucide-react";
import { solveBlock } from "@/lib/actions/steps";
import { Button } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

/**
 * Why this step is stopped, on the step itself.
 *
 * It reads as the first thing said about the step because that is what it is —
 * and the button that ends it sits beside the sentence, so whoever clears the
 * block does not have to go and find the status control afterwards.
 */
export function BlockedNote({
  stepId,
  title,
  reason,
  canEdit,
}: {
  stepId: string;
  title: string;
  reason: string;
  canEdit: boolean;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="bg-p-urgent/[0.07] border-p-urgent/25 rounded-card flex flex-wrap items-start gap-x-3 gap-y-2 border px-4 py-3">
      <OctagonX size={15} className="text-p-urgent mt-0.5 shrink-0" />
      <p className="text-text-2 text-md min-w-0 flex-1">
        <span className="text-text font-semibold">{title}</span> {t.plan.isBlocked} {reason}
        {error ? <span className="text-negative mt-1 block text-sm">{error}</span> : null}
      </p>
      {canEdit ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await solveBlock(stepId);
              setError(result.ok ? null : (result.error ?? t.errors.generic));
            })
          }
        >
          <Check size={13} strokeWidth={2.5} />
          {t.plan.blockSolved}
        </Button>
      ) : null}
    </div>
  );
}
