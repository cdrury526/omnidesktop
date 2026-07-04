import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tool } from "@openrouter/agent";
import { z } from "zod";
import { assertUniqueToolNames, dedupeToolNames, toolFunctionName } from "./tool-names";
import { isToolEnabled, toolPolicyKey } from "./tool-policy";

describe("tool-policy", () => {
  it("defaults missing registry rows to enabled", () => {
    const policies = new Map<string, boolean>();
    assert.equal(isToolEnabled(policies, "builtin:code", null, "read_file"), true);
    assert.equal(isToolEnabled(policies, "mcp", "http://x/mcp", "get_time"), true);
  });

  it("respects explicit disable", () => {
    const key = toolPolicyKey("mcp", "http://x/mcp", "get_time");
    const policies = new Map([[key, false]]);
    assert.equal(isToolEnabled(policies, "mcp", "http://x/mcp", "get_time"), false);
  });
});

describe("tool-names", () => {
  it("extracts tool names from SDK tools", () => {
    const t = tool({
      name: "demo",
      inputSchema: z.object({ x: z.string() }),
      execute: async () => ({ ok: true }),
    });
    assert.equal(toolFunctionName(t), "demo");
  });

  it("dedupes duplicate names", () => {
    const mk = (name: string) =>
      tool({ name, inputSchema: z.object({}), execute: async () => ({}) });
    const names: string[] = [];
    const out = dedupeToolNames([mk("a"), mk("a"), mk("b")], (n) => names.push(n));
    assert.deepEqual(out.map(toolFunctionName), ["a", "b"]);
    assert.deepEqual(names, ["a"]);
  });

  it("assertUniqueToolNames throws on collision", () => {
    const mk = (name: string) =>
      tool({ name, inputSchema: z.object({}), execute: async () => ({}) });
    assert.throws(() => assertUniqueToolNames([mk("x"), mk("x")]), /Duplicate tool name/);
  });
});
