import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canEditTicket, isStaff } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { ProjectBoard } from "@/components/projects/project-board";

type Params = Promise<{ key: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [project, t] = await Promise.all([
    prisma.project.findUnique({
      where: { key: (await params).key.toUpperCase() },
      select: { name: true },
    }),
    getMessages(),
  ]);
  return { title: `${t.projects.board} · ${project?.name ?? ""}` };
}

export default async function ProjectBoardPage({ params }: { params: Params }) {
  const user = await requireUser();
  if (!isStaff(user)) notFound();

  const { key } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    select: { id: true },
  });
  if (!project) notFound();

  const [columns, tickets, t] = await Promise.all([
    prisma.status.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.ticket.findMany({
      where: { projectId: project.id },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        number: true,
        reference: true,
        title: true,
        priority: true,
        statusId: true,
        assignee: { select: { name: true, avatarVariant: true } },
        milestone: { select: { title: true } },
      },
    }),
    getMessages(),
  ]);

  return (
    <div className="px-5 py-6 lg:px-8">
      <p className="text-text-3 mb-4 text-base">{t.projects.boardBlurb}</p>
      <ProjectBoard columns={columns} tickets={tickets} canEdit={canEditTicket(user)} />
    </div>
  );
}
