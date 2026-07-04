import type { Tool } from "@openrouter/agent";

export function toolFunctionName(tool: Tool): string | undefined {
  if ("function" in tool && typeof tool.function.name === "string") {
    return tool.function.name;
  }
  return undefined;
}

export function dedupeToolNames(tools: readonly Tool[], onDuplicate: (name: string) => void): Tool[] {
  const seen = new Set<string>();
  const out: Tool[] = [];
  for (const t of tools) {
    const name = toolFunctionName(t);
    if (!name) {
      out.push(t);
      continue;
    }
    if (seen.has(name)) {
      onDuplicate(name);
      continue;
    }
    seen.add(name);
    out.push(t);
  }
  return out;
}

export function assertUniqueToolNames(tools: readonly Tool[]): void {
  const seen = new Set<string>();
  for (const t of tools) {
    const name = toolFunctionName(t);
    if (!name) continue;
    if (seen.has(name)) {
      throw new Error(
        `Duplicate tool name "${name}". Host Code tools take precedence over MCP; check tool registry sync.`,
      );
    }
    seen.add(name);
  }
}
