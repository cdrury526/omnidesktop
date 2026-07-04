import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildToolUsageReport } from "./tool-usage";

describe("tool-usage", () => {
  it("normalizes tool calls, structured failures, approvals, and model events", () => {
    const report = buildToolUsageReport(
      [
        {
          conversationId: 7,
          updatedAt: "2026-07-04T12:00:00Z",
          state: {
            status: "complete",
            messages: [
              {
                type: "function_call",
                call_id: "call_a",
                name: "read_file",
                arguments: "{\"path\":\"src/App.tsx\"}",
              },
              {
                type: "function_call_output",
                call_id: "call_a",
                output: "{\"ok\":false,\"error\":\"Path escapes project\",\"code\":\"path_escape\"}",
              },
            ],
          },
        },
      ],
      [
        {
          id: 1,
          ts: "2026-07-04T12:00:00Z",
          type: "turn.start",
          conversation_id: 7,
          data: "{\"model\":\"openrouter/test\"}",
        },
        {
          id: 2,
          ts: "2026-07-04T12:00:01Z",
          type: "tool.approve",
          conversation_id: 7,
          data: "{\"callIds\":[\"call_a\"]}",
        },
      ],
    );

    assert.equal(report.summary.totalCalls, 1);
    assert.deepEqual(report.summary.byTool, { read_file: 1 });
    assert.deepEqual(report.summary.byStatus, { error: 1 });
    assert.deepEqual(report.summary.byModel, { "openrouter/test": 1 });
    assert.deepEqual(report.records[0], {
      conversationId: 7,
      callId: "call_a",
      toolName: "read_file",
      args: { path: "src/App.tsx" },
      output: { ok: false, error: "Path escapes project", code: "path_escape" },
      status: "error",
      ok: false,
      error: "Path escapes project",
      code: "path_escape",
      approval: "approved",
      model: "openrouter/test",
      stateUpdatedAt: "2026-07-04T12:00:00Z",
    });
  });

  it("marks pending approval calls and summarizes code-tool telemetry", () => {
    const report = buildToolUsageReport(
      [
        {
          conversationId: 8,
          state: {
            status: "awaiting_approval",
            pendingToolCalls: [{ id: "call_b", name: "run_command", arguments: { command: "pnpm test" } }],
            messages: [
              {
                type: "function_call",
                id: "call_b",
                name: "run_command",
                arguments: { command: "pnpm test" },
              },
            ],
          },
        },
      ],
      [
        {
          id: 1,
          ts: "2026-07-04T12:00:00Z",
          type: "code_tool.start",
          conversation_id: null,
          data: "{\"name\":\"run_command\",\"command\":\"pnpm test\"}",
        },
        {
          id: 2,
          ts: "2026-07-04T12:00:02Z",
          type: "code_tool.end",
          conversation_id: null,
          data: "{\"name\":\"run_command\",\"ok\":true,\"durationMs\":2000,\"truncated\":true}",
        },
      ],
    );

    assert.equal(report.records[0].status, "awaiting_approval");
    assert.equal(report.records[0].approval, "pending");
    assert.deepEqual(report.summary.codeTelemetry, [
      {
        toolName: "run_command",
        starts: 1,
        ends: 1,
        errors: 0,
        failures: 0,
        timeouts: 0,
        truncated: 1,
        durationsMs: [2000],
      },
    ]);
  });
});
