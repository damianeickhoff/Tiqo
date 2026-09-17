import Link from "next/link";
import { Stamp } from "lucide-react";
import type { ApprovalState } from "@/generated/prisma/enums";
import { dateLocaleOf, getMessages, getSettings } from "@/lib/settings";
import { isApprovalOverdue } from "@/lib/approvals";
import { EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

export type WaitingApproval = {
  id: string;
  state: ApprovalState;
  phase: string | null;
  question: string | null;
  dueAt: Date | null;
  ticket: { number: number; reference: string; title: string };
};

/**
 * What is waiting on this person's answer.
 *
 * Without it the feature depends on somebody reading their notifications, and
 * a gate that is only discoverable through a bell is one the desk will blame
 * for being slow. Overdue first, undated last — the order the answers are
 * wanted in, not the order they were asked in.
 */
export async function WaitingApprovals({ approvals }: { approvals: WaitingApproval[] }) {
  const [t, settings] = await Promise.all([getMessages(), getSettings()]);

  if (approvals.length === 0) {
    return (
      <div className="px-5 pb-5">
        <EmptyState title={t.dashboard.approvalsEmpty} body="" />
      </div>
    );
  }

  const dateFormat = new Intl.DateTimeFormat(dateLocaleOf(settings), {
    day: "numeric",
    month: "short",
  });
  return (
    <ul className="divide-line divide-y">
      {approvals.map((approval) => {
        const late = isApprovalOverdue(approval);

        return (
          <li key={approval.id}>
            <Link
              href={`/tickets/${approval.ticket.number}`}
              className="hover:bg-surface-2 flex items-start gap-2.5 px-4 py-2.5 transition-colors"
            >
              <Stamp size={14} className="text-text-3 mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="text-text-3 shrink-0 font-mono text-xs">
                    {approval.ticket.reference}
                  </span>
                  <span className="min-w-0 truncate text-base font-medium">
                    {approval.ticket.title}
                  </span>
                </span>
                {/* What is actually being asked, where there is room for it;
                    the phase alone is not something anybody can answer. */}
                <span className="text-text-2 mt-0.5 block truncate text-sm">
                  {approval.question ??
                    (approval.phase
                      ? t.approvals.phaseGate(approval.phase)
                      : t.approvals.wholeTicket)}
                </span>
              </span>
              {approval.dueAt ? (
                <span
                  className={cn(
                    "tnum mt-0.5 shrink-0 font-mono text-xs",
                    late ? "text-negative font-semibold" : "text-text-3",
                  )}
                >
                  {late ? t.approvals.overdue : dateFormat.format(approval.dueAt)}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
