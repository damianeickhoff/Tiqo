import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Check, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getClock, getMessages, getSettings, dateLocaleOf } from "@/lib/settings";
import { deadlineOf, isPastDue } from "@/lib/tickets";
import { Avatar } from "@/components/avatar";
import { Markdown } from "@/components/markdown";
import { AttachmentList } from "@/components/tickets/attachment-list";
import { cn } from "@/lib/utils";
import { PortalReply } from "@/components/portal/portal-reply";
import { PortalDeskCard } from "@/components/portal/portal-desk-card";
import { ApprovalPrompt } from "@/components/tickets/approvals";
import { CancelledNote } from "@/components/tickets/cancelled-note";

type Params = Promise<{ number: string }>;
type Query = Promise<{ new?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const ticket = await prisma.ticket.findUnique({
    where: { number: Number.parseInt((await params).number, 10) || 0 },
    select: { reference: true, title: true },
  });
  return { title: ticket ? `${ticket.reference} · ${ticket.title}` : "" };
}

/** What a related request needs to be worth listing: a name to recognise it by
 *  and where it has got to. */
const RELATED = {
  number: true,
  reference: true,
  title: true,
  status: { select: { name: true, color: true } },
} as const;

const STAMP: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

/**
 * One request, as its requester sees it: what they asked, what came back, and a
 * box to answer in. Internal notes are filtered in the query, not hidden in the
 * markup — the portal never receives them at all.
 *
 * Round 12 lays it out in two columns: the request and its conversation on the
 * left, and on the right the ladder — the four moments a request passes
 * through — above the desk's own card. The question "where has this got to"
 * used to be answered by reading the whole thread; now it is answered without
 * reading anything.
 */
export default async function PortalRequest({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Query;
}) {
  const user = await requireUser();
  const number = Number.parseInt((await params).number, 10);
  const justRaised = (await searchParams).new === "1";
  if (!Number.isSafeInteger(number)) notFound();

  const ticket = await prisma.ticket.findUnique({
    where: { number },
    select: {
      id: true,
      number: true,
      reference: true,
      title: true,
      description: true,
      createdAt: true,
      dueDate: true,
      priority: true,
      type: true,
      pausedMinutes: true,
      pausedSince: true,
      resolvedAt: true,
      closedAt: true,
      reporterId: true,
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
      assignee: { select: { name: true, avatarVariant: true } },
      portalForm: { select: { name: true, confirmation: true } },
      // When somebody took it on. The moment the ladder means by "picked up" is
      // the first assignment rather than the first reply: a request can sit
      // with a name on it for a day before anyone writes, and the requester is
      // owed the earlier of the two facts.
      activities: {
        where: { type: "ASSIGNED" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true },
      },
      // What came in with the request itself; a reply's files travel with it.
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
      comments: {
        where: { isInternal: false, stepId: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { id: true, name: true, avatarVariant: true } },
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
      },
    },
  });

  if (!ticket || ticket.reporterId !== user.id) notFound();

  const [settings, clock, t, approvals, links] = await Promise.all([
    getSettings(),
    getClock(),
    getMessages(),
    // Somebody can be asked to approve a change on their own request — the
    // budget holder raising the thing they then have to sign for is the common
    // case. The same prompt the desk shows, in the place they already are.
    prisma.approval.findMany({
      where: { ticketId: ticket.id, state: "PENDING", approverId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        phase: true,
        state: true,
        question: true,
        comment: true,
        dueAt: true,
        decidedAt: true,
        requestedBy: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true, avatarVariant: true } },
      },
    }),
    // Only the two kinds that say something a requester can act on, and only
    // their own requests at the far end. "Your request is blocked by INC-4471"
    // is a sentence about a ticket they cannot open, and a link they cannot
    // follow is worse than no link — it tells them something exists and then
    // refuses to show it.
    prisma.ticketLink.findMany({
      where: {
        kind: { in: ["RELATES_TO", "DUPLICATES"] },
        OR: [
          { sourceId: ticket.id, target: { reporterId: user.id } },
          { targetId: ticket.id, source: { reporterId: user.id } },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        kind: true,
        sourceId: true,
        source: { select: RELATED },
        target: { select: RELATED },
      },
    }),
  ]);
  const stamp = new Intl.DateTimeFormat(dateLocaleOf(settings), STAMP);

  // What the desk promised and who is keeping it. Both were missing here: the
  // requester could see the request had been picked up only by reading the
  // replies, and the answer-by date was on the desk's side of the wall.
  // Why it was cancelled, where it was. The requester is not shown who
  // refused: inside the desk that is a name people know, and on the portal it
  // is somebody they were never introduced to.
  const refusal = ticket.status?.isCancelling
    ? await prisma.approval.findFirst({
        where: { ticketId: ticket.id, state: "REJECTED" },
        orderBy: { decidedAt: "desc" },
        select: { comment: true },
      })
    : null;

  const due = ticket.status?.settles ? null : deadlineOf(ticket, clock).date;
  const late = due ? isPastDue(due) : false;

  /* ------------------------------------------------------------- the ladder */

  // Nothing here is stored as a step: each one is read off a fact the request
  // already carries. A step that happened without leaving a date behind — a
  // ticket assigned before the trail existed, a status that pauses the clock
  // without a paused-since — is still shown, without one, because "it has
  // happened" is the part somebody came here to read.
  const firstDeskReply = ticket.comments.find((comment) => comment.author.id !== ticket.reporterId);
  const pickedUpAt = ticket.activities[0]?.createdAt ?? firstDeskReply?.createdAt ?? null;
  const settled = ticket.status?.settles ?? false;
  const waiting = !settled && (ticket.status?.pausesClock ?? false);
  const resolvedAt = ticket.resolvedAt ?? ticket.closedAt;

  const steps: Step[] = [
    { label: t.portal.stepRaised, at: ticket.createdAt, done: true },
    {
      label: ticket.assignee
        ? t.portal.stepPickedUpBy(ticket.assignee.name)
        : t.portal.stepPickedUp,
      at: pickedUpAt,
      done: pickedUpAt !== null || ticket.assignee !== null,
    },
    { label: t.portal.waitingOnYou, at: waiting ? ticket.pausedSince : null, done: waiting },
    {
      label: t.portal.resolved,
      at: settled ? resolvedAt : null,
      done: settled || resolvedAt !== null,
    },
  ];

  return (
    <div className="portal-wrap pt-9 pb-16">
      <Link
        href="/portal/requests"
        className="text-text-2 hover:text-text inline-flex items-center gap-1.5 text-[13.5px] font-medium transition-colors"
      >
        <ArrowLeft size={14} />
        {t.portal.myRequests}
      </Link>

      <div className="mt-4 grid grid-cols-1 items-start gap-x-11 gap-y-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <ApprovalPrompt approvals={approvals} viewerId={user.id} />

          {/* The requester hears it here rather than working it out from a
              status pill: their change is not going to happen. */}
          {ticket.status?.isCancelling ? (
            <CancelledNote reason={refusal?.comment ?? undefined} />
          ) : null}

          {justRaised ? (
            <div className="animate-rise border-positive/35 bg-positive/[0.07] flex items-start gap-3 rounded-[18px] border px-[22px] py-4">
              <CheckCircle2 size={18} className="text-positive mt-0.5 shrink-0" />
              <div>
                <p className="text-md font-semibold">{t.portal.submitted}</p>
                <p className="text-text-2 mt-1 text-base">
                  {ticket.portalForm?.confirmation || t.portal.submittedBody}
                </p>
              </div>
            </div>
          ) : null}

          <header className="animate-rise">
            <p className="flex flex-wrap items-center gap-2.5">
              <span className="text-text-3 font-mono text-[13px] font-medium">
                {ticket.reference}
              </span>
              {ticket.status ? (
                <span
                  className="inline-flex h-[26px] items-center rounded-full px-3 text-[13px] font-semibold"
                  style={{
                    background: `color-mix(in oklab, ${ticket.status.color} 16%, transparent)`,
                    color: `color-mix(in oklab, ${ticket.status.color} 70%, var(--text))`,
                  }}
                >
                  {ticket.status.name}
                </span>
              ) : null}
            </p>

            <h1 className="mt-2.5 text-[36px] leading-[1.08] font-semibold tracking-[-0.035em]">
              {ticket.title}
            </h1>

            <p className="text-text-3 mt-2.5 text-[13.5px]">
              {stamp.format(ticket.createdAt)}
              {ticket.portalForm ? ` · ${t.portal.viaForm(ticket.portalForm.name)}` : ""}
            </p>
          </header>

          {/* Who has it and when it is answered by, as two readouts rather than
              another clause on the line above: they are the two questions a
              requester opens their own request to answer. */}
          <div className="pcard animate-rise grid grid-cols-1 sm:grid-cols-2">
            <div className={cn("border-line px-[22px] py-[15px]", due && "sm:border-r")}>
              <p className="label">{t.portal.lookingAfterIt}</p>
              <p className="mt-2.5 flex items-center gap-2.5 text-[14.5px] font-medium">
                {ticket.assignee ? (
                  <Avatar
                    name={ticket.assignee.name}
                    variant={ticket.assignee.avatarVariant}
                    size={26}
                  />
                ) : (
                  <span
                    aria-hidden
                    className="border-line block size-[26px] shrink-0 rounded-full border border-dashed"
                  />
                )}
                {ticket.assignee?.name ?? t.portal.nobodyYet}
              </p>
            </div>

            {due ? (
              <div className="border-line px-[22px] py-[15px] max-sm:border-t">
                <p className="label">{t.portal.dueDate}</p>
                {/* The date itself. "in 6 d" is a number you have to convert
                    before you can put it in a calendar, and a deadline is
                    something people put in a calendar. */}
                <p
                  className={cn(
                    "mt-2.5 flex items-center gap-2.5 text-[14.5px] font-medium",
                    late && "text-negative",
                  )}
                >
                  <Calendar size={15} className={cn("shrink-0", !late && "text-text-3")} />
                  {stamp.format(due)}
                </p>
              </div>
            ) : null}
          </div>

          {/* The source everything below it answers. */}
          <section className="pcard animate-rise">
            <h2 className="border-line border-b px-[22px] py-[15px] text-[16px] font-semibold tracking-[-0.01em]">
              {t.portal.whatYouAsked}
            </h2>
            <div className="px-[22px] py-[18px]">
              {ticket.description ? (
                <Markdown text={ticket.description} className="text-md leading-[1.7]" />
              ) : (
                <p className="text-text-3 text-md">{t.ticket.noDescription}</p>
              )}
              <AttachmentList
                attachments={ticket.attachments}
                viewerId={user.id}
                canModerate={false}
                body={ticket.description}
              />
            </div>
          </section>

          {links.length > 0 ? (
            <section className="pcard animate-rise">
              <h2 className="border-line border-b px-[22px] py-[15px] text-[16px] font-semibold tracking-[-0.01em]">
                {t.portal.relatedRequests}
              </h2>
              <ul className="p-1.5">
                {links.map((link) => {
                  // The row is stored once, from whichever request the desk was
                  // looking at, so the far end has to read the same statement
                  // backwards.
                  const incoming = link.sourceId !== ticket.id;
                  const far = incoming ? link.source : link.target;
                  return (
                    <li key={link.id}>
                      <Link
                        href={`/portal/requests/${far.number}`}
                        className="hover:bg-surface-2 flex items-baseline gap-2.5 rounded-xl px-[16px] py-3 transition-colors"
                      >
                        <span className="text-text-3 shrink-0 text-[12.5px]">
                          {incoming ? t.links.inverse[link.kind] : t.links.verb[link.kind]}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">
                          {far.title}
                        </span>
                        {far.status ? (
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                            style={{
                              background: `color-mix(in oklab, ${far.status.color} 16%, transparent)`,
                              color: `color-mix(in oklab, ${far.status.color} 70%, var(--text))`,
                            }}
                          >
                            {far.status.name}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {/* The conversation and the box to add to it, in one card: a reply is
              the next message in the thread, not a separate errand. */}
          <section className="pcard animate-rise">
            {ticket.comments.length > 0 ? (
              <ul className="flex flex-col gap-3 p-[18px]">
                {ticket.comments.map((comment, index) => {
                  const mine = comment.author.id === user.id;
                  return (
                    <li
                      key={comment.id}
                      className="animate-rise rounded-[14px] px-[18px] py-4"
                      style={{
                        ["--i" as string]: index,
                        background: mine ? "var(--surface-2)" : "var(--brand-wash)",
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={comment.author.name}
                          variant={comment.author.avatarVariant}
                          size={26}
                        />
                        <span className="text-base font-semibold">
                          {mine ? t.portal.you : comment.author.name}
                        </span>
                        {/* Which side of the wall wrote it, said rather than
                            implied by the fill: the wash means "from the desk"
                            only to somebody who has already learnt it. */}
                        {mine ? null : <span className="tag">{t.portal.toTheDesk}</span>}
                        <span className="text-text-3 ml-auto shrink-0 font-mono text-xs">
                          {stamp.format(comment.createdAt)}
                        </span>
                      </div>
                      {/* The desk writes Markdown and means it. A requester
                          typing into a plain box does not, so their own words
                          are shown as they typed them — asterisks included.
                          Reading their reply as Markdown would silently
                          rewrite it. */}
                      {mine ? (
                        <p className="text-md mt-2.5 leading-[1.65] whitespace-pre-wrap">
                          {comment.body}
                        </p>
                      ) : (
                        <Markdown text={comment.body} className="text-md mt-2.5 leading-[1.65]" />
                      )}
                      <AttachmentList
                        attachments={comment.attachments}
                        viewerId={user.id}
                        canModerate={false}
                        body={comment.body}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : null}

            <div
              className={cn(
                "px-[22px] py-[18px]",
                ticket.comments.length > 0 && "border-line border-t",
              )}
            >
              {ticket.status?.settles ? (
                <p className="text-text-2 text-md">{t.portal.settledNote}</p>
              ) : (
                <PortalReply ticketId={ticket.id} />
              )}
            </div>
          </section>
        </div>

        {/* Below lg the two columns become one and the rail comes last: on a
            phone the request itself is what was opened. */}
        <aside className="flex flex-col gap-[22px]">
          <Ladder title={t.portal.whereItStands} steps={steps} stamp={stamp} />
          <PortalDeskCard />
        </aside>
      </div>
    </div>
  );
}

/** One moment a request passes through, and when it passed through it. */
type Step = { label: string; at: Date | null; done: boolean };

/**
 * The four moments, down the rail.
 *
 * The step it is on now is the last one that has happened: everything under it
 * is still ahead, and a ladder that marked two steps current would not answer
 * the one question it exists for. Past steps carry a tick, the current one the
 * brand — which on this portal means "yours" — and what has not happened yet is
 * dimmed rather than hidden, because the shape of what is left is the reason
 * somebody reads a ladder rather than a status.
 */
function Ladder({
  title,
  steps,
  stamp,
}: {
  title: string;
  steps: Step[];
  stamp: Intl.DateTimeFormat;
}) {
  const now = steps.reduce((last, step, index) => (step.done ? index : last), 0);

  return (
    <section className="pcard">
      <h2 className="px-5 pt-[18px] pb-1 text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
      <ol className="relative px-5 pt-2 pb-[18px]">
        <span
          aria-hidden
          className="bg-line absolute top-[30px] bottom-[34px] left-[calc(1.25rem+13px)] w-px"
        />
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={cn("relative flex items-center gap-3 py-[7px]", index > now && "opacity-45")}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-[26px] shrink-0 items-center justify-center rounded-full",
                index === now
                  ? "bg-brand text-brand-fg"
                  : step.done
                    ? "bg-text text-bg"
                    : "bg-surface-2 text-text-3",
              )}
            >
              {index < now ? (
                <Check size={14} strokeWidth={2.75} />
              ) : (
                <span className="size-[7px] rounded-full bg-current" />
              )}
            </span>
            <span className={cn("text-[13.5px]", index === now ? "font-semibold" : "font-medium")}>
              {step.label}
            </span>
            {step.at ? (
              <span className="text-text-3 ml-auto shrink-0 font-mono text-xs">
                {stamp.format(step.at)}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
