import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError, apiUser, serializeTicket, TICKET_SELECT } from "@/lib/api";
import { canEditTicket, ticketVisibilityFilter } from "@/lib/permissions";
import { createTicketSchema, fieldErrors } from "@/lib/validation";
import { messagesFor } from "@/lib/i18n";
import { formatReference, referenceBucket } from "@/lib/tickets";

export async function GET(request: NextRequest) {
  const auth = await apiUser();
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const limit = Math.min(Number(params.get("limit") ?? 50) || 50, 200);
  const cursor = params.get("cursor");

  const where: Prisma.TicketWhereInput = {
    ...ticketVisibilityFilter(auth.user),
    ...(params.get("status") ? { status: params.get("status") as never } : {}),
    ...(params.get("priority") ? { priority: params.get("priority") as never } : {}),
    ...(params.get("project") ? { project: { key: params.get("project")! } } : {}),
    ...(params.get("updatedSince")
      ? { updatedAt: { gte: new Date(params.get("updatedSince")!) } }
      : {}),
  };

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { number: Number.parseInt(cursor, 10) }, skip: 1 } : {}),
    select: TICKET_SELECT,
  });

  const hasMore = tickets.length > limit;
  const page = hasMore ? tickets.slice(0, limit) : tickets;

  return NextResponse.json({
    data: page.map(serializeTicket),
    nextCursor: hasMore ? String(page[page.length - 1]!.number) : null,
  });
}

export async function POST(request: NextRequest) {
  const auth = await apiUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "The request body is not valid JSON.");
  }

  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_body",
          message: "Some fields are invalid.",
          // English regardless of the desk's language: an API contract that
          // changes wording when someone switches a setting is not a contract.
          fields: fieldErrors(parsed.error, messagesFor("en")),
        },
      },
      { status: 422 },
    );
  }

  const input = parsed.data;
  const assigneeId = canEditTicket(auth.user) ? input.assigneeId : null;

  const filedAt = new Date();
  const bucket = referenceBucket(input.type, filedAt);

  const created = await prisma.$transaction(async (tx) => {
    const [counter, sequence] = await Promise.all([
      tx.counter.upsert({
        where: { id: "ticket" },
        update: { value: { increment: 1 } },
        create: { id: "ticket", value: 1 },
        select: { value: true },
      }),
      tx.counter.upsert({
        where: { id: bucket.key },
        update: { value: { increment: 1 } },
        create: { id: bucket.key, value: 1 },
        select: { value: true },
      }),
    ]);

    const ticket = await tx.ticket.create({
      data: {
        number: counter.value,
        reference: formatReference(input.type, filedAt, sequence.value),
        title: input.title,
        description: input.description,
        priority: input.priority,
        type: input.type,
        projectId: input.projectId,
        reporterId: auth.user.id,
        createdById: auth.user.id,
        assigneeId,
        dueDate: input.dueDate,
        labels: { connect: input.labelIds.map((id) => ({ id })) },
      },
      select: { id: true, ...TICKET_SELECT },
    });

    await tx.activity.create({
      data: { ticketId: ticket.id, actorId: auth.user.id, type: "CREATED" },
    });

    return ticket;
  });

  return NextResponse.json({ data: serializeTicket(created) }, { status: 201 });
}
