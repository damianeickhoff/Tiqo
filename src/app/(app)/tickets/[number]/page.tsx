import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Merge, Phone, UserRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getClock, getMessages, getSettings, dateLocaleOf } from "@/lib/settings";
import { messagesFor } from "@/lib/i18n";
import { requireUser } from "@/lib/auth";
import {
  APPROVER_ROLE_FILTER,
  can,
  canEditTicket,
  canViewTicket,
  canEditCis,
  canWriteInternalNote,
  isStaff,
  ticketVisibilityFilter,
} from "@/lib/permissions";
import { PRIORITY_META, shortAge } from "@/lib/tickets";
import { describeHours } from "@/lib/clock";
import { planProgress } from "@/lib/plan";
import { approvalGate } from "@/lib/approvals";
import { Avatar } from "@/components/avatar";
import { PersonLink } from "@/components/person-link";
import { PriorityBars, StatusRing } from "@/components/tickets/indicators";
import { Reference } from "@/components/tickets/ticket-row";
import { TicketProperties } from "@/components/tickets/ticket-properties";
import { PlanCard } from "@/components/tickets/plan-card";
import {
  ActivityAllLink,
  ConversationComposer,
  TicketActionsProvider,
  TicketToolbar,
} from "@/components/tickets/ticket-actions";
import {
  ConversationTimeline,
  threadComments,
  type TimelineItem,
} from "@/components/tickets/timeline";
import { RailActivity } from "@/components/tickets/activity";
import { EditableText } from "@/components/tickets/editable-text";
import { AttachmentList } from "@/components/tickets/attachment-list";
import { RequesterPicker } from "@/components/tickets/requester-picker";
import { PanelCard } from "@/components/tickets/panel-card";
import { ApprovalsCard, ApprovalPrompt } from "@/components/tickets/approvals";
import { CancelledNote } from "@/components/tickets/cancelled-note";
import { LinksCard, type LinkRow } from "@/components/tickets/links-card";
import { FilesCard } from "@/components/tickets/files-card";
import { assetsOnTicket } from "@/lib/ticket-assets";
import { TargetChip } from "@/components/tickets/target-chip";
import { DeadlineBlock } from "@/components/tickets/deadline-block";
import { TopBarBreadcrumb } from "@/components/shell/topbar-breadcrumb";

type Params = Promise<{ number: string }>;

/** The URL segment is the ticket number; anything else is simply not a ticket. */
function parseNumber(raw: string) {
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const number = parseNumber((await params).number);
  if (!number) return { title: (await getMessages()).ticket.ticketRef };

  const ticket = await prisma.ticket.findUnique({
    where: { number },
    select: { reference: true, title: true },
  });
  return {
    title: ticket
      ? `${ticket.reference} · ${ticket.title}`
      : (await getMessages()).ticket.ticketRef,
  };
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};

const ACTIVITY_PREVIEW = 5;

/** Enough of the far ticket for a link row to answer "is that one still open"
 *  without a click, plus the two fields that decide who may see it at all. */
const LINK_END = {
  id: true,
  number: true,
  reference: true,
  title: true,
  priority: true,
  reporterId: true,
  assigneeId: true,
  status: { select: { id: true, name: true, color: true, settles: true } },
} as const;

export default async function TicketPage({ params }: { params: Params }) {
  const user = await requireUser();
  const number = parseNumber((await params).number);
  if (!number) notFound();

  const ticket = await prisma.ticket.findUnique({
    where: { number },
    select: {
      id: true,
      number: true,
      reference: true,
      title: true,
      description: true,
      statusId: true,
      status: {
        select: {
          id: true,
          name: true,
          color: true,
          settles: true,
          pausesClock: true,
          isCancelling: true,
        },
      },
      priority: true,
      type: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      pausedMinutes: true,
      pausedSince: true,
      closedAt: true,
      dueDate: true,
      reporterId: true,
      assigneeId: true,
      mergedInto: { select: { number: true, reference: true, title: true } },
      reporter: {
        select: {
          id: true,
          name: true,
          email: true,
          role: { select: { name: true } },
          avatarVariant: true,
          phone: true,
          company: true,
          department: true,
          jobTitle: true,
          workDays: true,
          workStart: true,
          workEnd: true,
        },
      },
      createdBy: { select: { id: true, name: true, avatarVariant: true } },
      assignee: { select: { id: true, name: true, avatarVariant: true } },
      projectId: true,
      milestoneId: true,
      project: { select: { id: true, key: true, name: true, color: true } },
      teamId: true,
      team: { select: { id: true, name: true, color: true } },
      labels: { select: { id: true, name: true, color: true } },
      // Files that came in with the ticket itself. Everything attached to a
      // reply is anchored here too, and belongs with the reply that carried it.
      attachments: {
        where: { commentId: null },
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
      // Not for drawing anything — the rounds are loaded properly below. These
      // are here because being asked to approve something is a right to read it,
      // and the answer has to be known before the page decides to 404.
      approvals: { select: { approverId: true } },
    },
  });

  if (!ticket) notFound();
  if (!canViewTicket(user, ticket)) notFound();

  const staff = isStaff(user);
  /// Whether internal notes — and the files that came in on them — are this
  /// person's to read at all.
  const notes = canWriteInternalNote(user);

  const [settings, clock] = await Promise.all([getSettings(), getClock()]);
  const t = messagesFor(settings.locale);
  const dateFormat = new Intl.DateTimeFormat(dateLocaleOf(settings), DATE_FORMAT);

  const [
    comments,
    activities,
    agents,
    star,
    roster,
    siblings,
    allTags,
    allProjects,
    allTeams,
    allStatuses,
    plan,
    approverPool,
    approvals,
    ticketLinks,
    assets,
    otherRequests,
    applied,
    files,
  ] = await Promise.all([
    prisma.comment.findMany({
      // Requesters never receive internal notes, not even to hide them client-side.
      // Notes written on a step live on that step's page, not in the change's
      // own thread — mixing them would bury the conversation they belong to.
      where: { ticketId: ticket.id, stepId: null, ...(staff ? {} : { isInternal: false }) },
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
    prisma.activity.findMany({
      // COMMENTED is dropped here — the comment itself is already in the feed.
      where: { ticketId: ticket.id, type: { not: "COMMENTED" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        field: true,
        stepId: true,
        oldValue: true,
        newValue: true,
        link: true,
        createdAt: true,
        actor: { select: { id: true, name: true, avatarVariant: true } },
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
    prisma.ticketStar.findUnique({
      where: { userId_ticketId: { userId: user.id, ticketId: ticket.id } },
      select: { ticketId: true },
    }),
    // One roster serves both pickers: forwarding drops you from it, changing
    // the requester keeps everyone, since a ticket can be about you.
    staff
      ? prisma.user.findMany({
          where: { isActive: true },
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
    // Numbers only, in the same order the ticket list uses, so the arrows step
    // through the queue exactly as it is displayed.
    prisma.ticket.findMany({
      where: ticketVisibilityFilter(user),
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      select: { number: true },
    }),
    // Tags are instance-wide now, so the picker offers every tag in use.
    prisma.label.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    // Archived projects stay on the tickets that already reference them, but
    // are not offered as somewhere new to file work.
    staff
      ? prisma.project.findMany({
          where: { isArchived: false },
          orderBy: { name: "asc" },
          select: { id: true, name: true, color: true },
        })
      : Promise.resolve([]),
    // The desks a ticket can be handed to.
    staff
      ? prisma.team.findMany({
          orderBy: { position: "asc" },
          select: { id: true, name: true, color: true },
        })
      : Promise.resolve([]),
    prisma.status.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true, color: true, isClosing: true, settles: true },
    }),
    // A plan only means anything on a change, so the other two kinds of ticket
    // fetch nothing for it. Enough of each step for the summary card between
    // the request and the conversation — the plan page has the rest.
    ticket.type === "CHANGE"
      ? prisma.changeStep.findMany({
          where: { ticketId: ticket.id },
          select: {
            id: true,
            title: true,
            phase: true,
            phaseOrder: true,
            position: true,
            status: true,
            dueAt: true,
            blocksPhase: true,
            dependsOnId: true,
          },
        })
      : Promise.resolve([]),
    // Who may be *named* on a request. A narrower list than the roster on
    // purpose: somebody offered here and asked must have somewhere to answer.
    staff
      ? prisma.user.findMany({
          where: APPROVER_ROLE_FILTER,
          orderBy: { name: "asc" },
          select: { id: true, name: true, avatarVariant: true },
        })
      : Promise.resolve([]),
    // Every decision this ticket has waited on. Ordered by state first, which
    // in the enum’s own order puts the ones still waiting at the top — that is
    // the only part of this card anybody has to act on.
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
    // Both directions in one query. A link is stored once, from the ticket it
    // was made on, so this ticket is the source of some rows and the target of
    // others — which of the two ends is the far one is worked out below.
    prisma.ticketLink.findMany({
      where: { OR: [{ sourceId: ticket.id }, { targetId: ticket.id }] },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        kind: true,
        sourceId: true,
        source: { select: LINK_END },
        target: { select: LINK_END },
      },
    }),
    // Which assets this is about, with what else is open on them and one hop
    // out from them already counted.
    assetsOnTicket(ticket.id, user),
    // What else this person has open with the desk: the one number that says
    // whether this is a one-off or the fifth time this month.
    staff
      ? prisma.ticket.count({
          where: { reporterId: ticket.reporterId, id: { not: ticket.id } },
        })
      : Promise.resolve(0),
    // Which template the plan came from, when the trail remembers one.
    ticket.type === "CHANGE"
      ? prisma.activity.findFirst({
          where: { ticketId: ticket.id, type: "PLAN_APPLIED" },
          orderBy: { createdAt: "desc" },
          select: { newValue: true },
        })
      : Promise.resolve(null),
    // Every file on the ticket for the rail's own card, including the ones
    // that came in on a step's notes — the thread above does not show those,
    // and "where is that screenshot" is the question this card answers.
    prisma.attachment.findMany({
      where: {
        ticketId: ticket.id,
        // A file on an internal note is as internal as the note. Left out of
        // the query rather than hidden in the card: a filename is enough to
        // disclose what the note was about.
        ...(notes ? {} : { OR: [{ commentId: null }, { comment: { isInternal: false } }] }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
        comment: { select: { isInternal: true } },
      },
    }),
  ]);

  // One list, each row carrying the reading it needs: the far end renders the
  // inverse verb rather than getting a second row of its own that could drift.
  // A link to a ticket this person cannot read is left off entirely — a link is
  // a way to learn that a ticket exists, and a dead reference is a disclosure
  // with nothing to show for it.
  const links: LinkRow[] = ticketLinks.flatMap((link) => {
    const incoming = link.sourceId !== ticket.id;
    const far = incoming ? link.source : link.target;
    if (!canViewTicket(user, far)) return [];
    return [
      {
        id: link.id,
        kind: link.kind,
        incoming,
        ticket: {
          id: far.id,
          number: far.number,
          reference: far.reference,
          title: far.title,
          priority: far.priority,
          status: far.status,
        },
      },
    ];
  });

  /**
   * Link entries in the trail, held to the same rule as the Links card.
   *
   * A LINKED row names the far ticket and draws an openable chip for it, so a
   * card that hides a far end the viewer cannot read while the trail below it
   * lists the same reference is a card that hides nothing at all.
   *
   * Nothing to work out for somebody who may read every ticket, which is almost
   * everybody who reaches this page.
   */
  const linkEvents = activities.filter(
    (activity) => activity.type === "LINKED" || activity.type === "UNLINKED",
  );
  const readableFarEnds =
    staff || linkEvents.length === 0
      ? null
      : new Set(
          (
            await prisma.ticket.findMany({
              where: {
                ...ticketVisibilityFilter(user),
                number: {
                  in: [
                    ...new Set(
                      linkEvents
                        .map((event) => Number(event.link?.split("/").pop()))
                        .filter(Number.isInteger),
                    ),
                  ],
                },
              },
              select: { number: true },
            })
          ).map((far) => `/tickets/${far.number}`),
        );

  const trail =
    readableFarEnds === null
      ? activities
      : activities.filter(
          (activity) =>
            (activity.type !== "LINKED" && activity.type !== "UNLINKED") ||
            (activity.link !== null && readableFarEnds.has(activity.link)),
        );

  const position = siblings.findIndex((sibling) => sibling.number === ticket.number);
  const prevNumber = position > 0 ? siblings[position - 1]!.number : null;
  const nextNumber =
    position >= 0 && position < siblings.length - 1 ? siblings[position + 1]!.number : null;

  // The conversation shows replies and field changes on one rail, in the order
  // they happened. The activity card renders the same events on its own.
  //
  // Events about one step are left out: a plan of twenty steps would fill this
  // thread with progress reports, which the toolbar already gives in one line.
  // They are on the step's own page, and the trail below still has all of them.
  const timeline: TimelineItem[] = [
    ...threadComments(comments, user.id).map((comment) => ({
      kind: "comment" as const,
      ...comment,
    })),
    ...trail
      .filter((activity) => activity.stepId === null)
      .map((activity) => ({ kind: "event" as const, ...activity })),
    // Newest first: on a ticket that has been running a while, what matters is
    // what just happened, and reading it should not start with scrolling past
    // everything that already has. Replies inside a comment stay in the order
    // they were written — a thread is an argument, and an argument reads
    // forwards.
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Rows filed before the creator column existed fall back to the reporter,
  // which is who filed them by definition.
  // Both halves of the same person, together: taking the name from one place
  // and letting the avatar fall back to its default is how the byline ended up
  // showing a different face from the one beside every comment.
  const creator = ticket.createdBy ?? ticket.reporter;
  const creatorName = creator.name;
  const requesterFirstName = ticket.reporter.name.split(" ")[0] ?? ticket.reporter.name;

  // Only the project's own dated points can be offered: a milestone belongs to
  // one project, and a ticket can only be filed against its own project's.
  const milestones = ticket.projectId
    ? await prisma.milestone.findMany({
        where: { projectId: ticket.projectId },
        orderBy: { position: "asc" },
        select: { id: true, title: true, reachedAt: true },
      })
    : [];

  const recipients = roster.filter((person) => person.id !== user.id);
  const requesterOptions = roster;

  // The requester's own hours, and only theirs. Standing the desk's hours in
  // for somebody who has given none said "in office until 17:00" about a person
  // whose day nobody has ever written down — a confident answer to a question
  // the database cannot answer. Without hours there is nothing to say.
  const workHours =
    ticket.reporter.workDays.length > 0
      ? {
          enabled: true,
          days: ticket.reporter.workDays,
          start: ticket.reporter.workStart,
          end: ticket.reporter.workEnd,
          timeZone: clock.hours.timeZone,
        }
      : null;
  const inOffice = workHours ? describeHours(workHours).open : null;

  const canEdit = canEditTicket(user);
  const priorityColor = PRIORITY_META[ticket.priority].color;

  // What the conversation's heading counts. Notes are counted apart because
  // they are the half of the thread the requester never sees.
  const noteCount = comments.filter((comment) => comment.isInternal).length;
  const replyCount = comments.length - noteCount;

  // The phases the plan actually has, in the order it works them — what a
  // request for approval can be pointed at.
  const gate = approvalGate(approvals);
  // The refusal that did it, for the band at the top. The newest one, because
  // a change can have been refused, revived and refused again.
  const refusal = ticket.status?.isCancelling
    ? approvals.find((approval) => approval.state === "REJECTED")
    : null;
  const phases = [
    ...new Set(
      [...plan]
        .sort((a, b) => a.phaseOrder - b.phaseOrder || a.position - b.position)
        .map((step) => step.phase)
        .filter((phase): phase is string => phase !== null),
    ),
  ];

  return (
    <TicketActionsProvider
      ticketId={ticket.id}
      ticketNumber={ticket.number}
      ticketReference={ticket.reference}
      plan={plan.length > 0 ? planProgress(plan) : null}
      closingStatusId={allStatuses.find((status) => status.isClosing)?.id ?? null}
      assets={assets}
      canEditAssets={canEdit && canEditCis(user)}
      canEdit={canEdit}
      canDelete={can(user, "ticket.delete")}
      canNote={canWriteInternalNote(user)}
      isClosed={ticket.status?.settles ?? false}
      statuses={allStatuses}
      statusId={ticket.statusId}
      requesterName={ticket.reporter.name}
      viewerName={user.name}
      viewerAvatar={user.avatarVariant}
      starred={Boolean(star)}
      recipients={recipients}
      activities={trail}
      prevNumber={prevNumber}
      nextNumber={nextNumber}
    >
      <TopBarBreadcrumb reference={ticket.reference} title={ticket.title} />
      <TicketToolbar />

      {/* Two panes: the conversation, and a rail of everything about the
          ticket that is not the conversation. The rail is its own scroller on
          wide screens, pinned under the toolbar, so the thread and the
          settings scroll independently. */}
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 px-5 py-5 lg:px-6 xl:pr-2">
          <div className="space-y-3.5">
            {/* Above the request itself: for the person holding the decision
                this is the most important thing on the page, and nobody else
                sees it at all. */}
            <ApprovalPrompt approvals={approvals} viewerId={user.id} />

            {refusal ? (
              <CancelledNote
                refusedBy={refusal.approver?.name}
                reason={refusal.comment ?? undefined}
              />
            ) : null}

            {/* The request: what was asked, and everything that names it. The
                reference, the status, the tags, the byline and the title are
                the card's own head; the words the requester wrote are the
                section under the first divider. One card, because they are one
                thing — the request — and a title floating above a bordered
                block was the page's loudest seam. */}
            <section className="card overflow-hidden">
              <header className="px-4 pt-3.5 pb-4">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                  <Reference reference={ticket.reference} />
                  <span
                    className="flex items-baseline gap-1.5 text-sm font-medium"
                    style={{ color: priorityColor }}
                  >
                    <PriorityBars
                      priority={ticket.priority}
                      title={t.vocab.priority[ticket.priority]}
                    />
                    {t.vocab.priority[ticket.priority]}
                  </span>
                  <span aria-hidden className="text-text-3">
                    ·
                  </span>
                  <span className="text-text-2 flex items-center gap-1.5 text-sm">
                    <StatusRing status={ticket.status} />
                    {ticket.status?.name ?? t.tickets.noStatus}
                  </span>
                  <span aria-hidden className="text-text-3">
                    ·
                  </span>
                  <span className="text-text-3 text-sm">{t.vocab.type[ticket.type]}</span>
                  <TargetChip ticket={ticket} />
                </div>

                <div className="mt-2.5">
                  <EditableText
                    ticketId={ticket.id}
                    field="title"
                    value={ticket.title}
                    canEdit={canEdit || ticket.reporterId === user.id}
                    as="title"
                    className="text-xl leading-tight font-semibold tracking-[-0.02em] text-balance"
                  />
                </div>

                {/* One line for the provenance of the ticket: who raised it, when,
                  and who has it now. An agent can file on someone's behalf, so
                  who typed it stays separate from who it is about. */}
                <p className="text-text-3 mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                  <span>{t.ticket.createdBy}</span>
                  <Avatar name={creatorName} variant={creator.avatarVariant} size={16} />
                  <PersonLink
                    id={creator.id}
                    name={creatorName}
                    className="text-text-2 font-medium"
                  />
                  {creatorName !== ticket.reporter.name ? (
                    <>
                      <span>{t.ticket.onBehalfOf}</span>
                      <Avatar
                        name={ticket.reporter.name}
                        variant={ticket.reporter.avatarVariant}
                        size={16}
                      />
                      <PersonLink
                        id={ticket.reporter.id}
                        name={ticket.reporter.name}
                        className="text-text-2 font-medium"
                      />
                    </>
                  ) : null}
                  <span>{t.common.ago(shortAge(ticket.createdAt, undefined, t))}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {t.ticket.lastUpdated.toLowerCase()}{" "}
                    {t.common.ago(shortAge(ticket.updatedAt, undefined, t))}
                  </span>
                  {ticket.labels.length > 0 ? (
                    <>
                      <span aria-hidden>·</span>
                      {ticket.labels.map((label) => (
                        <span
                          key={label.id}
                          className="text-text-2 inline-flex h-[18px] items-center gap-1 rounded-full px-1.5 text-xs font-medium"
                          style={{ background: "color-mix(in oklab, var(--text) 6%, transparent)" }}
                        >
                          {label.name}
                        </span>
                      ))}
                    </>
                  ) : null}
                </p>

                {ticket.mergedInto ? (
                  <p className="bg-surface-2 text-text-2 rounded-control mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-base">
                    <Merge size={14} className="text-text-3" />
                    {t.ticket.mergedInto}{" "}
                    <Link
                      href={`/tickets/${ticket.mergedInto.number}`}
                      className="text-brand-deep font-semibold hover:underline"
                    >
                      {ticket.mergedInto.reference}
                    </Link>
                  </p>
                ) : null}
              </header>

              {/* The words themselves, under a faint divider: a section of the
                request card, not a block of its own. Who wrote them and when
                sit at the right of the section's heading. */}
              <div className="group/body border-line border-t">
                <div className="flex min-h-[38px] flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pt-2.5 pb-1">
                  <p className="label">{t.ticket.request}</p>
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <Avatar
                      name={ticket.reporter.name}
                      variant={ticket.reporter.avatarVariant}
                      size={18}
                    />
                    <PersonLink
                      id={ticket.reporter.id}
                      name={ticket.reporter.name}
                      className="font-medium"
                    />
                    <span className="text-text-3">
                      {t.ticket.raisedThisOn(dateFormat.format(ticket.createdAt))}
                    </span>
                  </span>
                </div>
                <div className="px-4 pb-4">
                  <EditableText
                    ticketId={ticket.id}
                    field="description"
                    value={ticket.description}
                    canEdit={canEdit || ticket.reporterId === user.id}
                    as="body"
                    className="text-md block leading-[1.7]"
                    placeholder={t.ticket.noDescription}
                  />
                  <AttachmentList
                    attachments={ticket.attachments}
                    viewerId={user.id}
                    canModerate={can(user, "comment.moderate")}
                    body={ticket.description}
                  />
                </div>
              </div>
            </section>

            {ticket.type === "CHANGE" && plan.length > 0 ? (
              <PlanCard
                ticketNumber={ticket.number}
                steps={plan}
                template={applied?.newValue ?? null}
                gate={gate}
              />
            ) : null}

            {/* The second card: everything said since, with the count of it in
                the heading. */}
            <section className="card overflow-hidden">
              <div className="flex h-[38px] items-center justify-between gap-3 px-4">
                <h2 className="label">{t.ticket.conversation}</h2>
                <span className="text-text-3 text-sm">
                  {t.ticket.conversationCount(replyCount, noteCount)}
                </span>
              </div>
              <div className="border-line border-t">
                <ConversationTimeline
                  items={timeline}
                  ticketId={ticket.id}
                  currentUserId={user.id}
                  canDeleteAny={can(user, "comment.moderate")}
                  locale={settings.locale}
                  dateLocale={dateLocaleOf(settings)}
                  requesterFirstName={requesterFirstName}
                />
              </div>
            </section>

            <ConversationComposer />
          </div>
        </div>

        {/* The rail. Its height is the pane exactly — 100dvh less the bar and
            the toolbar, both tokens — so a change to either cannot leave it
            out of step and hand it a scrollbar it does not need. */}
        {/* Its height is the pane exactly — 100dvh less the bar and the
            toolbar, both tokens. `overscroll-contain` stops a wheel over the
            rail from being handed on to the conversation once the rail itself
            has nowhere left to go; the scrollbar track is always reserved, and
            the right padding is short by its width so the cards sit the same
            distance from both edges. */}
        <aside className="bg-bg rail-scroll flex flex-col gap-3 p-3 xl:sticky xl:top-[var(--toolbar)] xl:h-[calc(100dvh-var(--bar)-var(--toolbar))] xl:overflow-y-auto xl:overscroll-contain xl:pr-0.5">
          {/* Keyed on the values it holds, so a status set from somewhere else
              — a reply sent with one, the toolbar's Close — reaches the rail.
              The card keeps its own committed copy of the draft and cannot
              hear about a change it did not make; keyed this way it is rebuilt
              only when one of those values really moved, so an edit in progress
              survives everything else the page revalidates for. */}
          <TicketProperties
            key={[
              ticket.statusId,
              ticket.priority,
              ticket.type,
              ticket.assigneeId,
              ticket.teamId,
              ticket.projectId,
              ticket.milestoneId,
            ].join("·")}
            ticketId={ticket.id}
            ticketNumber={ticket.number}
            statusId={ticket.statusId}
            statusName={ticket.status?.name ?? null}
            statuses={allStatuses}
            priority={ticket.priority}
            type={ticket.type}
            assigneeId={ticket.assigneeId}
            assigneeName={ticket.assignee?.name ?? null}
            projectId={ticket.projectId}
            projectName={ticket.project?.name ?? null}
            projectKey={ticket.project?.key ?? null}
            teamId={ticket.teamId}
            teamName={ticket.team?.name ?? null}
            teams={allTeams}
            labelIds={ticket.labels.map((l) => l.id)}
            agents={agents}
            projects={allProjects}
            milestones={milestones}
            milestoneId={ticket.milestoneId}
            labels={allTags}
            plan={
              plan.length > 0 ? { name: applied?.newValue ?? null, ...planProgress(plan) } : null
            }
            readOnly={!canEdit}
          />

          {/* Who this is about, as a contact card: enough to reach them without
              opening their page. */}
          <PanelCard
            title={t.ticket.requester}
            action={
              <span className="flex items-center gap-2.5">
                {staff ? (
                  <Link
                    href={`/tickets?q=${encodeURIComponent(ticket.reporter.email)}`}
                    className="text-brand-deep text-xs font-medium transition-colors hover:underline"
                  >
                    {t.ticket.otherRequests(otherRequests)}
                  </Link>
                ) : null}
                {canEdit ? (
                  <RequesterPicker
                    ticketId={ticket.id}
                    currentId={ticket.reporterId}
                    people={requesterOptions}
                  />
                ) : null}
              </span>
            }
          >
            {/* Who they are and nothing else. The address and the number were
                two rows of small print above the two buttons that use them,
                and their hours were a line nobody read — whether a reply now
                will be read now is the dot beside the name, which is the whole
                of what the hours were for. */}
            <div className="flex items-center gap-2.5 px-3.5 py-3">
              <Avatar
                name={ticket.reporter.name}
                variant={ticket.reporter.avatarVariant}
                size={36}
              />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="flex items-center gap-1.5">
                  <PersonLink
                    id={ticket.reporter.id}
                    name={ticket.reporter.name}
                    className="text-md min-w-0 truncate font-semibold"
                  />
                  {inOffice === null ? null : (
                    <span
                      aria-label={inOffice ? t.ticket.inOffice : t.ticket.outOfHours}
                      title={inOffice ? t.ticket.inOffice : t.ticket.outOfHours}
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: inOffice ? "var(--positive)" : "var(--text-3)" }}
                    />
                  )}
                </div>
                <p className="text-text-2 mt-0.5 truncate text-sm">
                  {[
                    ticket.reporter.jobTitle,
                    [ticket.reporter.department, ticket.reporter.company]
                      .filter(Boolean)
                      .join(", "),
                  ]
                    .filter(Boolean)
                    .join(" · ") || ticket.reporter.role.name}
                </p>
              </div>
            </div>

            <div className="border-line flex gap-1 border-t px-2 py-1.5">
              <a
                href={`mailto:${ticket.reporter.email}`}
                className="text-text-2 hover:bg-surface-2 hover:text-text rounded-control flex h-7 flex-1 items-center justify-center gap-1.5 text-sm font-medium transition-colors"
              >
                <Mail size={13} />
                {t.ticket.emailAction}
              </a>
              {ticket.reporter.phone ? (
                <a
                  href={`tel:${ticket.reporter.phone.replace(/\s/g, "")}`}
                  className="text-text-2 hover:bg-surface-2 hover:text-text rounded-control flex h-7 flex-1 items-center justify-center gap-1.5 text-sm font-medium transition-colors"
                >
                  <Phone size={13} />
                  {t.ticket.callAction}
                </a>
              ) : null}
              <PersonLink
                id={ticket.reporter.id}
                name={ticket.reporter.name}
                className="text-text-2 hover:bg-surface-2 hover:text-text rounded-control flex h-7 flex-1 items-center justify-center gap-1.5 text-sm font-medium"
              >
                <UserRound size={13} />
                {t.ticket.profileAction}
              </PersonLink>
            </div>
          </PanelCard>

          <DeadlineBlock ticketId={ticket.id} ticket={ticket} canEdit={canEdit} />

          <ApprovalsCard
            ticketId={ticket.id}
            approvals={approvals}
            viewerId={user.id}
            phases={phases}
            people={approverPool}
            canRequest={can(user, "approval.request")}
            canManage={canEdit}
            isChange={ticket.type === "CHANGE"}
          />

          <LinksCard
            ticketId={ticket.id}
            ticketNumber={ticket.number}
            links={links}
            canEdit={canEdit}
          />

          <FilesCard
            files={files.map((file) => ({
              id: file.id,
              filename: file.filename,
              mimeType: file.mimeType,
              size: file.size,
              createdAt: file.createdAt,
              uploadedBy: file.uploadedBy,
              internal: Boolean(file.comment?.isInternal),
            }))}
          />

          {/* Only the four most recent — the full trail is behind "All", which
              opens the same dialog the toolbar does. */}
          <PanelCard title={t.ticket.activity} action={<ActivityAllLink />}>
            <RailActivity
              locale={settings.locale}
              dateLocale={dateLocaleOf(settings)}
              events={trail.slice(0, ACTIVITY_PREVIEW)}
              canRemove={can(user, "activity.delete")}
            />
          </PanelCard>
        </aside>
      </div>
    </TicketActionsProvider>
  );
}
