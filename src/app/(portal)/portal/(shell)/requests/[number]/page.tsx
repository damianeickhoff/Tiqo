import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getClock, getMessages, getSettings, dateLocaleOf } from "@/lib/settings";
import { deadlineOf, isPastDue } from "@/lib/tickets";
import { Avatar } from "@/components/avatar";
import { Markdown } from "@/components/markdown";
import { AttachmentList } from "@/components/tickets/attachment-list";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PortalReply } from "@/components/portal/portal-reply";
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

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/portal/requests"
        className="text-text-2 hover:text-text inline-flex items-center gap-1.5 text-base font-medium transition-colors"
      >
        <ArrowLeft size={14} />
        {t.portal.myRequests}
      </Link>

      <ApprovalPrompt approvals={approvals} viewerId={user.id} />

      {/* The requester hears it here rather than working it out from a status
          pill: their change is not going to happen. */}
      {ticket.status?.isCancelling ? (
        <CancelledNote reason={refusal?.comment ?? undefined} />
      ) : null}

      {justRaised ? (
        <div className="animate-rise border-positive/35 bg-positive/[0.07] rounded-card flex items-start gap-3 border px-4 py-3.5">
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
          <span className="text-text-3 font-mono text-sm font-medium">{ticket.reference}</span>
          {ticket.status ? (
            <span
              className="rounded-full px-2.5 py-1 text-sm font-medium"
              style={{
                background: `color-mix(in oklab, ${ticket.status.color} 16%, transparent)`,
                color: `color-mix(in oklab, ${ticket.status.color} 70%, var(--text))`,
              }}
            >
              {ticket.status.name}
            </span>
          ) : null}
        </p>

        <h1 className="mt-2 text-2xl leading-tight font-extrabold tracking-[-0.025em]">
          {ticket.title}
        </h1>

        <p className="text-text-3 mt-1.5 text-base">
          {stamp.format(ticket.createdAt)}
          {ticket.portalForm ? ` · ${t.portal.viaForm(ticket.portalForm.name)}` : ""}
        </p>

        {/* Who has it and when it is answered by, as two readouts rather than
            another clause on the line above: they are the two questions a
            requester opens their own request to answer. */}
        <div className="border-line mt-4 flex flex-wrap items-center gap-x-8 gap-y-4 border-t pt-4">
          <div className="flex items-center gap-2.5">
            {ticket.assignee ? (
              <Avatar
                name={ticket.assignee.name}
                variant={ticket.assignee.avatarVariant}
                size={30}
              />
            ) : (
              <span
                aria-hidden
                className="border-line block size-[30px] rounded-full border border-dashed"
              />
            )}
            <span>
              <span className="label block">{t.portal.lookingAfterIt}</span>
              <span className="text-md mt-0.5 block font-semibold">
                {ticket.assignee?.name ?? t.portal.nobodyYet}
              </span>
            </span>
          </div>

          {due ? (
            <div>
              <span className="label block">{t.portal.dueDate}</span>
              {/* The date itself. "in 6 d" is a number you have to convert
                  before you can put it in a calendar, and a deadline is
                  something people put in a calendar. */}
              <span className={cn("text-md mt-0.5 block font-semibold", late && "text-negative")}>
                {stamp.format(due)}
              </span>
            </div>
          ) : null}
        </div>
      </header>

      {/* The source everything below it answers. Quiet rather than washed: the
          wash is what an agent's reply wears on this side. */}
      <div className="animate-rise source-panel source-panel-quiet">
        {ticket.description ? (
          <Markdown text={ticket.description} className="text-lg leading-[1.75]" />
        ) : (
          <p className="text-text-3 text-lg">{t.ticket.noDescription}</p>
        )}
        <AttachmentList
          attachments={ticket.attachments}
          viewerId={user.id}
          canModerate={false}
          body={ticket.description}
        />
      </div>

      {links.length > 0 ? (
        <Card className="animate-rise p-5">
          <h2 className="label">{t.portal.relatedRequests}</h2>
          <ul className="mt-3 space-y-2.5">
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
                    className="group flex items-baseline gap-2"
                  >
                    <span className="text-text-3 shrink-0 text-sm">
                      {incoming ? t.links.inverse[link.kind] : t.links.verb[link.kind]}
                    </span>
                    <span className="text-md min-w-0 flex-1 truncate font-medium group-hover:underline">
                      {far.title}
                    </span>
                    {far.status ? (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
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
        </Card>
      ) : null}

      {ticket.comments.map((comment, index) => {
        const mine = comment.author.id === user.id;
        return (
          <Card
            key={comment.id}
            className="animate-rise p-4"
            style={{
              ["--i" as string]: index,
              ...(mine ? {} : { background: "var(--brand-wash)" }),
            }}
          >
            <div className="flex gap-3">
              <Avatar name={comment.author.name} variant={comment.author.avatarVariant} size={30} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-md font-semibold">
                    {mine ? t.portal.you : comment.author.name}
                  </span>
                  <span className="text-text-3 text-sm">{stamp.format(comment.createdAt)}</span>
                </p>
                {/* The desk writes Markdown and means it. A requester typing
                    into a plain box does not, so their own words are shown as
                    they typed them — asterisks included. Reading their reply as
                    Markdown would silently rewrite it. */}
                {mine ? (
                  <p className="text-md mt-1 leading-relaxed whitespace-pre-wrap">{comment.body}</p>
                ) : (
                  <Markdown text={comment.body} className="text-md mt-1 leading-relaxed" />
                )}
                <AttachmentList
                  attachments={comment.attachments}
                  viewerId={user.id}
                  canModerate={false}
                  body={comment.body}
                />
              </div>
            </div>
          </Card>
        );
      })}

      <Card className="animate-rise p-5">
        {ticket.status?.settles ? (
          <p className="text-text-2 text-md">{t.portal.settledNote}</p>
        ) : (
          <PortalReply ticketId={ticket.id} />
        )}
      </Card>
    </div>
  );
}
