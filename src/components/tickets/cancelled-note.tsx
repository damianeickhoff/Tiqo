import { Ban } from "lucide-react";
import { getMessages } from "@/lib/settings";
import { cn } from "@/lib/utils";

/**
 * A cancelled change says so, loudly, wherever it is read.
 *
 * The status pill already carries the word, but a pill is a label among other
 * labels — and "Cancelled" and "Closed" sit next to each other wearing the same
 * shape. A change that was refused did not run and then finish; the difference
 * matters enough to spend a band on, on both sides of the wall.
 */
export async function CancelledNote({
  refusedBy,
  reason,
  className,
}: {
  refusedBy?: string;
  reason?: string;
  /// The shape of the page it is standing on — see `ApprovalPrompt`.
  className?: string;
}) {
  const t = await getMessages();

  return (
    <div
      className={cn(
        "border-negative/35 bg-negative/[0.07] rounded-card flex items-start gap-3 border px-4 py-3.5",
        className,
      )}
    >
      <Ban size={18} className="text-negative mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-md font-semibold">
          {t.approvals.cancelled}
          {refusedBy ? (
            <span className="text-text-2"> · {t.approvals.cancelledBy(refusedBy)}</span>
          ) : null}
        </p>
        {reason ? <p className="text-text-2 mt-1 text-base leading-relaxed">{reason}</p> : null}
        <p className="text-text-3 mt-1 text-sm">{t.approvals.cancelledBlurb}</p>
      </div>
    </div>
  );
}
