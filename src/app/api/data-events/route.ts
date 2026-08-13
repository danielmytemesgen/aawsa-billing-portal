import { NextResponse } from "next/server";
import { dataEventEmitter } from "../../../lib/data-event-emitter";

export const dynamic = "force-dynamic";

/**
 * GET /api/data-events
 *
 * Server-Sent Events endpoint.  The server pushes a "data-changed" event
 * whenever a key mutation (create/update/delete on bills, customers, readings,
 * payments, etc.) completes.  Connected clients immediately refresh their
 * in-memory data-store instead of waiting for the next poll tick.
 */
export async function GET(request: Request) {
  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(c) {
      controller = c;

      const send = (eventName: string, payload?: unknown) => {
        try {
          const line = payload
            ? `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`
            : `event: ${eventName}\ndata: {}\n\n`;
          controller.enqueue(new TextEncoder().encode(line));
        } catch {
          // controller already closed — ignore
        }
      };

      // Forward data-change events to this client
      const onDataChanged = (payload: { entity: string; ts: string }) => {
        send("data-changed", payload);
      };

      dataEventEmitter.on("data-changed", onDataChanged);

      // Heartbeat every 25 s to keep the connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      // Cleanup when client disconnects
      request.signal.addEventListener("abort", () => {
        dataEventEmitter.off("data-changed", onDataChanged);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
