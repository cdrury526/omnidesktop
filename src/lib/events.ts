/**
 * Persistent, source-attributed event log — the timeline `conversation_state`
 * and `form_events` don't give us. Fire-and-forget: logging must never throw
 * into or block the caller. Read it back via the debug bridge's `/events`.
 *
 * The `source` is the point: it separates the user's actions from the debug
 * bridge's pokes from the agent's own machinery (queue flush, self-repair), so
 * a "weird thing happened" can actually be reconstructed.
 */
import { dbExecute, dbSelect } from "./db";

export type EventSource = "user" | "debug-bridge" | "queue" | "repair" | "system";

export interface EventInput {
  source: EventSource;
  type: string;
  conversationId?: number | null;
  data?: unknown;
}

export function logEvent(e: EventInput): void {
  void dbExecute(
    "INSERT INTO events(source, type, conversation_id, data) VALUES(?, ?, ?, ?)",
    [e.source, e.type, e.conversationId ?? null, e.data === undefined ? null : safeJson(e.data)],
  ).catch(() => {
    /* best-effort; never surface logging failures */
  });
}

export interface EventRow {
  id: number;
  ts: string;
  source: string;
  type: string;
  conversation_id: number | null;
  data: string | null;
}

/** Most recent events with id greater than `sinceId` (newest first). */
export async function getEvents(sinceId = 0, limit = 500): Promise<EventRow[]> {
  return dbSelect<EventRow>(
    "SELECT id, ts, source, type, conversation_id, data FROM events WHERE id > ? ORDER BY id DESC LIMIT ?",
    [sinceId, limit],
  );
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Install global handlers so swallowed errors persist instead of vanishing. */
export function installErrorCapture(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    logEvent({ source: "system", type: "uncaught", data: { message: e.message, source: e.filename, line: e.lineno } });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    // Cancelling a turn (result.cancel()) frees the in-flight Tauri http
    // response resource mid-stream; a pending read inside the SDK then rejects
    // with "resource id … is invalid". Benign artifact of the abort — swallow it.
    if (/resource id \d+ is invalid/i.test(message)) {
      e.preventDefault();
      return;
    }
    logEvent({
      source: "system",
      type: "unhandledrejection",
      data: { message, stack: reason instanceof Error ? reason.stack : undefined },
    });
  });
}
