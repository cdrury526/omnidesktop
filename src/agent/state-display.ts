import { LEAKED_TOOLCALL_RE } from "./toolcall-leak";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export interface PendingCall {
  callId: string;
  name: string;
  args: Record<string, unknown>;
}

export type DisplayItem =
  | { kind: "msg"; role: "user" | "assistant"; content: string }
  | {
      kind: "tool";
      callId: string;
      name: string;
      status: "pending" | "done" | "error" | "cancelled";
      args?: unknown;
      result?: string;
    };

export function pendingHitlCall(state: unknown): PendingCall | null {
  const s = state as { status?: string; pendingToolCalls?: unknown[] } | null;
  if (!s || s.status !== "awaiting_hitl") return null;
  const c = s.pendingToolCalls?.[0] as
    | { id?: string; callId?: string; name?: string; arguments?: unknown }
    | undefined;
  if (!c) return null;
  return {
    callId: (c.id ?? c.callId) as string,
    name: c.name ?? "",
    args: (c.arguments ?? {}) as Record<string, unknown>,
  };
}

function itemText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (b && typeof (b as { text?: unknown }).text === "string" ? (b as { text: string }).text : ""))
      .join("")
      .trim();
  }
  return "";
}

function callIdOf(item: Record<string, unknown>): string {
  return (item.call_id ?? item.callId ?? "") as string;
}

function stripLeakedToolCall(text: string): string {
  const m = LEAKED_TOOLCALL_RE.exec(text);
  return m ? text.slice(0, m.index).trimEnd() : text;
}

export function displayItemsFromState(state: unknown): DisplayItem[] {
  const messages = (state as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages)) return [];

  const out: DisplayItem[] = [];
  const cardByCall = new Map<string, Extract<DisplayItem, { kind: "tool" }>>();

  for (const raw of messages) {
    const item = raw as Record<string, unknown>;
    const type = item.type as string | undefined;
    const role = item.role as string | undefined;

    if (type === "function_call") {
      const rawArgs = item.arguments ?? item.args;
      let args: unknown = rawArgs;
      if (typeof rawArgs === "string") {
        try { args = JSON.parse(rawArgs); } catch { args = rawArgs; }
      }
      const card: Extract<DisplayItem, { kind: "tool" }> = {
        kind: "tool",
        callId: callIdOf(item),
        name: (item.name as string) ?? "tool",
        status: "pending",
        args,
      };
      cardByCall.set(card.callId, card);
      out.push(card);
      continue;
    }

    if (type === "function_call_output") {
      const card = cardByCall.get(callIdOf(item));
      if (card) {
        const output = typeof item.output === "string" ? item.output : JSON.stringify(item.output);
        card.result = output;
        card.status = output.includes('"cancelled"')
          ? "cancelled"
          : output.includes('"error"')
            ? "error"
            : "done";
      }
      continue;
    }

    if (role === "user" || role === "assistant") {
      const raw = itemText(item.content);
      const text = role === "assistant" ? stripLeakedToolCall(raw) : raw;
      if (text) out.push({ kind: "msg", role, content: text });
    }
  }
  return out;
}

export function chatMsgsFromState(state: unknown): ChatMsg[] {
  return displayItemsFromState(state)
    .filter((i): i is Extract<DisplayItem, { kind: "msg" }> => i.kind === "msg")
    .map(({ role, content }) => ({ role, content }));
}

export function toolCardsFromState(
  state: unknown,
): Array<{ callId: string; name: string; status: string; result?: string }> {
  return displayItemsFromState(state)
    .filter((i): i is Extract<DisplayItem, { kind: "tool" }> => i.kind === "tool")
    .map(({ callId, name, status, result }) => ({ callId, name, status, result }));
}

const TOOL_DETAIL_MAX = 300;

export function toolResultDetail(result: string | undefined): string | undefined {
  if (!result) return undefined;
  let msg = result;
  try {
    const o = JSON.parse(result) as Record<string, unknown>;
    if (o && typeof o === "object") {
      const parts: string[] = [];
      if (o.error != null) parts.push(`error: ${String(o.error)}`);
      if (o.reason != null) parts.push(`reason: ${String(o.reason)}`);
      const issues = o.issues;
      if (Array.isArray(issues) && issues.length) {
        const summary = issues
          .map((i) => {
            const it = i as { message?: unknown; path?: unknown };
            return it?.message ?? it?.path ?? JSON.stringify(i);
          })
          .join("; ");
        parts.push(`issues: ${summary}`);
      }
      if (parts.length) msg = parts.join(" | ");
    }
  } catch {
    // Not JSON; use it as-is.
  }
  return msg.length > TOOL_DETAIL_MAX ? `${msg.slice(0, TOOL_DETAIL_MAX)}…` : msg;
}
