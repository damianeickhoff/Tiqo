import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  can,
  canEditTicket,
  canViewTicket,
  canWriteInternalNote,
  isStaff,
} from "@/lib/permissions";
import { dateLocaleOf, getMessages, getSettings } from "@/lib/settings";
import { blockedBy, isStepSettled } from "@/lib/plan";
import { approvalGate } from "@/lib/approvals";
import { shortAge } from "@/lib/tickets";
import { Card, buttonClass } from "@/components/ui";
import { ConversationComposer, TicketActionsProvider } from "@/components/tickets/ticket-actions";
import {
  ConversationTimeline,
  threadComments,
  type TimelineItem,
} from "@/components/tickets/timeline";
import { StepControls } from "./step-controls";
import { StepDescription } from "./step-description";
import { ApprovalPrompt } from "@/components/tickets/approvals";
import { BlockedNote } from "@/components/tickets/blocked-note";

type Params = Promise<{ number: string; stepId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { stepId } = await params;
  const step = await prisma.changeStep.findUnique({
    where: { id: stepId },
    select: { title: true },
  });
  return { title: step ? step.title : (await getMessages()).plan.title };
}

/**
 * A step's own page — the place a note about *this part* of the change belongs,
 * rather than in the change's thread where it would be lost among the rest.
 *
 * The conversation is the ticket's, not a smaller relative of it: a step is a
 * unit of work, and people discuss one exactly as they discuss the change.
 */
export default async function StepPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { number, stepId } = await params;

  const step = await prisma.changeStep.findUnique({
    where: { id: stepId },
    select: {
      id: true,
      title: true,
      phase: true,
      phaseOrder: true,
      position: true,
      description: true,
      status: true,
      blockedReason: true,
      skipNeedsReason: true,
      skipReason: true,
      doneAt: true,
      dueAt: true,
      blocksPhase: true,
      dependsOnId: true,
      doneBy: { select: { name: true } },
      assignee: { select: { id: true, name: true, avatarVariant: true } },
      ticket: {
        select: {
          id: true,
          number: true,
          reference: true,
          title: true,
          reporterId: true,
          assigneeId: true,
        },
      },
    },
  });

  // The step is reached through its ticket, so the ticket's rules decide.
  if (!step || String(step.ticket.number) !== number) notFound();
  if (!canViewTicket(user, step.ticket)) notFound();

  const [settings, t] = await Promise.all([getSettings(), getMessages()]);
  const canEdit = canEditTicket(user);
  const staff = isStaff(user);

  const [comments, events, roster] = await Promise.all([
    // The same rule as the change's own thread: requesters never receive
    // internal notes, not even to hide them client-side.
    prisma.comment.findMany({
      where: { stepId: step.id, ...(staff ? {} : { isInternal: false }) },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        body: true,
        isInternal: true,
        createdAt: true,
        editedAt: true,
        pinnedAt: true,
        parentId: true,
        author: {
          select: {
            id: true,
            name: true,
            avatarVariant: true,
            role: { select: { isMaster: true } },
          },
        },
        reactions: { select: { emoji: true, userId: true } },
        attachments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            filename: true,
            mimeType: true,
            size: true,
            createdAt: true,
            uploadedById: true,
            uploadedBy: { select: { name: true } },
          },
        },
      },
    }),
    // This step's own history. COMMENTED is dropped for the same reason it is
    // on the ticket: the comment itself is already on the rail.
    prisma.activity.findMany({
      where: { stepId: step.id, type: { not: "COMMENTED" } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        field: true,
        oldValue: true,
        newValue: true,
        link: true,
        createdAt: true,
        actor: { select: { id: true, name: true, avatarVariant: true } },
      },
    }),
    // Forwarding from a step hands over the change it belongs to, so the list
    // is the ticket's: everyone but the person doing the forwarding.
    staff
      ? prisma.user.findMany({
          where: { isActive: true, id: { not: user.id } },
          orderBy: [{ role: { position: "desc" } }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            email: true,
            avatarVariant: true,
            role: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const timeline: TimelineItem[] = [
    ...threadComments(comments, user.id).map((comment) => ({
      kind: "comment" as const,
      ...comment,
    })),
    ...events.map((event) => ({ kind: "event" as const, ...event })),
    // Newest first: on a ticket that has been running a while, what matters is
    // what just happened, and reading it should not start with scrolling past
    // everything that already has. Replies inside a comment stay in the order
    // they were written — a thread is an argument, and an argument reads
    // forwards.
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const people = canEdit
    ? await prisma.user.findMany({
        where: {
          isActive: true,
          role: { OR: [{ isMaster: true }, { permissions: { has: "ticket.edit" } }] },
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const [siblings, approvals] = await Promise.all([
    prisma.changeStep.findMany({
      where: { ticketId: step.ticket.id },
      orderBy: [{ phaseOrder: "asc" }, { position: "asc" }],
      select: {
        id: true,
        title: true,
        phase: true,
        phaseOrder: true,
        position: true,
        status: true,
        blocksPhase: true,
        dependsOnId: true,
      },
    }),
    // The whole round, not only what it gates. A step nobody can move because
    // a decision is outstanding is exactly the page its approver ends up on,
    // and sending them somewhere else to answer costs another day.
    prisma.approval.findMany({
      where: { ticketId: step.ticket.id },
      orderBy: [{ state: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        phase: true,
        state: true,
        question: true,
        comment: true,
        dueAt: true,
        decidedAt: true,
        createdAt: true,
        requestedBy: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true, avatarVariant: true } },
      },
    }),
  ]);

  const block = blockedBy(step, siblings, approvalGate(approvals));
  const blocker = block ? siblings.find((row) => row.id === block.blocker) : null;

  return (
    <TicketActionsProvider
      ticketId={step.ticket.id}
      ticketNumber={step.ticket.number}
      ticketReference={step.ticket.reference}
      stepId={step.id}
      canEdit={canEdit}
      canNote={canWriteInternalNote(user)}
      viewerName={user.name}
      viewerAvatar={user.avatarVariant}
      recipients={roster}
    >
      <header className="bg-surface px-5 py-6 lg:px-8">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="animate-rise min-w-0 flex-1">
            <p className="text-text-3 flex flex-wrap items-center gap-2 text-base">
              <span className="bg-surface-3 text-text-2 rounded-control px-1.5 py-0.5 font-mono text-sm font-medium">
                {step.ticket.reference}
              </span>
              <span className="truncate">{step.ticket.title}</span>
              {step.phase ? (
                <span className="text-brand-deep rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-sm font-semibold">
                  {t.plan.inPhase(step.phase)}
                </span>
              ) : null}
            </p>

            <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl leading-tight font-extrabold tracking-[-0.025em]">
              {isStepSettled(step) ? <Check size={22} className="text-positive shrink-0" /> : null}
              {step.title}
            </h1>

            {block ? (
              <p className="text-text-2 mt-2 flex items-center gap-1.5 text-base">
                <Lock size={13} />
                {block.reason === "change"
                  ? t.plan.lockedByChange
                  : block.reason === "approval"
                    ? t.plan.lockedByApproval
                    : block.reason === "phase"
                      ? t.plan.lockedByPhase
                      : t.plan.lockedByStep(blocker?.title ?? "")}
              </p>
            ) : null}
          </div>

          <Link
            href={`/tickets/${step.ticket.number}/plan`}
            className={buttonClass("outline", "sm")}
          >
            <ArrowLeft size={13} />
            {t.plan.backToPlan}
          </Link>
        </div>
      </header>

      <div className="grid gap-5 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8">
        <div className="space-y-5">
          {/* Ahead of everything: a step nobody can move is the only thing
              worth reading about it until the block is gone. */}
          <ApprovalPrompt approvals={approvals} viewerId={user.id} />

          {step.status === "BLOCKED" && step.blockedReason ? (
            <BlockedNote
              stepId={step.id}
              title={step.title}
              reason={step.blockedReason}
              canEdit={canEdit}
            />
          ) : null}

          {/* The plan asked for this one to be justified, so the answer is read
              where the step is read and not only in the trail. */}
          {step.status === "SKIPPED" && step.skipReason ? (
            <p className="bg-surface-2 rounded-card text-text-2 text-md px-4 py-3">
              <span className="text-text font-semibold">{step.title}</span> {t.plan.wasSkipped}{" "}
              {step.skipReason}
            </p>
          ) : null}

          <Card className="animate-rise p-5">
            <StepDescription stepId={step.id} description={step.description} canEdit={canEdit} />
          </Card>

          <p className="label">{t.plan.conversation}</p>

          <ConversationTimeline
            items={timeline}
            ticketId={step.ticket.id}
            currentUserId={user.id}
            canDeleteAny={can(user, "comment.moderate")}
            locale={settings.locale}
            dateLocale={dateLocaleOf(settings)}
          />

          <ConversationComposer />
        </div>

        <Card className="animate-rise h-fit p-5">
          <StepControls
            stepId={step.id}
            status={step.status}
            block={block}
            assigneeId={step.assignee?.id ?? null}
            people={people}
            dueAt={step.dueAt}
            dependsOnId={step.dependsOnId}
            skipNeedsReason={step.skipNeedsReason}
            earlier={siblings
              .filter(
                (row) =>
                  row.id !== step.id &&
                  (row.phaseOrder < step.phaseOrder ||
                    (row.phaseOrder === step.phaseOrder && row.position < step.position)),
              )
              .map((row) => ({ id: row.id, title: row.title }))}
            canEdit={canEdit}
          />

          <dl className="border-border-soft text-md mt-4 space-y-3 border-t pt-4">
            {step.doneAt ? (
              <div>
                <dt className="label mb-1">{t.plan.done}</dt>
                <dd className="text-text-2">
                  {step.doneBy ? `${step.doneBy.name} · ` : ""}
                  {t.common.ago(shortAge(step.doneAt, undefined, t))}
                </dd>
              </div>
            ) : null}
          </dl>
        </Card>
      </div>
    </TicketActionsProvider>
  );
}
