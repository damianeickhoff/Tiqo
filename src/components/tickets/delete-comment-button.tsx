"use client";

import { Trash2 } from "lucide-react";
import { deleteComment } from "@/lib/actions/tickets";
import { ConfirmDelete } from "@/components/confirm-delete";
import { useMessages } from "@/components/shell/instance-context";

/** Icon-only, next to Edit — the pair reads as one set of owner controls. */
export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const t = useMessages();

  return (
    <ConfirmDelete
      title={t.ticket.deleteThisComment}
      blurb={t.ticket.deleteCommentBlurb}
      run={() => deleteComment(commentId)}
    >
      {(ask) => (
        <button
          type="button"
          onClick={ask}
          title={t.ticket.deleteThisComment}
          aria-label={t.ticket.deleteThisComment}
          className="border-negative/35 text-negative hover:bg-negative/10 rounded-control inline-flex items-center gap-1.5 border px-2.5 py-1 text-base font-medium transition-colors"
        >
          <Trash2 size={13} />
          {t.common.delete}
        </button>
      )}
    </ConfirmDelete>
  );
}
