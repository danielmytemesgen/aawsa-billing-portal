import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  const role = session?.roleName ?? session?.role ?? "unknown";
  return NextResponse.json({ role });
}
