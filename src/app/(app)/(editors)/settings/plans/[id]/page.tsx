import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { APPROVER_ROLE_FILTER, can, canOpenSettings } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { PlanEditor } from "@/components/settings/plan-editor";

type Params = Promise<{ id: string }>;

/// Enough to fill the card without becoming a second queue; the count beside
/// the title says how many there really are.
const USES_SHOWN = 6;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const plan = await prisma.changeTemplate.findUnique({
    where: { id: (await params).id },
    select: { name: true },
  });
  return { title: plan ? plan.name : (await getMessages()).plan.templatesTitle };
}

/**
 * One plan, with the whole width to lay it out in.
 *
 * It sits in the `(editors)` group for the same reason the form designer does:
 * a phase strip, a dense table and an inspector squeezed beside a 220px
 * side-nav is the version of this nobody could use. Leaving that layout leaves
 * its gates behind too, so both are run here.
 */
export default async function PlanEditorPage({ params }: { params: Params }) {
  const user = await requireUser();
  if (!canOpenSettings(user) || !can(user, "settings.tickets")) notFound();

  const { id } = await params;

  const [plan, people, teams, approvers, usedBy, usedCount] = await Promise.all([
    prisma.changeTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        approverId: true,
        defaultAssigneeId: true,
        phases: {
          orderBy: { position: "asc" },
          select: { id: true, name: true, approverId: true },
        },
        steps: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            phaseId: true,
            dueDays: true,
            assigneeId: true,
            teamId: true,
            estimateMinutes: true,
            blocksPhase: true,
            skipNeedsReason: true,
            dependsOnId: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { OR: [{ isMaster: true }, { permissions: { has: "ticket.edit" } }] },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, avatarVariant: true },
    }),
    prisma.team.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: APPROVER_ROLE_FILTER,
      orderBy: { name: "asc" },
      select: { id: true, name: true, avatarVariant: true },
    }),
    // Newest first: the question the card answers is "is this plan still being
    // used", and the last change to get it is the one that says so.
    prisma.ticket.findMany({
      where: { templateId: id },
      orderBy: { createdAt: "desc" },
      take: USES_SHOWN,
      select: {
        number: true,
        reference: true,
        title: true,
        status: { select: { id: true, name: true, color: true, settles: true } },
      },
    }),
    prisma.ticket.count({ where: { templateId: id } }),
  ]);

  if (!plan) notFound();

  return (
    <PlanEditor
      plan={plan}
      people={people}
      teams={teams}
      approvers={approvers}
      usedBy={usedBy}
      usedCount={usedCount}
    />
  );
}
