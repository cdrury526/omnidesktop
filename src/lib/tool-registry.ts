/**
 * Sync discovered tools into the persisted registry and expose active-only views.
 */
import {
  CODE_TOOL_DEFINITIONS,
} from "../agent/code-tools";
import {
  listActiveToolRegistry,
  listToolRegistry,
  upsertToolRegistry,
  type ToolRegistryInput,
  type ToolRegistryRow,
} from "./db";
import type { ServerInfo } from "../mcp/host-bridge";

function builtinInputs(): ToolRegistryInput[] {
  return CODE_TOOL_DEFINITIONS.map((t) => ({
    source: "builtin:code" as const,
    name: t.name,
    title: t.title,
    description: t.description,
  }));
}

function mcpInputs(server: ServerInfo): ToolRegistryInput[] {
  return [...server.tools.values()].map((t) => ({
    source: "mcp" as const,
    sourceId: server.url,
    name: t.name,
    title: t.title ?? t.name,
    description: t.description ?? null,
  }));
}

/** Upsert built-in + connected MCP tools; preserve existing enabled flags. */
export async function syncToolRegistry(server: ServerInfo | null): Promise<ToolRegistryRow[]> {
  const inputs = [...builtinInputs(), ...(server ? mcpInputs(server) : [])];
  await upsertToolRegistry(inputs);
  return listToolRegistry();
}

/** Tools visible in the panel and relevant to the current session. */
export async function loadActiveToolRegistry(
  activeMcpUrl: string | null,
): Promise<ToolRegistryRow[]> {
  return listActiveToolRegistry(activeMcpUrl);
}
