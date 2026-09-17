"use client";

import { useState, useTransition } from "react";
import { Check, Stamp, X } from "lucide-react";
import type { ApprovalState } from "@/generated/prisma/enums";
import { respondToApproval } from "@/lib/actions/approvals";
import { isApprovalOverdue } from "@/lib/approvals";
import { RefuseDialog } from "@/components/tickets/approvals";
import { FieldError } from "@/components/ui";
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

/// The two buttons on a decision. Round-12 pills rather than the desk's
/// controls: this page is met by somebody who has never seen the desk.
const PILL =
  "inline-flex h-[42px] shrink-0 items-center gap-2 rounded-full px-[18px] text-[14px] " +
  "font-semibold transition-[box-shadow,background-color,color] duration-150 " +
  "disabled:pointer-events-none disabled:opacity-45";

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
    <div>
      {waiting.length === 0 ? (
        <p className="pcard text-text-3 px-6 py-14 text-center text-[14.5px]">
          {t.portal.approvalsEmpty}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {waiting.map((approval) => (
            // The brand down the edge, the way the front page marks the one
            // thing addressed to this person by name. A decision nobody has
            // taken is the same kind of thing.
            <li key={approval.id} className="pcard relative overflow-hidden pb-5">
              <span aria-hidden className="bg-brand absolute inset-y-0 left-0 w-1.5" />

              <div className="flex items-start gap-3.5 px-[26px] pt-[22px]">
                <span
                  aria-hidden
                  className="bg-brand text-brand-fg flex size-10 shrink-0 items-center justify-center rounded-full"
                >
                  <Stamp size={17} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-text-3 font-mono text-xs">
                    {t.portal.approvalAbout(approval.reference)}
                  </p>

                  <p className="mt-0.5 text-[17px] leading-[1.25] font-semibold tracking-[-0.015em]">
                    {approval.title}
                  </p>

                  <p className="text-text-3 mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px]">
                    <span>
                      {approval.phase
                        ? t.approvals.phaseGate(approval.phase)
                        : t.approvals.wholeTicket}
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
                          className={cn(
                            isApprovalOverdue(approval) && "text-negative font-semibold",
                          )}
                        >
                          {isApprovalOverdue(approval)
                            ? t.approvals.overdue
                            : t.approvals.dueOn(dateFormat.format(approval.dueAt))}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>

              {/* The change in its own words. Without it the question reads
                  "approve this reference", which is not a question. */}
              {approval.description ? (
                <div className="bg-surface-2 mx-[26px] mt-4 rounded-xl px-4 py-3.5">
                  <p className="label mb-2">{t.portal.approvalRequest}</p>
                  {/* Through the same renderer the desk reads it with. A
                      change written as a numbered list is a change whose steps
                      somebody is being asked to agree to, and showing it as
                      raw text with the marks still in it is showing them
                      something other than what was written. */}
                  <Markdown text={approval.description} className="text-[13.5px]" />
                </div>
              ) : null}

              {approval.question ? (
                <p className="mt-4 px-[26px] text-[14.5px] leading-snug">{approval.question}</p>
              ) : null}

              <div className="mt-4 px-[26px]">
                <FieldError>{errors[approval.id] || undefined}</FieldError>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 px-[26px]">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => answer(approval.id, true)}
                  className={cn(PILL, "bg-brand hover:bg-brand-hover text-[var(--brand-fg)]")}
                >
                  <Check size={15} strokeWidth={2.5} />
                  {t.approvals.approve}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setRefusing(approval.id)}
                  className={cn(
                    PILL,
                    "bg-surface text-text hover:bg-surface-2 border border-transparent font-medium shadow-[var(--highlight)]",
                  )}
                >
                  <X size={15} strokeWidth={2.5} />
                  {t.approvals.refuse}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* What they said, kept where they said it. An answer that vanishes the
          moment it is given leaves somebody wondering whether it landed. */}
      {answered.length > 0 ? (
        <section>
          <h2 className="mt-8 mb-3.5 text-[20px] font-semibold tracking-[-0.02em]">
            {t.portal.approvalsAnswered}
          </h2>
          <ul className="pcard">
            {answered.map((approval, index) => (
              <li
                key={approval.id}
                className={cn(
                  "flex items-center gap-3.5 px-[22px] py-3.5 text-[13.5px]",
                  index > 0 && "border-line border-t",
                )}
              >
                <span className="text-text-3 hidden shrink-0 font-mono text-xs sm:block">
                  {approval.reference}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{approval.title}</span>
                  {approval.comment ? (
                    <span className="text-text-3 mt-px block truncate text-[12.5px]">
                      “{approval.comment}”
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 font-semibold",
                    approval.state === "APPROVED" ? "text-positive" : "text-negative",
                  )}
                >
                  {approval.state === "APPROVED" ? (
                    <Check size={14} strokeWidth={3} />
                  ) : (
                    <X size={14} strokeWidth={3} />
                  )}
                  {approval.state === "APPROVED" ? t.approvals.answer.yes : t.approvals.answer.no}
                </span>
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
