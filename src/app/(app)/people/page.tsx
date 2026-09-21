import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canCreatePeople, canViewDirectory, isStaff } from "@/lib/permissions";
import { describeHours } from "@/lib/clock";
import { getClock, getMessages } from "@/lib/settings";
import { NewPerson } from "./new-person";
import { PeopleTable, type Person } from "./people-table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.people.title };
}

/**
 * The directory: who is in the app and how to reach them. Nothing is changed
 * from here — a role or an account is altered on the person's own page, where
 * whoever is doing it can see exactly who they are doing it to.
 */
export default async function PeoplePage() {
  const user = await requireUser();
  if (!canViewDirectory(user)) notFound();

  const [people, roles, clock] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        department: true,
        jobTitle: true,
        isActive: true,
        avatarVariant: true,
        lastSeenAt: true,
        workDays: true,
        workStart: true,
        workEnd: true,
        role: { select: { name: true, isMaster: true, permissions: true } },
        teams: { select: { id: true, name: true, color: true } },
        // Assigned and still open. Counted in the same query as the row rather
        // than asked for per person, which would be one round trip per line.
        _count: { select: { assignedTickets: { where: { status: { is: { settles: false } } } } } },
      },
    }),
    canCreatePeople(user)
      ? prisma.role.findMany({
          orderBy: { position: "asc" },
          select: { id: true, name: true, isMaster: true },
        })
      : Promise.resolve([]),
    getClock(),
  ]);

  const rows: Person[] = people.map((person) => {
    // Their own hours where they have given them; otherwise the desk's stand
    // in, since it is the desk's clock that decides whether a reply now will be
    // read now. With neither, nothing is claimed and no dot is drawn.
    const hours = describeHours(
      person.workDays.length > 0
        ? {
            enabled: true,
            days: person.workDays,
            start: person.workStart,
            end: person.workEnd,
            timeZone: clock.hours.timeZone,
          }
        : clock.hours,
    );

    // A requester has no queue, so a count would be a nought that means
    // something other than "nothing to do".
    const agent = isStaff({
      id: person.id,
      isMaster: person.role.isMaster,
      permissions: person.role.permissions,
    });

    return {
      id: person.id,
      name: person.name,
      email: person.email,
      phone: person.phone,
      company: person.company,
      department: person.department,
      jobTitle: person.jobTitle,
      isActive: person.isActive,
      avatarVariant: person.avatarVariant,
      lastSeenAt: person.lastSeenAt,
      role: { name: person.role.name },
      teams: person.teams,
      inOffice: hours.open,
      isAgent: agent,
      open: agent ? person._count.assignedTickets : null,
    };
  });

  return (
    // One list of people is one object: it fills the work area with one sheet.
    <div className="sheet flex min-h-full flex-col">
      <PeopleTable
        people={rows}
        viewerId={user.id}
        action={
          canCreatePeople(user) ? <NewPerson roles={roles} canGrantMaster={user.isMaster} /> : null
        }
      />
    </div>
  );
}
