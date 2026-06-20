/**
 * The agent loop, built on the OpenRouter agent SDK.
 *
 * Each MCP tool becomes an SDK `tool()` whose `execute` runs the real MCP call
 * via the host bridge. If the tool declares an MCP App UI (`_meta.ui`), execute
 * fires `onAutoSummon` so the slide-out pane mounts it — while the same tool
 * result is also returned to the model so the conversation continues. The SDK
 * drives the multi-turn tool-calling loop; we just stream its text out.
 */
import {
  OpenRouter,
  tool,
  fromChatMessages,
  stepCountIs,
} from "@openrouter/agent";
import { HTTPClient } from "@openrouter/sdk";
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

export function buildMcpTools(
  server: ServerInfo,
  onAutoSummon: (info: ToolCallInfo) => void,
) {
  return Array.from(server.tools.values()).map((t) =>
    tool({
      name: t.name,
      description: t.description ?? t.title ?? t.name,
      inputSchema: objectToZod(t.inputSchema as never),
      execute: async (params: Record<string, unknown>) => {
        const info = callTool(server, t.name, params ?? {});
        // Auto-summon: a UI tool slides the pane out immediately.
        if (hasAppHtml(info)) onAutoSummon(info);
        // The same result promise feeds both the pane and the model.
        const result = await info.resultPromise;
        return mcpResultToText(result);
      },
    }),
  );
}

const SYSTEM_PROMPT =
  "You are a helpful desktop assistant running in a native app. You can call " +
  "tools provided by connected MCP servers. Some tools open an interactive UI " +
  "panel beside the chat (forms, dropdowns, pickers); call them when they help " +
  "the user accomplish a task. After calling such a tool, briefly tell the user " +
  "what to do in the panel that just appeared.";

export interface RunTurnArgs {
  apiKey: string;
  model: string;
  /** Full conversation so far (user/assistant), excluding the system prompt. */
  messages: ChatMsg[];
  tools: McpTools;
  onTextDelta: (delta: string) => void;
}

/** Run one user turn; streams assistant text via onTextDelta, returns full text. */
export async function runTurn({
  apiKey,
  model,
  messages,
  tools,
  onTextDelta,
}: RunTurnArgs): Promise<string> {
  // Route HTTP through Rust (Tauri http plugin) to avoid webview CORS.
  const or = new OpenRouter({
    apiKey,
    httpClient: new HTTPClient({ fetcher: appFetch as never }),
  });

  const result = or.callModel({
    model,
    instructions: SYSTEM_PROMPT,
    // fromChatMessages returns the SDK's InputsUnion; the input field types it
    // more narrowly as Item[]. Same runtime shape — cast through the boundary.
    input: fromChatMessages(messages as never) as never,
    tools,
    stopWhen: stepCountIs(8),
    allowFinalResponse: true,
  });

  let full = "";
  for await (const delta of result.getTextStream()) {
    full += delta;
    onTextDelta(delta);
  }
  return full;
}
