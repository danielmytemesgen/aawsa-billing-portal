import { EventEmitter } from "events";

/**
 * Singleton EventEmitter for data-mutation events.
 * Survives Hot Module Replacement in development (same pattern as notification-emitter.ts).
 *
 * Usage (server actions):
 *   import { pushDataEvent } from "@/lib/data-event-emitter";
 *   // after a successful DB mutation:
 *   pushDataEvent("bills");
 */
const globalForEmitter = global as unknown as {
  dataEventEmitter: EventEmitter;
};

export const dataEventEmitter =
  globalForEmitter.dataEventEmitter || new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEmitter.dataEventEmitter = dataEventEmitter;
}

// Allow many concurrent SSE client listeners without warnings
dataEventEmitter.setMaxListeners(100);

/**
 * Push a data-changed event to all connected SSE clients.
 * Call this after any create / update / delete DB mutation.
 *
 * @param entity  A short name describing what changed, e.g. "bills", "customers"
 */
export function pushDataEvent(entity: string): void {
  dataEventEmitter.emit("data-changed", {
    entity,
    ts: new Date().toISOString(),
  });
}
