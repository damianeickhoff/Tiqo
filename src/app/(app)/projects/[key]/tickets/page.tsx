import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageProjects, isStaff } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { Card, EmptyState, buttonClass } from "@/components/ui";
import { ProjectTicketList } from "@/components/projects/project-ticket-list";
import { ProjectTicketPicker } from "@/components/projects/project-ticket-picker";

type Params = Promise<{ key: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [project, t] = await Promise.all([
    prisma.project.findUnique({
      where: { key: (await params).key.toUpperCase() },
      select: { name: true },
    }),
    getMessages(),
  ]);
  return { title: `${t.projects.allWork} · ${project?.name ?? ""}` };
}

/** Everything filed against the project, newest first, in the same row the
 *  queue uses — so a ticket reads identically wherever it is met. */
export default async function ProjectTicketsPage({ params }: { params: Params }) {
  const user = await requireUser();
  if (!isStaff(user)) notFound();

  const { key } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    select: { id: true },
  });
  if (!project) notFound();

  const canManage = canManageProjects(user);

  const [tickets, milestones, candidates, t] = await Promise.all([
    prisma.ticket.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        number: true,
        reference: true,
        title: true,
        priority: true,
        type: true,
        createdAt: true,
        resolvedAt: true,
        closedAt: true,
        pausedMinutes: true,
        pausedSince: true,
        status: { select: { id: true, name: true, color: true, settles: true, pausesClock: true } },
        project: { select: { key: true, color: true } },
        assignee: { select: { id: true, name: true, avatarVariant: true } },
        labels: { select: { id: true, name: true, color: true } },
        steps: { select: { doneAt: true } },
        milestoneId: true,
      },
    }),
    // The points work can be filed under, so a row can be moved to one without
    // opening the ticket.
    prisma.milestone.findMany({
      where: { projectId: project.id },
      orderBy: { position: "asc" },
      select: { id: true, title: true },
    }),
    // What can be filed into it: whatever is already here, so it shows as
    // chosen and can be taken out again, plus whatever belongs to no project
    // yet. Moving work out of another project is a decision for that project,
    // not something to do by accident from a list.
    canManage
      ? prisma.ticket.findMany({
          where: { OR: [{ projectId: project.id }, { projectId: null }] },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: { id: true, reference: true, title: true, projectId: true },
        })
      : Promise.resolve([]),
    getMessages(),
  ]);

  const pickable = candidates.map((ticket) => ({
    id: ticket.id,
    reference: ticket.reference,
    title: ticket.title,
    inProject: ticket.projectId === project.id,
  }));

  return (
    <div className="space-y-4 px-5 py-6 lg:px-8">
      {canManage ? (
        <div className="flex justify-end">
          <ProjectTicketPicker projectId={project.id} candidates={pickable} />
        </div>
      ) : null}

      {tickets.length === 0 ? (
        <Card className="animate-rise p-10">
          <EmptyState
            title={t.projects.nothingFiled}
            body={t.projects.blurb}
            action={
              <Link href="/tickets/new" className={buttonClass("primary", "md")}>
                {t.nav.newTicket}
              </Link>
            }
          />
        </Card>
      ) : (
        <ProjectTicketList
          tickets={tickets.map((ticket) => ({
            id: ticket.id,
            number: ticket.number,
            reference: ticket.reference,
            title: ticket.title,
            priority: ticket.priority,
            status: ticket.status,
            assignee: ticket.assignee,
            milestoneId: ticket.milestoneId,
          }))}
          milestones={milestones}
          canManage={canManage}
        />
      )}
    </div>
  );
}
