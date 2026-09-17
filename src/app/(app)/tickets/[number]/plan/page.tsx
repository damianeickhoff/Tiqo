import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canEditTicket, canViewTicket, isStaff } from "@/lib/permissions";
import { getMessages, getSettings, dateLocaleOf } from "@/lib/settings";
import { isStepOverdue, isStepSettled, planOrder, planProgress } from "@/lib/plan";
import { approvalGate } from "@/lib/approvals";
import { Avatar } from "@/components/avatar";
import { PriorityBars, StatusRing } from "@/components/tickets/glyphs";
import { Reference } from "@/components/tickets/ticket-row";
import { PlanBoard } from "@/components/tickets/plan-board";
import { ApprovalPrompt } from "@/components/tickets/approvals";
import { buttonClass } from "@/components/ui";

type Params = Promise<{ number: string }>;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).plan.title };
}

/** The plan, given the room it needs. The ticket keeps a summary and a way in. */
export default async function PlanPage({ params }: { params: Params }) {
  const user = await requireUser();
  const number = Number.parseInt((await params).number, 10);
  if (!Number.isSafeInteger(number)) notFound();

  const ticket = await prisma.ticket.findUnique({
    where: { number },
    select: {
      id: true,
      number: true,
      reference: true,
      title: true,
      type: true,
      priority: true,
      reporterId: true,
      assigneeId: true,
      status: { select: { id: true, name: true, color: true, settles: true } },
    },
  });

  if (!ticket || ticket.type !== "CHANGE") notFound();
  if (!canViewTicket(user, ticket)) notFound();

  const staff = isStaff(user);

  const [steps, approvals, people, templates, applied, settings, t] = await Promise.all([
    prisma.changeStep.findMany({
      where: { ticketId: ticket.id },
      orderBy: [{ phaseOrder: "asc" }, { position: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        position: true,
        phase: true,
        phaseOrder: true,
        status: true,
        blockedReason: true,
        skipReason: true,
        skipNeedsReason: true,
        dueAt: true,
        estimateMinutes: true,
        blocksPhase: true,
        dependsOnId: true,
        assignee: { select: { id: true, name: true, avatarVariant: true } },
        team: { select: { id: true, name: true, color: true } },
        _count: { select: { comments: true } },
      },
    }),
    // The whole round, not only what it gates: this page can be the one
    // somebody is standing on when their name comes up, and a decision they
    // have to go somewhere else to make is one that waits another day.
    prisma.approval.findMany({
      where: { ticketId: ticket.id },
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
    staff
      ? prisma.user.findMany({
          where: {
            isActive: true,
            role: { OR: [{ isMaster: true }, { permissions: { has: "ticket.edit" } }] },
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true, avatarVariant: true },
        })
      : Promise.resolve([]),
    staff
      ? prisma.changeTemplate.findMany({
          where: { steps: { some: {} } },
          orderBy: { position: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    // Which template the plan came from, and who applied it — the trail
    // remembers, so the page can say so without a column of its own.
    prisma.activity.findFirst({
      where: { ticketId: ticket.id, type: "PLAN_APPLIED" },
      orderBy: { createdAt: "desc" },
      select: { newValue: true, createdAt: true, actor: { select: { name: true } } },
    }),
    getSettings(),
    getMessages(),
  ]);

  const board = steps.map((step) => ({
    ...step,
    comments: step._count.comments,
    overdue: isStepOverdue(step),
  }));
  const ordered = planOrder(board);
  const { settled, total, pct } = planProgress(board);

  // The right-hand column, worked out here: per-phase progress, the steps
  // past their date, and who holds how much of the plan.
  const phases: { name: string | null; done: number; total: number; overdue: number }[] = [];
  for (const step of ordered) {
    const last = phases.at(-1);
    const row =
      last && last.name === step.phase
        ? last
        : (phases.push({ name: step.phase, done: 0, total: 0, overdue: 0 }), phases.at(-1)!);
    row.total += 1;
    if (isStepSettled(step)) row.done += 1;
    if (step.overdue) row.overdue += 1;
  }
  const overdue = ordered.filter((step) => step.overdue);
  // Steps somebody has said they cannot get past. Unlike the gates, the plan
  // cannot clear these for itself — they are here because they need a person.
  const stuck = ordered.filter((step) => step.status === "BLOCKED");
  const owners = new Map<string, { name: string; avatarVariant: number; count: number }>();
  for (const step of ordered) {
    if (!step.assignee || isStepSettled(step)) continue;
    const entry = owners.get(step.assignee.id) ?? { ...step.assignee, count: 0 };
    entry.count += 1;
    owners.set(step.assignee.id, entry);
  }
  const dateFormat = new Intl.DateTimeFormat(dateLocaleOf(settings), {
    day: "numeric",
    month: "short",
  });

  return (
    <>
      <header className="px-5 pt-5 pb-4 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          <Reference reference={ticket.reference} />
          <PriorityBars priority={ticket.priority} title={t.vocab.priority[ticket.priority]} />
          <span className="text-text-2 flex items-center gap-1.5 text-sm">
            <StatusRing status={ticket.status} />
            {ticket.status?.name ?? t.tickets.noStatus}
          </span>
          <span aria-hidden className="text-text-3">
            ·
          </span>
          <span className="text-text-3 text-sm">{t.plan.title}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl leading-tight font-semibold tracking-[-0.02em] text-balance">
              {ticket.title}
            </h1>
            <p className="text-text-3 mt-1 text-sm">
              {applied?.newValue ? `${t.plan.fromTemplate(applied.newValue)} · ` : null}
              {t.plan.progress(settled, total)}
            </p>
          </div>
          <Link href={`/tickets/${ticket.number}`} className={buttonClass("outline", "sm")}>
            <ArrowLeft size={13} />
            {t.plan.backToChange}
          </Link>
        </div>
      </header>

      <div className="px-5 py-5 lg:px-8 xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-6">
        <div className="min-w-0 space-y-4">
          <ApprovalPrompt approvals={approvals} viewerId={user.id} />

          <PlanBoard
            ticketId={ticket.id}
            ticketNumber={ticket.number}
            steps={board}
            people={people}
            templates={templates}
            canEdit={canEditTicket(user)}
            gate={approvalGate(approvals)}
          />
        </div>

        {total > 0 ? (
          <aside className="mt-6 space-y-4 xl:mt-0">
            <div className="card p-4">
              <div className="flex items-baseline justify-between">
                <span className="label">{t.plan.progressTitle}</span>
                <span className="text-text-3 font-mono text-xs">
                  {t.plan.progress(settled, total)}
                </span>
              </div>
              <p className="tnum mt-2 text-2xl leading-none font-semibold tracking-[-0.03em]">
                {pct}%
              </p>
              <div className="mt-4 space-y-2">
                {phases.map((phase, index) => (
                  <div
                    key={`${phase.name ?? "none"}-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_96px_32px] items-center gap-2.5 text-sm"
                  >
                    <span className="text-text-2 truncate">{phase.name ?? t.plan.noPhase}</span>
                    <span className="bg-surface-3 relative h-1.5 overflow-hidden rounded-full">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${(phase.done / phase.total) * 100}%`,
                          background:
                            phase.done === phase.total ? "var(--positive)" : "var(--brand)",
                        }}
                      />
                      {phase.overdue > 0 ? (
                        <span
                          className="absolute inset-y-0 rounded-full"
                          style={{
                            left: `${(phase.done / phase.total) * 100}%`,
                            width: `${(phase.overdue / phase.total) * 100}%`,
                            background: "var(--negative)",
                          }}
                        />
                      ) : null}
                    </span>
                    <span className="text-text-3 text-right font-mono text-xs">
                      {phase.done}/{phase.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {stuck.length > 0 ? (
              <div className="card p-4">
                <span className="label flex items-center gap-2">
                  <span aria-hidden className="bg-p-urgent size-1.5 rounded-full" />
                  {t.plan.needsDecision}
                </span>
                <p className="text-text-3 mt-1 text-xs">{t.plan.needsDecisionHint}</p>
                <ul className="mt-2 space-y-2">
                  {stuck.map((step) => (
                    <li key={step.id} className="text-sm">
                      {/* The whole sentence, not just the name: a card that
                          says which step is stuck but not why sends the reader
                          off to find out. */}
                      <Link
                        href={`/tickets/${ticket.number}/steps/${step.id}`}
                        className="hover:text-brand-deep block"
                      >
                        <span className="font-semibold">{step.title}</span>{" "}
                        <span className="text-text-2">
                          {t.plan.isBlocked} {step.blockedReason ?? ""}
                        </span>
                      </Link>
                      {step.assignee ? (
                        <span className="text-text-3 flex items-center gap-1.5 text-xs">
                          <Avatar
                            name={step.assignee.name}
                            variant={step.assignee.avatarVariant}
                            size={16}
                          />
                          {step.assignee.name}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {overdue.length > 0 ? (
              <div className="card p-4">
                <span className="label">{t.plan.overdueSteps}</span>
                <ul className="mt-2 space-y-2">
                  {overdue.map((step) => (
                    <li key={step.id} className="text-sm">
                      <Link
                        href={`/tickets/${ticket.number}/steps/${step.id}`}
                        className="hover:text-brand-deep block truncate font-medium"
                      >
                        {step.title}
                      </Link>
                      <span className="text-negative font-mono text-xs">
                        {step.dueAt ? dateFormat.format(step.dueAt) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {owners.size > 0 ? (
              <div className="card px-4 pt-4 pb-1">
                <span className="label">{t.plan.owners}</span>
                <ul className="divide-line mt-1 divide-y">
                  {[...owners.values()]
                    .sort((a, b) => b.count - a.count)
                    .map((owner) => (
                      <li key={owner.name} className="flex items-center gap-2.5 py-2 text-sm">
                        <Avatar name={owner.name} variant={owner.avatarVariant} size={22} />
                        <span className="min-w-0 flex-1 truncate font-medium">{owner.name}</span>
                        <span className="text-text-3 font-mono text-xs">
                          {t.plan.ownerSteps(owner.count)}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </>
  );
}
