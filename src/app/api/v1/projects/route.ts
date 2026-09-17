import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/api";

export async function GET() {
  const auth = await apiUser();
  if (!auth.ok) return auth.response;

  const projects = await prisma.project.findMany({
    where: { isArchived: false },
    orderBy: { key: "asc" },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      color: true,
      _count: { select: { tickets: true } },
    },
  });

  return NextResponse.json({
    data: projects.map((project) => ({
      id: project.id,
      key: project.key,
      name: project.name,
      description: project.description,
      color: project.color,
      ticketCount: project._count.tickets,
    })),
  });
}
