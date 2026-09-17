"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import type { ApprovalState } from "@/generated/prisma/enums";
import { respondToApproval } from "@/lib/actions/approvals";
import { isApprovalOverdue } from "@/lib/approvals";
import { RefuseDialog } from "@/components/tickets/approvals";
import { Button, FieldError } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { useDateFormat, useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/** One question, as the person answering it needs it: what is being asked, what
 *  the change actually is, and two buttons. */
export type PortalApproval = {
  id: string;
  phase: string | null;
  question: string | null;
  comment: string | null;
  dueAt: Date | null;
  state: ApprovalState;
  askedBy: string | null;
  reference: string;
  title: string;
  /// What the change says of itself. Somebody asked to approve a thing has to
  /// be able to read the thing.
  description: string;
};

/**
 * Approving from the portal.
 *
 * A requester asked to sign something off has nowhere to do it on the desk —
 * they cannot get in. So the question comes to them with the change attached:
 * the reference, the title and what was actually asked for, because "approve
 * CHG-2609 0005" is not something anybody can answer honestly.
 *
 * The conversation stays on the desk. Being asked to approve a change does not
 * make its replies and internal notes yours to read.
 */
export function PortalApprovals({ approvals }: { approvals: PortalApproval[] }) {
  const t = useMessages();
  const dateFormat = useDateFormat({ day: "numeric", month: "short" });
  const [pending, startTransition] = useTransition();
  /// Per question, not per page: a list with one error slot puts the refusal
  /// from the third card under the first one.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refusing, setRefusing] = useState<string | null>(null);

  const waiting = approvals.filter((row) => row.state === "PENDING");
  const answered = approvals.filter((row) => row.state === "APPROVED" || row.state === "REJECTED");

  function answer(approvalId: string, approved: boolean, comment = "") {
    startTransition(async () => {
      const result = await respondToApproval(approvalId, approved, comment);
      setErrors((current) => ({
        ...current,
        [approvalId]: result.ok ? "" : (result.error ?? t.errors.generic),
      }));
    });
  }

  return (
    <div className="space-y-6">
      {waiting.length === 0 ? (
        <p className="border-line text-text-3 rounded-card text-md border border-dashed px-4 py-10 text-center">
          {t.portal.approvalsEmpty}
        </p>
      ) : (
        <ul className="space-y-3">
          {waiting.map((approval) => (
            <li key={approval.id} className="callout-brand p-4">
              <p className="text-text-3 font-mono text-xs">
                {t.portal.approvalAbout(approval.reference)}
              </p>

              <p className="text-md mt-1.5 leading-snug font-semibold">{approval.title}</p>

              <p className="text-text-2 mt-1 flex flex-wrap items-center gap-x-1.5 text-sm">
                <span>
                  {approval.phase ? t.approvals.phaseGate(approval.phase) : t.approvals.wholeTicket}
                </span>
                {approval.askedBy ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{t.approvals.askedBy(approval.askedBy)}</span>
                  </>
                ) : null}
                {approval.dueAt ? (
                  <>
                    <span aria-hidden>·</span>
                    <span
                      className={cn(isApprovalOverdue(approval) && "text-negative font-semibold")}
                    >
                      {isApprovalOverdue(approval)
                        ? t.approvals.overdue
                        : t.approvals.dueOn(dateFormat.format(approval.dueAt))}
                    </span>
                  </>
                ) : null}
              </p>

              {/* The change in its own words. Without it the question reads
                  "approve this reference", which is not a question. */}
              {approval.description ? (
                <div className="border-line bg-surface rounded-control mt-3 border px-3 py-2.5">
                  <p className="label mb-1">{t.portal.approvalRequest}</p>
                  {/* Through the same renderer the desk reads it with. A
                      change written as a numbered list is a change whose steps
                      somebody is being asked to agree to, and showing it as
                      raw text with the marks still in it is showing them
                      something other than what was written. */}
                  <Markdown text={approval.description} className="text-base" />
                </div>
              ) : null}

              {approval.question ? (
                <p className="text-md mt-3 leading-snug font-medium">{approval.question}</p>
              ) : null}

              <FieldError>{errors[approval.id] || undefined}</FieldError>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" disabled={pending} onClick={() => answer(approval.id, true)}>
                  <Check size={14} strokeWidth={2.5} />
                  {t.approvals.approve}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={pending}
                  onClick={() => setRefusing(approval.id)}
                >
                  <X size={14} strokeWidth={2.5} />
                  {t.approvals.refuse}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* What they said, kept where they said it. An answer that vanishes the
          moment it is given leaves somebody wondering whether it landed. */}
      {answered.length > 0 ? (
        <section>
          <h2 className="label mb-2">{t.portal.approvalsAnswered}</h2>
          <ul className="card divide-line divide-y">
            {answered.map((approval) => (
              <li key={approval.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-text-3 font-mono text-xs">{approval.reference}</span>
                  <span className="min-w-0 flex-1 truncate text-base">{approval.title}</span>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 text-xs font-medium",
                      approval.state === "APPROVED" ? "text-positive" : "text-negative",
                    )}
                  >
                    {approval.state === "APPROVED" ? (
                      <Check size={12} strokeWidth={3} />
                    ) : (
                      <X size={12} strokeWidth={3} />
                    )}
                    {approval.state === "APPROVED" ? t.approvals.answer.yes : t.approvals.answer.no}
                  </span>
                </div>
                {approval.comment ? (
                  <p className="text-text-2 border-line mt-1.5 border-l-2 pl-2.5 text-sm leading-snug">
                    {approval.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {refusing ? (
        <RefuseDialog
          pending={pending}
          onClose={() => setRefusing(null)}
          onConfirm={(comment) => {
            const id = refusing;
            setRefusing(null);
            answer(id, false, comment);
          }}
        />
      ) : null}
    </div>
  );
}
