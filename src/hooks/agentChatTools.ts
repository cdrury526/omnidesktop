import { buildCodeTools } from "../agent/code-tools";
import { buildMcpTools, type McpTools } from "../agent/runner";
import { toolPolicyKey } from "../lib/db";
import type { ServerInfo, ToolCallInfo } from "../mcp/host-bridge";

export function buildAgentTools(
  server: ServerInfo | null,
  workingDir: string | undefined,
  summonPanel: (info: ToolCallInfo) => void,
  toolPolicies: Map<string, boolean>,
): McpTools {
  const enabled = (source: "builtin:code" | "mcp", sourceId: string | null | undefined, name: string) =>
    toolPolicies.get(toolPolicyKey(source, sourceId, name)) !== false;
  return [
    ...(server ? buildMcpTools(server, summonPanel, (name) => enabled("mcp", server.url, name)) : []),
    ...(workingDir
      ? buildCodeTools({
          workingDir,
          permissions: { mode: "ask" },
          isEnabled: (name) => enabled("builtin:code", null, name),
        })
      : []),
  ] as McpTools;
}
