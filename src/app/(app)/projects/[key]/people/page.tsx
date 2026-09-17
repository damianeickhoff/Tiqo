import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageProjects, isStaff } from "@/lib/permissions";
import { getMessages } from "@/lib/settings";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { PersonLink } from "@/components/person-link";
import { ProjectRoster } from "@/components/projects/project-roster";
import { peopleOnProject } from "@/lib/project-people";

type Params = Promise<{ key: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [project, t] = await Promise.all([
    prisma.project.findUnique({
      where: { key: (await params).key.toUpperCase() },
      select: { name: true },
    }),
    getMessages(),
  ]);
  return { title: `${t.projects.people} · ${project?.name ?? ""}` };
}

/**
 * Who is on the project, and what each of them is carrying.
 *
 * A membership list on its own answers nothing. The count beside each name is
 * the reason anyone opens this page: to see where the work has piled up.
 */
export default async function ProjectPeoplePage({ params }: { params: Params }) {
  const user = await requireUser();
  if (!isStaff(user)) notFound();

  const { key } = await params;
  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    select: {
      id: true,
      leadId: true,
      members: { select: { id: true, name: true, avatarVariant: true, email: true } },
    },
  });
  if (!project) notFound();

  const [people, roster, t] = await Promise.all([
    // The same list the overview card shows: added members plus everyone
    // holding one of the project's tickets.
    peopleOnProject(project.id, project.leadId),
    canManageProjects(user)
      ? prisma.user.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, avatarVariant: true, email: true },
        })
      : Promise.resolve([]),
    getMessages(),
  ]);

  return (
    <div className="space-y-4 px-5 py-6 lg:px-8">
      {canManageProjects(user) ? (
        <ProjectRoster projectId={project.id} members={project.members} roster={roster} />
      ) : null}

      {people.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-text-3 text-md">{t.projects.noMembers}</p>
        </Card>
      ) : (
        <Card className="animate-rise overflow-hidden">
          <ul className="divide-border-soft divide-y">
            {people.map((person) => (
              <li key={person.id}>
                <div className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3.5 transition-colors">
                  <Avatar name={person.name} variant={person.avatarVariant} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <PersonLink
                        id={person.id}
                        name={person.name}
                        className="text-md truncate font-semibold"
                      />
                      {person.id === project.leadId ? (
                        <span className="text-brand-deep rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-xs font-semibold">
                          {t.projects.lead}
                        </span>
                      ) : null}
                      {/* Somebody who has work here but was never added. Named
                          so the difference between the two is visible without
                          splitting the list in two. */}
                      {person.isMember ? null : (
                        <span className="border-line text-text-3 rounded-full border px-2 py-0.5 text-xs font-medium">
                          {t.projects.byAssignment}
                        </span>
                      )}
                    </span>
                    <span className="text-text-3 block truncate font-mono text-sm">
                      {person.email}
                    </span>
                  </span>
                  <span className="tnum text-text-2 shrink-0 text-base">
                    {t.projects.ticketCount(person.open)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
