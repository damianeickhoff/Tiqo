"use client";

import { useState, useTransition } from "react";
import { Check, Minus, Plus, RotateCcw, Stamp, X } from "lucide-react";
import type { ApprovalState } from "@/generated/prisma/enums";
import {
  askAgain,
  cancelApproval,
  requestApproval,
  respondToApproval,
} from "@/lib/actions/approvals";
import { isApprovalOverdue } from "@/lib/approvals";
import { Avatar } from "@/components/avatar";
import { Modal } from "@/components/modal";
import { PanelCard } from "@/components/tickets/panel-card";
import { Button, FieldError, FormError, Input, Select, Textarea } from "@/components/ui";
import { useDateFormat, useMessages } from "@/components/shell/instance-context";
import { cn } from "@/lib/utils";

/** A decision as both halves of the ticket page need it: what was asked, who
 *  was asked, and what they said. */
export type ApprovalView = {
  id: string;
  phase: string | null;
  state: ApprovalState;
  question: string | null;
  comment: string | null;
  dueAt: Date | null;
  /// When it was answered, withdrawn or superseded. Shown on every decided
  /// round: "approved" with no date is a fact nobody can place in a week that
  /// had three versions of the same change in it.
  decidedAt: Date | null;
  approver: { id: string; name: string; avatarVariant: number } | null;
  requestedBy: { id: string; name: string } | null;
};

export type Approver = { id: string; name: string; avatarVariant: number };

const STATE_TONE: Record<ApprovalState, string> = {
  PENDING: "border-transparent bg-surface-2 text-text-2",
  APPROVED:
    "border-[color-mix(in_oklab,var(--positive)_45%,transparent)] bg-positive/10 text-positive",
  REJECTED:
    "border-[color-mix(in_oklab,var(--negative)_45%,transparent)] bg-negative/10 text-negative",
  CANCELLED: "border-line-strong bg-surface text-text-3",
};

/** The state of a round, wherever one is listed. Exported for the desk queue,
 *  which lists rounds from every ticket and must not draw them differently. */
export function StatePill({ state }: { state: ApprovalState }) {
  const t = useMessages();
  return (
    <span
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center rounded-full border px-1.5 text-xs font-medium",
        STATE_TONE[state],
      )}
    >
      {t.approvals.state[state]}
    </span>
  );
}

/** What the decision is holding up: one phase of the plan, or all of it. */
function gateLabel(approval: { phase: string | null }, t: ReturnType<typeof useMessages>) {
  return approval.phase ? t.approvals.phaseGate(approval.phase) : t.approvals.wholeTicket;
}

/* -------------------------------------------------------------- the card -- */

/**
 * Every decision this ticket has waited on, in the rail.
 *
 * One name per request, with what they said beside it. Asking somebody else
 * withdraws the question standing now rather than adding a second, so the card
 * reads as a history of decisions rather than a pile of open questions.
 */
export function ApprovalsCard({
  ticketId,
  approvals,
  viewerId,
  phases,
  people,
  canRequest,
  canManage,
  isChange,
}: {
  ticketId: string;
  approvals: ApprovalView[];
  viewerId: string;
  /// The phases this ticket's plan actually has, in the order it works them.
  phases: string[];
  people: Approver[];
  canRequest: boolean;
  /// Whoever may change the ticket may also take a question back down: the
  /// gate is holding up their work.
  canManage: boolean;
  /// Whether a whole-ticket refusal cancelled anything. Only a change is
  /// cancelled by one, so only a change has anything to revive.
  isChange: boolean;
}) {
  const t = useMessages();
  const dateFormat = useDateFormat({ day: "numeric", month: "short" });
  const [, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  /// The refused round being asked again, or null for a fresh question. The
  /// same dialog does both: it is the same form, filled in.
  const [again, setAgain] = useState<ApprovalView | null>(null);
  /// Per round rather than one slot for the card: a list with a single error
  /// line puts the refusal from one row under a different one.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  return (
    <PanelCard
      title={t.approvals.title}
      action={
        canRequest ? (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="text-brand-deep flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
          >
            <Plus size={12} strokeWidth={2.5} />
            {t.approvals.ask}
          </button>
        ) : undefined
      }
    >
      {approvals.length === 0 ? (
        <p className="text-text-3 px-3.5 py-3 text-base">{t.approvals.empty}</p>
      ) : (
        <ul className="divide-line divide-y">
          {approvals.map((approval) => {
            const late = isApprovalOverdue(approval);
            const mine = approval.requestedBy?.id === viewerId;

            return (
              <li key={approval.id} className="px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatePill state={approval.state} />
                  <span className="text-md min-w-0 flex-1 truncate font-semibold">
                    {gateLabel(approval, t)}
                  </span>
                  {approval.dueAt ? (
                    <span
                      className={cn(
                        "shrink-0 font-mono text-xs",
                        late ? "text-negative font-semibold" : "text-text-3",
                      )}
                    >
                      {late
                        ? t.approvals.overdue
                        : t.approvals.dueOn(dateFormat.format(approval.dueAt))}
                    </span>
                  ) : null}
                </div>

                {/* Only where somebody wrote one. The headline above already
                    says what is held; an apology for a missing sentence is not
                    worth a line of the rail. */}
                {approval.question ? (
                  <p className="text-text-2 mt-1.5 text-base leading-snug">{approval.question}</p>
                ) : null}

                {approval.approver ? (
                  <div className="mt-2 flex items-center gap-2">
                    <Avatar
                      name={approval.approver.name}
                      variant={approval.approver.avatarVariant}
                      size={20}
                    />
                    <span className="min-w-0 flex-1 truncate text-base">
                      {approval.approver.name}
                    </span>
                    <AnswerMark state={approval.state} />
                  </div>
                ) : null}

                {/* The sentence beside the answer, not behind it: a refusal
                    nobody can read is the reason the same change comes back. */}
                {approval.comment ? (
                  <p className="text-text-2 border-line mt-1.5 ml-2.5 border-l-2 pl-2.5 text-sm leading-snug">
                    {approval.comment}
                  </p>
                ) : null}

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-text-3 min-w-0 flex-1 truncate text-xs">
                    {[
                      approval.requestedBy ? t.approvals.askedBy(approval.requestedBy.name) : null,
                      // On every decided round, not only the granted ones: the
                      // question a card answers is "when did this stop waiting".
                      approval.state !== "PENDING" && approval.decidedAt
                        ? t.approvals.decidedOn(dateFormat.format(approval.decidedAt))
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {approval.state === "REJECTED" && canRequest ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAgain(approval)}
                    >
                      <RotateCcw size={12} />
                      {t.approvals.askAgain}
                    </Button>
                  ) : null}
                  {approval.state === "PENDING" && (mine || canManage) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={withdrawing === approval.id}
                      onClick={() => {
                        setWithdrawing(approval.id);
                        startTransition(async () => {
                          const result = await cancelApproval(approval.id);
                          setWithdrawing(null);
                          setErrors((current) => ({
                            ...current,
                            [approval.id]: result.ok ? "" : (result.error ?? t.errors.generic),
                          }));
                        });
                      }}
                    >
                      {t.approvals.withdraw}
                    </Button>
                  ) : null}
                </div>

                <FieldError>{errors[approval.id] || undefined}</FieldError>
              </li>
            );
          })}
        </ul>
      )}

      {asking ? (
        <AskDialog
          ticketId={ticketId}
          phases={phases}
          people={people}
          onClose={() => setAsking(false)}
        />
      ) : null}

      {again ? (
        <AskDialog
          ticketId={ticketId}
          phases={phases}
          people={people}
          again={again}
          revives={isChange && again.phase === null}
          onClose={() => setAgain(null)}
        />
      ) : null}
    </PanelCard>
  );
}

/** Yes, no, or nothing yet — the third being the one the card exists to show. */
function AnswerMark({ state }: { state: ApprovalState }) {
  const t = useMessages();

  const [label, tone, glyph] =
    state === "APPROVED"
      ? [t.approvals.answer.yes, "text-positive", <Check key="y" size={12} strokeWidth={3} />]
      : state === "REJECTED"
        ? [t.approvals.answer.no, "text-negative", <X key="n" size={12} strokeWidth={3} />]
        : [t.approvals.answer.waiting, "text-text-3", <Minus key="w" size={12} strokeWidth={3} />];

  return (
    <span className={cn("flex shrink-0 items-center gap-1 text-xs font-medium", tone)}>
      {glyph}
      {label}
    </span>
  );
}

/* ------------------------------------------------------------ the asking -- */

/**
 * Asking is a form, so it is a draft until it is sent: nothing is written while
 * somebody is still deciding who to put on it.
 */
function AskDialog({
  ticketId,
  phases,
  people,
  again = null,
  revives = false,
  onClose,
}: {
  ticketId: string;
  phases: string[];
  people: Approver[];
  /// The refused round this is a second asking of, if it is one. Its question
  /// and its gate are what the form comes up filled in with.
  again?: ApprovalView | null;
  /// Whether sending this will also take the change out of Cancelled. Said in
  /// the dialog, because it is a larger thing than asking a question.
  revives?: boolean;
  onClose: () => void;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [phase, setPhase] = useState(again?.phase ?? "");
  const [question, setQuestion] = useState(again?.question ?? "");
  const [dueAt, setDueAt] = useState("");
  const [approverId, setApproverId] = useState("");

  return (
    <Modal
      title={again ? t.approvals.askAgain : t.approvals.ask}
      description={again ? t.approvals.askAgainBlurb : t.approvals.askBlurb}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const input = {
              phase,
              question,
              dueAt: dueAt ? new Date(`${dueAt}T17:00:00`) : null,
              approverId,
            };
            const result = again
              ? await askAgain(again.id, input)
              : await requestApproval(ticketId, input);
            if (result.ok) onClose();
            else setErrors(result.errors);
          });
        }}
      >
        <FormError>{errors.form}</FormError>

        {/* Said before it happens: reviving a cancelled change puts work back on
            the board, which is more than asking a question. */}
        {revives ? (
          <p className="callout-brand px-3.5 py-2.5 text-base">{t.approvals.askAgainRevives}</p>
        ) : null}

        <label className="block">
          <span className="label mb-1.5 block">{t.approvals.question}</span>
          <Textarea
            autoFocus
            rows={3}
            value={question}
            maxLength={1000}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <span className="text-text-3 mt-1 block text-sm">{t.approvals.questionHint}</span>
          <FieldError>{errors.question}</FieldError>
        </label>

        <label className="block">
          <span className="label mb-1.5 block">{t.approvals.approver}</span>
          <Select value={approverId} onChange={(event) => setApproverId(event.target.value)}>
            <option value="">{t.common.none}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
          <span className="text-text-3 mt-1 block text-sm">{t.approvals.approverHint}</span>
          <FieldError>{errors.approverId}</FieldError>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label mb-1.5 block">{t.approvals.gate}</span>
            <Select value={phase} onChange={(event) => setPhase(event.target.value)}>
              <option value="">{t.approvals.wholeTicket}</option>
              {phases.map((name) => (
                <option key={name} value={name}>
                  {t.approvals.phaseGate(name)}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="label mb-1.5 block">{t.approvals.dueBy}</span>
            <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          {/* Both halves, because both are now required: a request with no
              question is a label somebody has to guess the meaning of. */}
          <Button type="submit" disabled={pending || !approverId || !question.trim()}>
            {pending ? t.common.saving : t.approvals.send}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------- the answering -- */

/**
 * Being asked, at the top of the ticket.
 *
 * For the person holding the decision this is the most important thing on the
 * page, so it sits above the request rather than in the rail with everything
 * else about the ticket. Nobody else sees it at all.
 */
export function ApprovalPrompt({
  approvals,
  viewerId,
  className,
}: {
  approvals: ApprovalView[];
  viewerId: string;
  /// The shape of the page it is standing on. The desk's callouts are card
  /// sized; the portal's are a step larger, and a prompt that keeps the desk's
  /// radius in a column of portal cards reads as something pasted in.
  className?: string;
}) {
  const t = useMessages();
  const dateFormat = useDateFormat({ day: "numeric", month: "short" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [refusing, setRefusing] = useState<string | null>(null);

  const mine = approvals.filter(
    (approval) => approval.state === "PENDING" && approval.approver?.id === viewerId,
  );
  if (mine.length === 0) return null;

  function answer(approvalId: string, approved: boolean, comment = "") {
    startTransition(async () => {
      const result = await respondToApproval(approvalId, approved, comment);
      setError(result.ok ? null : (result.error ?? t.errors.generic));
    });
  }

  return (
    <div className="space-y-3">
      {mine.map((approval) => (
        <div key={approval.id} className={cn("callout-brand p-4", className)}>
          <p className="text-brand-deep flex items-center gap-2 text-sm font-semibold">
            <Stamp size={14} />
            {t.approvals.yourTurn}
          </p>

          {/* What was asked, or — for a sign-off a plan laid down with no
              sentence on it — what it holds up, which is then not repeated
              underneath. */}
          <p className="text-md mt-2 leading-snug">{approval.question ?? gateLabel(approval, t)}</p>

          <p className="text-text-2 mt-1 flex flex-wrap items-center gap-x-1.5 text-sm">
            {approval.question ? <span>{gateLabel(approval, t)}</span> : null}
            {approval.dueAt ? (
              <>
                {approval.question ? <span aria-hidden>·</span> : null}
                <span className={isApprovalOverdue(approval) ? "text-negative font-semibold" : ""}>
                  {isApprovalOverdue(approval)
                    ? t.approvals.overdue
                    : t.approvals.dueOn(dateFormat.format(approval.dueAt))}
                </span>
              </>
            ) : null}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" disabled={pending} onClick={() => answer(approval.id, true)}>
              <Check size={14} strokeWidth={2.5} />
              {t.approvals.approve}
            </Button>
            {/* A refusal cancels the change and has to carry a sentence, so it
                asks before it is sent. */}
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

          {error ? (
            <p role="alert" className="text-negative mt-2 text-sm font-medium">
              {error}
            </p>
          ) : null}
        </div>
      ))}

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

/**
 * The same shape as the block dialog, and for the same reason: the answer and
 * the sentence that explains it are one decision. It says what a refusal costs,
 * because refusing cancels the change rather than merely ending the question.
 *
 * Exported because the portal asks the same thing of the same people, and a
 * second copy of it is a second wording to keep in step.
 */
export function RefuseDialog({
  pending,
  onClose,
  onConfirm,
}: {
  pending: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
}) {
  const t = useMessages();
  const [comment, setComment] = useState("");

  return (
    <Modal title={t.approvals.refuseTitle} description={t.approvals.refuseBlurb} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!comment.trim()) return;
          onConfirm(comment);
        }}
      >
        <label className="block">
          <span className="label mb-1.5 block">{t.approvals.refuseLabel}</span>
          <Textarea
            autoFocus
            rows={3}
            value={comment}
            maxLength={1000}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>

        <div className="mt-4 flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="danger" disabled={pending || !comment.trim()}>
            {t.approvals.refuse}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
