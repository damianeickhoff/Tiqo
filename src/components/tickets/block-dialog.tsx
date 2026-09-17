"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { Button, Textarea } from "@/components/ui";
import { useMessages } from "@/components/shell/instance-context";

/**
 * The one question worth interrupting somebody for.
 *
 * Blocking a step is the only state change on a plan that stops other people,
 * so it is the only one that asks for a sentence first. Everything else moves
 * on a single click; this one buys the reason that makes the block actionable.
 */
export function BlockDialog({
  pending,
  skipping = false,
  onClose,
  onConfirm,
}: {
  pending: boolean;
  /// The other sentence worth interrupting for: a step the plan said could not
  /// be dropped quietly. Same question, same box, different words.
  skipping?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const t = useMessages();
  const [reason, setReason] = useState("");

  return (
    <Modal
      title={skipping ? t.plan.whySkipped : t.plan.whyBlocked}
      description={skipping ? t.plan.whySkippedHint : t.plan.whyBlockedHint}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!reason.trim()) return;
          onConfirm(reason);
        }}
      >
        <label className="block">
          <span className="label mb-1.5 block">
            {skipping ? t.plan.whySkippedLabel : t.plan.whyBlockedLabel}
          </span>
          <Textarea
            autoFocus
            rows={3}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>

        <div className="border-line mt-4 flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" disabled={pending || !reason.trim()}>
            {skipping ? t.plan.markSkipped : t.plan.markBlocked}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
