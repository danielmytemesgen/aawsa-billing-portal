import { NextResponse } from "next/server";

/**
 * GET /api/ping
 * Tiny latency probe used by the network-quality utility.
 * Returns a minimal JSON body — no DB, no auth.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
