import { buildCodeTools } from "../agent/code-tools";
import { buildMcpTools, type McpTools } from "../agent/runner";
import type { ServerInfo, ToolCallInfo } from "../mcp/host-bridge";

export function buildAgentTools(
  server: ServerInfo | null,
  workingDir: string | undefined,
  summonPanel: (info: ToolCallInfo) => void,
): McpTools {
  return [
    ...(server ? buildMcpTools(server, summonPanel) : []),
    ...(workingDir ? buildCodeTools({ workingDir, permissions: { mode: "ask" } }) : []),
  ] as McpTools;
}

