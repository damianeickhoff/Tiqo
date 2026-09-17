import "server-only";
import { prisma } from "@/lib/prisma";
/**
 * Everyone on a project: the people someone added, plus everyone actually
 * holding one of its tickets.
 *
 * One function so the overview card and the People tab cannot disagree. A list
 * kept only by hand goes stale the moment work is assigned, and a project page
 * that cannot name the person doing the work is the wrong page — so being
 * assigned something counts as being on it.
 *
 * Ordered the way the question is asked: whoever runs it, then whoever is
 * carrying the most, then by name.
 */
export async function peopleOnProject(projectId: string, leadId: string | null) {
  const [project, open] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        members: {
          select: { id: true, name: true, avatarVariant: true, email: true, jobTitle: true },
        },
        tickets: {
          where: { assigneeId: { not: null } },
          select: {
            assignee: {
              select: { id: true, name: true, avatarVariant: true, email: true, jobTitle: true },
            },
          },
        },
      },
    }),
    prisma.ticket.groupBy({
      by: ["assigneeId"],
      where: { projectId, status: { is: { settles: false } } },
      _count: { _all: true },
    }),
  ]);
  if (!project) return [];

  const carrying = new Map(open.map((row) => [row.assigneeId, row._count._all]));
  const byId = new Map(project.members.map((person) => [person.id, person]));
  for (const ticket of project.tickets) {
    if (ticket.assignee) byId.set(ticket.assignee.id, ticket.assignee);
  }

  return [...byId.values()]
    .map((person) => ({
      ...person,
      open: carrying.get(person.id) ?? 0,
      isMember: project.members.some((member) => member.id === person.id),
    }))
    .sort(
      (a, b) =>
        Number(b.id === leadId) - Number(a.id === leadId) ||
        b.open - a.open ||
        a.name.localeCompare(b.name),
    );
}

/**
 * How many people are on it, for the tab that says so.
 *
 * The same rule as the list — added members plus whoever holds a ticket — so
 * the number on the tab and the names behind it cannot disagree. Counted from
 * ids alone rather than by loading the people.
 */
export async function countPeopleOnProject(projectId: string) {
  const [members, assignees] = await Promise.all([
    prisma.user.findMany({
      where: { projects: { some: { id: projectId } } },
      select: { id: true },
    }),
    prisma.ticket.findMany({
      where: { projectId, assigneeId: { not: null } },
      select: { assigneeId: true },
      distinct: ["assigneeId"],
    }),
  ]);
  return new Set([...members.map((row) => row.id), ...assignees.map((row) => row.assigneeId!)])
    .size;
}
