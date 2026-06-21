/**
 * The agent loop, built on the OpenRouter agent SDK.
 *
 * Most MCP tools become an SDK `tool()` whose `execute` runs the real MCP call.
 * Tools flagged interactive (`_meta[INTERACTIVE_TOOL_META]`, e.g. the forms
 * server's `request_user_input`) instead become **HITL tools**: `onToolCalled`
 * validates the form spec (returning the issues if it's malformed, so the model
 * self-corrects), otherwise renders the panel and returns `null` to PAUSE the
 * loop (`status: 'awaiting_hitl'`). When the user submits, the host calls
 * `resumeTurn` with a `function_call_output` and the SDK continues — see
 * `App.tsx`. All of this rides on the DB-backed `StateAccessor`, so a pause
 * survives a reload.
 */
import { OpenRouter, tool, stepCountIs } from "@openrouter/agent";
import { HTTPClient } from "@openrouter/sdk";
import { z } from "zod";
import { INTERACTIVE_TOOL_META, validateSpec } from "@omni/forms-dsl";
import { appFetch } from "../lib/tauri-fetch";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  callTool,
  hasAppHtml,
  type ServerInfo,
  type ToolCallInfo,
} from "../mcp/host-bridge";
import { objectToZod } from "./json-schema-to-zod";

export type ChatMsg = { role: "user" | "assistant"; content: string };

function mcpResultToText(r: CallToolResult): string {
  const text = (r.content ?? [])
    .map((c) => (c.type === "text" ? c.text : `[${c.type}]`))
    .join("\n")
    .trim();
  return text || (r.isError ? "Tool returned an error." : "Tool completed.");
}

export type McpTools = ReturnType<typeof buildMcpTools>;

function isInteractive(meta: unknown): boolean {
  return !!meta && typeof meta === "object" &&
    !!(meta as Record<string, unknown>)[INTERACTIVE_TOOL_META];
}

export function buildMcpTools(
  server: ServerInfo,
  onAutoSummon: (info: ToolCallInfo) => void,
) {
  return Array.from(server.tools.values()).map((t) => {
    const inputSchema = objectToZod(t.inputSchema as never);
    const description = t.description ?? t.title ?? t.name;

    // Interactive tool → HITL. The real result is the user's submission, which
    // arrives later via `resumeTurn`; here we only validate + render + pause.
    if (isInteractive(t._meta)) {
      return tool({
        name: t.name,
        description,
        inputSchema,
        outputSchema: z.unknown(),
        onToolCalled: async (params: Record<string, unknown>) => {
          const check = validateSpec(params);
          if (!check.ok) {
            // Auto-resolve with the issues; the model fixes the spec and retries.
            return { error: "invalid_form_spec", issues: check.issues };
          }
          const info = callTool(server, t.name, params ?? {});
          if (hasAppHtml(info)) onAutoSummon(info);
          return null; // pause — await the user's input
        },
      });
    }

    return tool({
      name: t.name,
      description,
      inputSchema,
      execute: async (params: Record<string, unknown>) => {
        const info = callTool(server, t.name, params ?? {});
        // Auto-summon: a UI tool slides the pane out immediately.
        if (hasAppHtml(info)) onAutoSummon(info);
        // The same result promise feeds both the pane and the model.
        const result = await info.resultPromise;
        return mcpResultToText(result);
      },
    });
  });
}

const SYSTEM_PROMPT =
  "You are a helpful desktop assistant running in a native app. You can call " +
  "tools provided by connected MCP servers. Some tools open an interactive UI " +
  "panel beside the chat (forms, dropdowns, pickers); prefer them over asking " +
  "for structured input in prose. After opening such a panel, briefly tell the " +
  "user to fill it in — do not invent their answers; you will receive the " +
  "submitted values as the tool result. If a tool result says the user " +
  "cancelled, acknowledge it briefly and move on; don't reopen the form unless " +
  "they ask.";

/**
 * Persistence seam for the SDK's `ConversationState`. Matches the SDK's
 * `StateAccessor` shape; `conversationStateAccessor` in `lib/db.ts` is the
 * DB-backed implementation. `unknown` here keeps the runner DB-agnostic — the
 * SDK round-trips its own state object through `load`/`save` untouched.
 */
export interface StateStore {
  load: () => Promise<unknown | null>;
  save: (state: unknown) => Promise<void>;
}

function makeClient(apiKey: string): OpenRouter {
  // Route HTTP through Rust (Tauri http plugin) to avoid webview CORS.
  return new OpenRouter({
    apiKey,
    httpClient: new HTTPClient({ fetcher: appFetch as never }),
  });
}

async function streamText(
  result: { getTextStream: () => AsyncIterable<string> },
  onTextDelta: (delta: string) => void,
): Promise<string> {
  let full = "";
  for await (const delta of result.getTextStream()) {
    full += delta;
    onTextDelta(delta);
  }
  return full;
}

export interface RunTurnArgs {
  apiKey: string;
  model: string;
  /** The new user message for this turn. Prior history lives in `state`. */
  userText: string;
  /** DB-backed SDK state: rehydrates history (incl. tool turns) and persists it. */
  state: StateStore;
  tools: McpTools;
  onTextDelta: (delta: string) => void;
}

/** Run one user turn; streams assistant text via onTextDelta, returns full text. */
export async function runTurn({
  apiKey,
  model,
  userText,
  state,
  tools,
  onTextDelta,
}: RunTurnArgs): Promise<string> {
  const or = makeClient(apiKey);
  const result = or.callModel({
    model,
    instructions: SYSTEM_PROMPT,
    // Only the new message is "fresh" input; the SDK prepends prior history
    // from `state` (including function_call / function_call_output items) and
    // saves the response output + tool results back after each turn.
    input: [{ role: "user", content: userText }] as never,
    state: state as never,
    tools,
    stopWhen: stepCountIs(8),
    allowFinalResponse: true,
  });
  return streamText(result, onTextDelta);
}

export interface ResumeTurnArgs {
  apiKey: string;
  model: string;
  /** The paused tool call's id (from `pendingHitlCall`). */
  callId: string;
  /** The (already host-validated) value to feed back as that tool's result. */
  output: unknown;
  state: StateStore;
  tools: McpTools;
  onTextDelta: (delta: string) => void;
}

/** Resume a HITL-paused conversation by supplying a paused call's result. */
export async function resumeTurn({
  apiKey,
  model,
  callId,
  output,
  state,
  tools,
  onTextDelta,
}: ResumeTurnArgs): Promise<string> {
  const or = makeClient(apiKey);
  const result = or.callModel({
    model,
    instructions: SYSTEM_PROMPT,
    input: [
      { type: "function_call_output", callId, output: JSON.stringify(output) },
    ] as never,
    state: state as never,
    tools,
    stopWhen: stepCountIs(8),
    allowFinalResponse: true,
  });
  return streamText(result, onTextDelta);
}

// ---- reading persisted state for the UI ----

export interface PendingCall {
  callId: string;
  name: string;
  args: Record<string, unknown>;
}

/** If the conversation is paused awaiting user input, the call to resolve. */
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

/** A rendered chat item: a text bubble, or a tool-call card. */
export type DisplayItem =
  | { kind: "msg"; role: "user" | "assistant"; content: string }
  | {
      kind: "tool";
      callId: string;
      name: string;
      status: "pending" | "done" | "error" | "cancelled";
    };

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

/**
 * Full transcript from persisted state: user/assistant bubbles plus a card for
 * each tool call (resolved to done/error/pending by its matching output).
 */
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
      const card: Extract<DisplayItem, { kind: "tool" }> = {
        kind: "tool",
        callId: callIdOf(item),
        name: (item.name as string) ?? "tool",
        status: "pending",
      };
      cardByCall.set(card.callId, card);
      out.push(card);
      continue;
    }
    if (type === "function_call_output") {
      const card = cardByCall.get(callIdOf(item));
      if (card) {
        const output = typeof item.output === "string" ? item.output : JSON.stringify(item.output);
        card.status = output.includes('"cancelled"')
          ? "cancelled"
          : output.includes('"error"')
            ? "error"
            : "done";
      }
      continue;
    }
    if (role === "user" || role === "assistant") {
      const text = itemText(item.content);
      if (text) out.push({ kind: "msg", role, content: text });
    }
  }
  return out;
}

/** Back-compat: just the text bubbles (used where cards aren't wanted). */
export function chatMsgsFromState(state: unknown): ChatMsg[] {
  return displayItemsFromState(state)
    .filter((i): i is Extract<DisplayItem, { kind: "msg" }> => i.kind === "msg")
    .map(({ role, content }) => ({ role, content }));
}
