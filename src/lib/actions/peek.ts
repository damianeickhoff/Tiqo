"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { ProjectHealth } from "@/generated/prisma/enums";
import { canViewTicket, isStaff } from "@/lib/permissions";

export type TicketPeek = {
  number: number;
  reference: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: { name: string; color: string } | null;
  assignee: { name: string; avatarVariant: number } | null;
  comments: number;
};

/**
 * Enough of a ticket to read without opening it.
 *
 * Goes through the same visibility check the ticket page does: a preview that
 * skips it is a hole with a nicer shape than a page that skips it.
 */
export async function peekTicket(number: number): Promise<TicketPeek | null> {
  const user = await requireUser();

  const ticket = await prisma.ticket.findUnique({
    where: { number },
    select: {
      number: true,
      reference: true,
      title: true,
      description: true,
      priority: true,
      reporterId: true,
      assigneeId: true,
      status: { select: { name: true, color: true } },
      assignee: { select: { name: true, avatarVariant: true } },
      _count: { select: { comments: { where: { stepId: null } } } },
    },
  });

  if (!ticket || !canViewTicket(user, ticket)) return null;

  return {
    number: ticket.number,
    reference: ticket.reference,
    title: ticket.title,
    description: ticket.description,
    priority: ticket.priority,
    status: ticket.status,
    assignee: ticket.assignee,
    comments: ticket._count.comments,
  };
}

export type ProjectPeek = {
  key: string;
  name: string;
  health: ProjectHealth;
  lead: { name: string; avatarVariant: number } | null;
  settled: number;
  total: number;
};

/**
 * Enough of a project to recognise it without leaving what you were reading.
 *
 * Projects are a desk-side idea, so a requester who somehow follows a reference
 * to one gets the same nothing the project page would give them.
 */
export async function peekProject(key: string): Promise<ProjectPeek | null> {
  const user = await requireUser();
  if (!isStaff(user)) return null;

  const project = await prisma.project.findUnique({
    where: { key: key.toUpperCase() },
    select: {
      key: true,
      name: true,
      health: true,
      lead: { select: { name: true, avatarVariant: true } },
      tickets: { select: { status: { select: { settles: true } } } },
    },
  });
  if (!project) return null;

  return {
    key: project.key,
    name: project.name,
    health: project.health,
    lead: project.lead,
    settled: project.tickets.filter((ticket) => ticket.status?.settles).length,
    total: project.tickets.length,
  };
}

export type PersonPeek = {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarVariant: number;
  roleName: string;
  isActive: boolean;
  jobTitle: string | null;
  department: string | null;
  company: string | null;
  phone: string | null;
  teams: string[];
  /// Their working week, empty when they have not said.
  workDays: number[];
  workStart: number;
  workEnd: number;
  /// What they have open right now, on either side of the desk.
  openAssigned: number;
  openRaised: number;
};

/**
 * Everything about a person, without leaving the page you are on.
 *
 * A name on a ticket is read far more often than a profile is visited, and the
 * question behind the click is almost always "who is this, how do I reach
 * them" — not "show me their whole history". This answers that in place; the
 * page is still one click further on.
 *
 * Staff only: a requester reading their own ticket has no business being handed
 * a directory of the desk.
 */
export async function peekPerson(id: string): Promise<PersonPeek | null> {
  const viewer = await requireUser();
  if (!isStaff(viewer)) return null;

  const person = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      avatarVariant: true,
      isActive: true,
      jobTitle: true,
      department: true,
      company: true,
      phone: true,
      workDays: true,
      workStart: true,
      workEnd: true,
      role: { select: { name: true } },
      teams: { select: { name: true } },
      _count: {
        select: {
          assignedTickets: { where: { status: { is: { settles: false } } } },
          reportedTickets: { where: { status: { is: { settles: false } } } },
        },
      },
    },
  });
  if (!person) return null;

  return {
    id: person.id,
    name: person.name,
    username: person.username,
    email: person.email,
    avatarVariant: person.avatarVariant,
    roleName: person.role.name,
    isActive: person.isActive,
    jobTitle: person.jobTitle,
    department: person.department,
    company: person.company,
    phone: person.phone,
    teams: person.teams.map((team) => team.name),
    workDays: person.workDays,
    workStart: person.workStart,
    workEnd: person.workEnd,
    openAssigned: person._count.assignedTickets,
    openRaised: person._count.reportedTickets,
  };
}
