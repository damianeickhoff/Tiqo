import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMessages } from "@/lib/settings";
import { PortalApprovals, type PortalApproval } from "@/components/portal/portal-approvals";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).portal.approvals };
}

/** Recently answered ones stay visible for a while; the page is about what is
 *  waiting, not a filing cabinet. */
const KEEP = 10;

/**
 * What the desk has asked this person to sign off.
 *
 * A requester can be named on a request — a budget holder, a data owner, the
 * manager whose team is being changed — and none of them can get into the desk
 * to answer. Without this page the request sits there and the phase it gates
 * never opens, which is the one failure mode of the whole feature.
 */
export default async function PortalApprovalsPage() {
  const user = await requireUser();

  // Two queries, because the two halves answer different questions and only
  // one of them has a ceiling. Taking thirty rows and splitting them afterwards
  // meant that somebody with thirty questions outstanding lost the record of
  // what they had already answered.
  const SELECT = {
    id: true,
    phase: true,
    question: true,
    comment: true,
    dueAt: true,
    state: true,
    requestedBy: { select: { name: true } },
    ticket: { select: { reference: true, title: true, description: true } },
  } as const;

  const [pending, recent, t] = await Promise.all([
    prisma.approval.findMany({
      where: { approverId: user.id, state: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: SELECT,
    }),
    // Withdrawn requests are not this person's business: nobody ever needed an
    // answer, so there is nothing for them to have done about it.
    prisma.approval.findMany({
      where: { approverId: user.id, state: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { decidedAt: "desc" },
      take: KEEP,
      select: SELECT,
    }),
    getMessages(),
  ]);

  const shape = (row: (typeof pending)[number]): PortalApproval => ({
    id: row.id,
    phase: row.phase,
    question: row.question,
    comment: row.comment,
    dueAt: row.dueAt,
    state: row.state,
    askedBy: row.requestedBy?.name ?? null,
    reference: row.ticket.reference,
    title: row.ticket.title,
    description: row.ticket.description,
  });

  const waiting = pending.map(shape);
  const answered = recent.map(shape);

  return (
    <div className="portal-wrap pb-14">
      <header className="pt-9 pb-[30px]">
        <h1 className="text-[36px] leading-[1.1] font-semibold tracking-[-0.035em]">
          {t.portal.approvals}
        </h1>
        <p className="text-text-2 mt-2.5 max-w-[60ch] text-[16px]">{t.portal.approvalsBlurb}</p>
      </header>

      <PortalApprovals approvals={[...waiting, ...answered]} />
    </div>
  );
}
