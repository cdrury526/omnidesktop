import { buildToolUsageReport, type ToolUsageReport, type ToolUsageStateRow } from "../agent/tool-usage";
import { dbSelect } from "./db";
import type { EventRow } from "./events";

interface ConversationStateDbRow {
  conversation_id: number;
  state: string;
  updated_at: string;
}

export async function getToolUsageReport(
  options: { conversationId?: number | null; stateLimit?: number; eventLimit?: number } = {},
): Promise<ToolUsageReport> {
  const stateLimit = Math.max(1, Math.min(500, Math.round(options.stateLimit ?? 100)));
  const eventLimit = Math.max(1, Math.min(10_000, Math.round(options.eventLimit ?? 2_000)));
  const conversationId = options.conversationId ?? null;

  const states = conversationId == null
    ? await dbSelect<ConversationStateDbRow>(
      "SELECT conversation_id, state, updated_at FROM conversation_state " +
        "ORDER BY updated_at DESC LIMIT ?",
      [stateLimit],
    )
    : await dbSelect<ConversationStateDbRow>(
      "SELECT conversation_id, state, updated_at FROM conversation_state " +
        "WHERE conversation_id = ? ORDER BY updated_at DESC LIMIT ?",
      [conversationId, stateLimit],
    );

  const events = conversationId == null
    ? await dbSelect<EventRow>(
      "SELECT id, ts, source, type, conversation_id, data FROM (" +
        "SELECT id, ts, source, type, conversation_id, data FROM events ORDER BY id DESC LIMIT ?" +
        ") ORDER BY id ASC",
      [eventLimit],
    )
    : await dbSelect<EventRow>(
      "SELECT id, ts, source, type, conversation_id, data FROM (" +
        "SELECT id, ts, source, type, conversation_id, data FROM events " +
        "WHERE conversation_id = ? OR type LIKE 'code_tool.%' ORDER BY id DESC LIMIT ?" +
        ") ORDER BY id ASC",
      [conversationId, eventLimit],
    );

  const parsedStates: ToolUsageStateRow[] = states.map((row) => ({
    conversationId: row.conversation_id,
    updatedAt: row.updated_at,
    state: parseState(row.state),
  }));

  return buildToolUsageReport(parsedStates, events);
}

function parseState(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
