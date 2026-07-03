import { tool } from "@openrouter/agent";
import { z } from "zod";
import { INTERACTIVE_TOOL_META, validateSpec } from "@omni/forms-dsl";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  callTool,
  hasAppHtml,
  type ServerInfo,
  type ToolCallInfo,
} from "../mcp/host-bridge";
import { objectToZod } from "./json-schema-to-zod";

function mcpResultToText(r: CallToolResult): string {
  const text = (r.content ?? [])
    .map((c) => (c.type === "text" ? c.text : `[${c.type}]`))
    .join("\n")
    .trim();
  return text || (r.isError ? "Tool returned an error." : "Tool completed.");
}

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

    // Interactive tool -> HITL. The real result arrives later via resumeTurn.
    if (isInteractive(t._meta)) {
      return tool({
        name: t.name,
        description,
        inputSchema,
        outputSchema: z.unknown(),
        onToolCalled: async (params: Record<string, unknown>) => {
          const check = validateSpec(params);
          if (!check.ok) return { error: "invalid_form_spec", issues: check.issues };
          const info = callTool(server, t.name, params ?? {});
          if (hasAppHtml(info)) onAutoSummon(info);
          return null;
        },
      });
    }

    return tool({
      name: t.name,
      description,
      inputSchema,
      execute: async (params: Record<string, unknown>) => {
        const info = callTool(server, t.name, params ?? {});
        if (hasAppHtml(info)) onAutoSummon(info);
        return mcpResultToText(await info.resultPromise);
      },
    });
  });
}

export type McpTools = ReturnType<typeof buildMcpTools>;
