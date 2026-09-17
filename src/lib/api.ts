import "server-only";

import { NextResponse } from "next/server";
import { getCurrentUser, type SessionUser } from "@/lib/auth";

/**
 * `/api/v1` is the boundary every future integration goes through — the TOPdesk
 * sync included — so it is versioned and shaped independently of the UI from
 * day one. Today it authenticates with the same session cookie the app uses;
 * machine-to-machine tokens are the next thing this file grows.
 */
export async function apiUser(): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "unauthenticated", message: "Sign in first." } },
        { status: 401 },
      ),
    };
  }
  return { ok: true, user };
}

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

type TicketRecord = {
  number: number;
  reference: string;
  title: string;
  description: string;
  status: { name: string } | null;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  dueDate: Date | null;
  externalSource: string | null;
  externalId: string | null;
  project: { key: string; name: string } | null;
  reporter: { name: string; email: string };
  assignee: { name: string; email: string } | null;
  labels: { name: string }[];
};

/** One place that decides the public shape of a ticket, so the API contract
 *  does not drift every time the Prisma selection changes. */
export function serializeTicket(ticket: TicketRecord) {
  return {
    number: ticket.number,
    reference: ticket.reference,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status?.name ?? null,
    priority: ticket.priority,
    project: ticket.project ? { key: ticket.project.key, name: ticket.project.name } : null,
    reporter: ticket.reporter,
    assignee: ticket.assignee,
    labels: ticket.labels.map((l) => l.name),
    dueDate: ticket.dueDate?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    external: ticket.externalSource
      ? { source: ticket.externalSource, id: ticket.externalId }
      : null,
  };
}

export const TICKET_SELECT = {
  number: true,
  reference: true,
  title: true,
  description: true,
  status: { select: { name: true } },
  priority: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  closedAt: true,
  dueDate: true,
  externalSource: true,
  externalId: true,
  project: { select: { key: true, name: true } },
  reporter: { select: { name: true, email: true } },
  assignee: { select: { name: true, email: true } },
  labels: { select: { name: true } },
} as const;
