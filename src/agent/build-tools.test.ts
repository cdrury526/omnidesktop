import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tool } from "@openrouter/agent";
import { z } from "zod";
import { buildCodeTools, CODE_TOOL_CAPABILITIES, CODE_TOOL_DEFINITIONS } from "./code-tools";
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

describe("code-tools", () => {
  const requireApprovalOf = (t: unknown): unknown =>
    (t as { function?: { requireApproval?: unknown } }).function?.requireApproval;

  const capabilities = [
    { name: "list_dir", sensitive: false },
    { name: "read_file", sensitive: false },
    { name: "write_file", sensitive: true },
    { name: "run_command", sensitive: true },
  ];

  it("keeps the built-in capability table explicit", () => {
    assert.deepEqual(
      CODE_TOOL_CAPABILITIES.map(({ name, sensitive }) => ({ name, sensitive })),
      capabilities,
    );
  });

  it("registers every built-in capability for registry sync", () => {
    assert.deepEqual(
      CODE_TOOL_DEFINITIONS.map((t) => t.name),
      capabilities.map((t) => t.name),
    );
    for (const def of CODE_TOOL_DEFINITIONS) {
      assert.ok(def.title.length > 0, `${def.name} needs a registry title`);
      assert.ok(def.description.length > 0, `${def.name} needs a registry description`);
    }
  });

  it("implements every registered built-in", () => {
    const tools = buildCodeTools({ workingDir: "/tmp/project", permissions: { mode: "ask" } });
    assert.deepEqual(tools.map(toolFunctionName), capabilities.map((t) => t.name));
  });

  it("matches approval behavior to sensitivity in ask and yolo modes", () => {
    const askTools = new Map(
      buildCodeTools({ workingDir: "/tmp/project", permissions: { mode: "ask" } })
        .map((t) => [toolFunctionName(t), t]),
    );
    const yoloTools = new Map(
      buildCodeTools({ workingDir: "/tmp/project", permissions: { mode: "yolo" } })
        .map((t) => [toolFunctionName(t), t]),
    );

    for (const capability of capabilities) {
      assert.equal(
        requireApprovalOf(askTools.get(capability.name)),
        capability.sensitive ? true : undefined,
      );
      assert.equal(requireApprovalOf(yoloTools.get(capability.name)), undefined);
    }
  });
});
