"use client";

import { X } from "lucide-react";
import { deleteActivity } from "@/lib/actions/tickets";
import { ConfirmDelete } from "@/components/confirm-delete";
import { useMessages } from "@/components/shell/instance-context";

/**
 * Admin-only, and shown only on hover: the trail is a record, so removing an
 * entry should take a deliberate reach rather than sit under the cursor. It
 * asks first for the same reason — an entry taken out of a history leaves
 * nothing behind to say it was ever there.
 */
export function DeleteActivityButton({ activityId }: { activityId: string }) {
  const t = useMessages();

  return (
    <ConfirmDelete
      title={t.ticket.removeEntry}
      blurb={t.ticket.removeEntryBlurb}
      run={() => deleteActivity(activityId)}
    >
      {(ask) => (
        <button
          type="button"
          onClick={ask}
          title={t.ticket.removeEntry}
          aria-label={t.ticket.removeEntryLabel}
          className="text-text-3 hover:bg-negative/10 hover:text-negative ml-auto flex size-6 shrink-0 items-center justify-center self-center rounded-full opacity-0 transition-opacity group-hover/act:opacity-100 focus-visible:opacity-100"
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      )}
    </ConfirmDelete>
  );
}
