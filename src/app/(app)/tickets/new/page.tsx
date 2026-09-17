import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canEditCis, canEditTicket, isStaff, ticketVisibilityFilter } from "@/lib/permissions";
import { PageHeader } from "@/components/shell/page-header";
import { getMessages, getSettings } from "@/lib/settings";
import { NewTicketForm } from "./new-ticket-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.nav.newTicket };
}

/**
 * The ticket this one is being raised under, where the Links card sent somebody
 * here to raise it.
 *
 * Through the same visibility filter every other read uses, and only for people
 * who may write a link at all — a `?parent=` somebody typed must not confirm
 * that a ticket exists, let alone hand over its project and requester.
 */
async function parentOf(number: number | null, user: Awaited<ReturnType<typeof requireUser>>) {
  if (number === null || !canEditTicket(user)) return null;

  return prisma.ticket.findFirst({
    where: { number, mergedIntoId: null, ...ticketVisibilityFilter(user) },
    select: {
      id: true,
      number: true,
      reference: true,
      title: true,
      projectId: true,
      reporterId: true,
    },
  });
}

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();

  const params = await searchParams;
  const raw = params.parent;
  const asked = Number(Array.isArray(raw) ? raw[0] : raw);
  const parent = await parentOf(Number.isInteger(asked) && asked > 0 ? asked : null, user);

  // The asset Raise was pressed on. Looked up rather than trusted, and only for
  // people who may name assets at all — otherwise a `?ci=` somebody typed would
  // attach something they cannot see to a ticket they can.
  const wanted = params.ci;
  const ciId = (Array.isArray(wanted) ? wanted[0] : wanted)?.trim();
  const onAsset =
    ciId && canEditCis(user)
      ? await prisma.configurationItem.findUnique({
          where: { id: ciId },
          select: { id: true, name: true, type: { select: { name: true, color: true, icon: true } } },
        })
      : null;

  const [settings, t] = await Promise.all([getSettings(), getMessages()]);
  const [projects, milestones, roster, tags, plans] = await Promise.all([
    prisma.project.findMany({
      where: { isArchived: false },
      orderBy: { key: "asc" },
      select: { id: true, key: true, name: true },
    }),
    // Every open project's dated points, in one query. The form shows only the
    // ones belonging to whichever project is chosen — asking the server again
    // on every change of a dropdown would be a round trip for four rows.
    prisma.milestone.findMany({
      where: { reachedAt: null, project: { isArchived: false } },
      orderBy: [{ projectId: "asc" }, { position: "asc" }],
      select: { id: true, projectId: true, title: true },
    }),
    isStaff(user)
      ? prisma.user.findMany({
          where: { isActive: true },
          orderBy: [{ role: { position: "desc" } }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            role: { select: { name: true, isMaster: true, permissions: true } },
          },
        })
      : Promise.resolve([]),
    prisma.label.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    // Only plans that have something in them: an empty one would be a required
    // choice that changes nothing.
    prisma.changeTemplate.findMany({
      where: { steps: { some: {} } },
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { steps: true } },
      },
    }),
  ]);

  // Only people who work the queue can be assigned to one; anyone active can
  // be the requester.
  const agents = roster.filter(
    (person) => person.role.isMaster || person.role.permissions.includes("ticket.edit"),
  );

  return (
    <>
      <PageHeader eyebrow={t.newTicket.eyebrow} title={t.newTicket.title}>
        {t.newTicket.blurb}
      </PageHeader>

      <div className="px-5 py-6 lg:px-8">
        <NewTicketForm
          projects={projects}
          milestones={milestones}
          agents={agents}
          requesters={roster.map((person) => ({
            id: person.id,
            name: person.name,
            role: person.role.name,
          }))}
          tags={tags}
          plans={plans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            description: plan.description,
            steps: plan._count.steps,
          }))}
          viewerId={user.id}
          canTriage={isStaff(user)}
          canPickAssets={canEditCis(user)}
          onAsset={onAsset}
          parent={parent}
          defaults={{
            type: settings.defaultType,
            priority: settings.defaultPriority,
            // Under a parent, the child belongs where the parent does: a child
            // filed against a different project is one nobody working the
            // parent will ever see.
            projectId: parent?.projectId ?? settings.defaultProjectId,
          }}
        />
      </div>
    </>
  );
}
