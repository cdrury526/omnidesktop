import type { ToolSource } from "../lib/db";
import { toolPolicyKey } from "../lib/db";

/** Persisted enable/disable map keyed by `toolPolicyKey(source, sourceId, name)`. */
export type ToolPolicyMap = Map<string, boolean>;

/** Missing registry rows default to enabled (non-breaking discovery). */
export function isToolEnabled(
  policies: ToolPolicyMap,
  source: ToolSource,
  sourceId: string | null | undefined,
  name: string,
): boolean {
  return policies.get(toolPolicyKey(source, sourceId, name)) !== false;
}

export { toolPolicyKey };
