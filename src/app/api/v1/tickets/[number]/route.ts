import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiUser, serializeTicket, TICKET_SELECT } from "@/lib/api";
import { canViewTicket } from "@/lib/permissions";
import { updateTicket } from "@/lib/actions/tickets";

type Params = { params: Promise<{ number: string }> };

function parseNumber(raw: string) {
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await apiUser();
  if (!auth.ok) return auth.response;

  const number = parseNumber((await params).number);
  if (!number) return apiError(404, "not_found", "No ticket with that number.");

  const ticket = await prisma.ticket.findUnique({
    where: { number },
    select: { reporterId: true, assigneeId: true, ...TICKET_SELECT },
  });

  if (!ticket || !canViewTicket(auth.user, ticket)) {
    return apiError(404, "not_found", "No ticket with that number.");
  }

  return NextResponse.json({ data: serializeTicket(ticket) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await apiUser();
  if (!auth.ok) return auth.response;

  const number = parseNumber((await params).number);
  if (!number) return apiError(404, "not_found", "No ticket with that number.");

  const ticket = await prisma.ticket.findUnique({
    where: { number },
    select: { id: true, reporterId: true, assigneeId: true },
  });

  if (!ticket || !canViewTicket(auth.user, ticket)) {
    return apiError(404, "not_found", "No ticket with that number.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "The request body is not valid JSON.");
  }

  // Same code path as the UI, so permission checks and the activity trail
  // cannot drift between the two entry points.
  const result = await updateTicket(ticket.id, body as never);
  if (!result.ok) return apiError(403, "forbidden", result.error);

  const updated = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticket.id },
    select: TICKET_SELECT,
  });

  return NextResponse.json({ data: serializeTicket(updated) });
}
