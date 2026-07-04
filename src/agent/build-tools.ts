/**
 * Assemble the tool list passed to OpenRouter SDK `callModel`.
 *
 * Mirrors SDK MCP `buildTools` semantics: filter by policy, resolve name
 * collisions (host Code tools win over MCP), then assert unique names so the
 * SDK never sees shadowed tools.
 */
import type { Tool } from "@openrouter/agent";
import { buildCodeTools, type CodeToolPermissions } from "./code-tools";
import { buildMcpTools } from "./mcp-tools";
import { isToolEnabled, type ToolPolicyMap } from "./tool-policy";
import { assertUniqueToolNames, dedupeToolNames, toolFunctionName } from "./tool-names";
import { logEvent } from "../lib/events";
import type { ServerInfo, ToolCallInfo } from "../mcp/host-bridge";

export type AgentTools = Tool[];

export { toolFunctionName } from "./tool-names";
export { assertUniqueToolNames, dedupeToolNames } from "./tool-names";

export interface BuildAgentToolsArgs {
  server: ServerInfo | null;
  workingDir: string | undefined;
  summonPanel: (info: ToolCallInfo) => void;
  toolPolicies: ToolPolicyMap;
  permissions?: CodeToolPermissions;
}

export function buildAgentTools({
  server,
  workingDir,
  summonPanel,
  toolPolicies,
  permissions = { mode: "ask" },
}: BuildAgentToolsArgs): AgentTools {
  const codeTools = workingDir
    ? buildCodeTools({
        workingDir,
        permissions,
        isEnabled: (name) => isToolEnabled(toolPolicies, "builtin:code", null, name),
      })
    : [];

  const codeNames = new Set(
    codeTools.map((t) => toolFunctionName(t)).filter((n): n is string => !!n),
  );

  const mcpTools = server
    ? buildMcpTools(
        server,
        summonPanel,
        (name) => isToolEnabled(toolPolicies, "mcp", server.url, name),
      ).filter((t) => {
        const name = toolFunctionName(t);
        if (!name || !codeNames.has(name)) return true;
        logEvent({
          source: "system",
          type: "tool.collision",
          data: { name, kept: "builtin:code", dropped: "mcp", mcpUrl: server.url },
        });
        return false;
      })
    : [];

  const tools = dedupeToolNames([...codeTools, ...mcpTools], (name) => {
    logEvent({ source: "system", type: "tool.duplicate", data: { name } });
  });
  assertUniqueToolNames(tools);
  return tools;
}
