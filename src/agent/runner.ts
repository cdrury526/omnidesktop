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

/**
 * The tool cards in a persisted state, each carrying the SDK `callId` — used to
 * emit tool.call/tool.result events that reference the exact `function_call`
 * item in `ConversationState`. (Reliable: read from persisted state, not the
 * SDK execute context, which isn't populated for HITL tools.)
 */
export function toolCardsFromState(
  state: unknown,
): Array<{ callId: string; name: string; status: string; result?: string }> {
  return displayItemsFromState(state)
    .filter((i): i is Extract<DisplayItem, { kind: "tool" }> => i.kind === "tool")
    .map(({ callId, name, status, result }) => ({ callId, name, status, result }));
}

/** Max length of the diagnostic detail attached to a tool.result event. */
const TOOL_DETAIL_MAX = 300;

/**
 * A concise, truncated summary of a resolved tool's output — attached to the
 * `tool.result` event so a failure is diagnosable from the event log alone,
 * without joining back to `conversation_state` by callId. Pulls `error` /
 * `reason` / `issues` out of structured outputs; falls back to the raw text.
 */
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
    // Not JSON (e.g. a plain tool text result) — use it as-is.
  }
  return msg.length > TOOL_DETAIL_MAX ? `${msg.slice(0, TOOL_DETAIL_MAX)}…` : msg;
}

const SYSTEM_PROMPT =
  "You are a helpful desktop assistant running in a native app. You can call " +
  "tools provided by connected MCP servers. Some tools open an interactive UI " +
  "panel beside the chat (forms, dropdowns, pickers).\n\n" +
  "CRITICAL RULE: when you need structured input from the user — anything you'd " +
  "otherwise collect by listing questions — you MUST call the appropriate tool " +
  "(e.g. `request_user_input`) in the SAME turn. Do NOT describe a form, say " +
  "you'll show one, or list the fields in prose: actually emit the tool call. " +
  "Describing instead of calling is a failure.\n\n" +
  "Example — user: \"sign me up\" → you immediately call request_user_input with " +
  "the fields (name, email, plan, …). You do not write \"Sure, let me pull up a " +
  "form\"; you call the tool.\n\n" +
  "After a form opens, briefly tell the user to fill it in — never invent their " +
  "answers; you receive the submitted values as the tool result. If a result " +
  "says the user cancelled, acknowledge briefly and move on.";

/**
 * Build the turn instructions, appending a Code-mode section when a working
 * folder is bound to the conversation. There are no file-access tools yet — the
 * section only grounds the model in the project root; it must not claim to have
 * read or written files.
 */
function instructionsFor(workingDir?: string): string {
  if (!workingDir) return SYSTEM_PROMPT;
  return (
    SYSTEM_PROMPT +
    "\n\n## Code mode\n" +
    "You are in code mode for a software project. The working folder for this " +
    `session is \`${workingDir}\`. Treat it as the project root: when the user ` +
    'says "the project", "this repo", or names files without an absolute path, ' +
    "resolve them relative to that folder. You do NOT have file-access tools " +
    "yet, so do not claim to have read, listed, or written any files — reason " +
    "from what the user tells you and ask for file contents when you need them."
  );
}

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

/** Wire an external abort signal to the SDK's cooperative `result.cancel()`. */
function wireAbort(result: { cancel: () => Promise<void> }, signal?: AbortSignal): void {
  if (!signal) return;
  if (signal.aborted) void result.cancel();
  else signal.addEventListener("abort", () => void result.cancel(), { once: true });
}

/**
 * Thrown when a model streams its *raw tool-call template* into the text channel
 * instead of emitting a structured tool call. Some models (seen with certain
 * DeepSeek variants on OpenRouter) do this and then loop, flooding the
 * transcript and wedging the app — so we stop the turn the instant we see it.
 */
export class LeakedToolCallError extends Error {
  constructor() {
    super("The model streamed a raw tool-call template instead of calling the tool.");
    this.name = "LeakedToolCallError";
  }
}

// The unmistakable signature of a leaked native tool-call template. The
// fullwidth pipe `｜` (U+FF5C) opener (`<｜tool▁calls▁begin｜>`, `<｜DSML｜…>`)
// never appears in legitimate prose; the ASCII `<|tool…|` / `<|im_start|` chat
// markers are the other common leak. Matching either lets us bail on the first
// token rather than after the model has looped.
const LEAKED_TOOLCALL_RE = /<｜|<\|(?:tool|assistant|im_start|channel|dsml)/i;

async function streamText(
  result: { getTextStream: () => AsyncIterable<string>; cancel?: () => Promise<void> },
  onTextDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  let full = "";
  try {
    for await (const delta of result.getTextStream()) {
      full += delta;
      onTextDelta(delta);
      // Bail the moment a raw tool-call template appears — cancel server-side so
      // the model stops generating, then surface a clean error to the caller.
      if (LEAKED_TOOLCALL_RE.test(full)) {
        await result.cancel?.().catch(() => {});
        throw new LeakedToolCallError();
      }
    }
  } catch (e) {
    if (e instanceof LeakedToolCallError) throw e;
    // A cancelled turn ends the stream abruptly — treat it as a clean stop and
    // return whatever streamed so far; only real failures propagate.
    if (signal?.aborted) return full;
    throw e;
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
  /** Abort the in-flight turn (cooperative — calls the SDK's `result.cancel()`). */
  signal?: AbortSignal;
  /** Code mode: the conversation's working folder, injected into the prompt. */
  workingDir?: string;
}

/** Run one user turn; streams assistant text via onTextDelta, returns full text. */
export async function runTurn({
  apiKey,
  model,
  userText,
  state,
  tools,
  onTextDelta,
  signal,
  workingDir,
}: RunTurnArgs): Promise<string> {
  const or = makeClient(apiKey);
  const result = or.callModel({
    model,
    instructions: instructionsFor(workingDir),
    // Only the new message is "fresh" input; the SDK prepends prior history
    // from `state` (including function_call / function_call_output items) and
    // saves the response output + tool results back after each turn.
    input: [{ role: "user", content: userText }] as never,
    state: state as never,
    tools,
    stopWhen: stepCountIs(8),
    allowFinalResponse: true,
  });
  wireAbort(result, signal);
  return streamText(result, onTextDelta, signal);
}

export interface OpenFormArgs {
  apiKey: string;
  model: string;
  /** The DSL form spec to open. */
  spec: unknown;
  /** Tool name to force (defaults to the forms tool). */
  toolName?: string;
  state: StateStore;
  tools: McpTools;
  onTextDelta: (delta: string) => void;
}

/**
 * Deterministically open a form: force the model to call the forms tool with the
 * given spec (`tool_choice`), so it can't answer in prose. Demonstrates the
 * tool-forcing guardrail and powers the debug bridge's `/openform`.
 */
export async function openForm({
  apiKey,
  model,
  spec,
  toolName = "request_user_input",
  state,
  tools,
  onTextDelta,
}: OpenFormArgs): Promise<string> {
  const or = makeClient(apiKey);
  const result = or.callModel({
    model,
    instructions: SYSTEM_PROMPT,
    input: [
      {
        role: "user",
        content:
          `Call the \`${toolName}\` tool now with exactly these arguments ` +
          `(verbatim JSON, do not change them): ${JSON.stringify(spec)}`,
      },
    ] as never,
    state: state as never,
    tools,
    toolChoice: { type: "function", name: toolName } as never,
    stopWhen: stepCountIs(2),
  });
  return streamText(result, onTextDelta);
}

// Self-repair: when the model *describes* showing a form instead of emitting the
// tool call (a known intermittent failure on some models), we detect it and
// re-prompt with the tool forced. Conservative on purpose — both an action
// phrase AND a form/input noun must be present, or we don't intervene.
const ACTION_INTENT_RE = /\b(i'?ll|i will|let me|i can|here'?s|going to|one moment|pop (it|that) up)\b/i;
const FORM_INTENT_RE = /\b(form|fill (it|this|that|in)|details|sign[ -]?up|sign you up|subscri|collect|fields?|below)\b/i;

/** True if the last assistant turn promised a form but no tool call happened. */
export function describedButDidntCall(state: unknown): boolean {
  const items = displayItemsFromState(state);
  const last = items[items.length - 1];
  if (!last || last.kind !== "msg" || last.role !== "assistant") return false;
  return ACTION_INTENT_RE.test(last.content) && FORM_INTENT_RE.test(last.content);
}

export interface RepairArgs {
  apiKey: string;
  model: string;
  toolName?: string;
  state: StateStore;
  tools: McpTools;
  onTextDelta: (delta: string) => void;
  signal?: AbortSignal;
  /** Code mode: the conversation's working folder, injected into the prompt. */
  workingDir?: string;
}

/** Re-prompt the model with the tool forced, after it described instead of calling. */
export async function repairToolCall({
  apiKey,
  model,
  toolName = "request_user_input",
  state,
  tools,
  onTextDelta,
  signal,
  workingDir,
}: RepairArgs): Promise<string> {
  const or = makeClient(apiKey);
  const result = or.callModel({
    model,
    instructions: instructionsFor(workingDir),
    // A developer message — not shown in the transcript (display only renders
    // user/assistant) — nudges; tool_choice forces the call.
    input: [
      {
        role: "developer",
        content: `You described showing a form but did not call the tool. Call \`${toolName}\` now with the fields you described.`,
      },
    ] as never,
    state: state as never,
    tools,
    toolChoice: { type: "function", name: toolName } as never,
    stopWhen: stepCountIs(2),
  });
  wireAbort(result, signal);
  return streamText(result, onTextDelta, signal);
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
  signal?: AbortSignal;
  /** Code mode: the conversation's working folder, injected into the prompt. */
  workingDir?: string;
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
  signal,
  workingDir,
}: ResumeTurnArgs): Promise<string> {
  const or = makeClient(apiKey);
  const result = or.callModel({
    model,
    instructions: instructionsFor(workingDir),
    input: [
      { type: "function_call_output", callId, output: JSON.stringify(output) },
    ] as never,
    state: state as never,
    tools,
    stopWhen: stepCountIs(8),
    allowFinalResponse: true,
  });
  wireAbort(result, signal);
  return streamText(result, onTextDelta, signal);
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
      /** Raw call arguments (e.g. the form spec), for the expandable detail. */
      args?: unknown;
      /** Raw tool output once resolved, for the expandable detail. */
      result?: string;
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
 * Strip a leaked tool-call template tail from assistant text, so a reload of a
 * conversation where a model dumped its raw tool syntax shows clean prose (the
 * live guard cancels early, but a partial may still have been persisted).
 */
function stripLeakedToolCall(text: string): string {
  const m = LEAKED_TOOLCALL_RE.exec(text);
  return m ? text.slice(0, m.index).trimEnd() : text;
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

/** Back-compat: just the text bubbles (used where cards aren't wanted). */
export function chatMsgsFromState(state: unknown): ChatMsg[] {
  return displayItemsFromState(state)
    .filter((i): i is Extract<DisplayItem, { kind: "msg" }> => i.kind === "msg")
    .map(({ role, content }) => ({ role, content }));
}
