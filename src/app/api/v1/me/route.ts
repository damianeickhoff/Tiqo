import { NextResponse } from "next/server";
import { apiUser } from "@/lib/api";

export async function GET() {
  const auth = await apiUser();
  if (!auth.ok) return auth.response;

  return NextResponse.json({ data: auth.user });
}
