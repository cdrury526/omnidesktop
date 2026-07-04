# Code Tools + OpenRouter Agent SDK Notes

Reference for implementing Code mode filesystem tools with the OpenRouter Agent
SDK. This captures the relevant SDK behavior from `docs/openrouter-agent-sdk/`
so future sessions do not rediscover it while adding write/run tools.

## Tool Shape

- Use SDK `tool()` definitions for host-owned Code mode tools.
- `list_dir` and `read_file` should be regular tools with `execute`.
- `write_file` and `run_command` should be regular tools with `execute` plus
  SDK approval gates.
- Keep actual filesystem and process execution behind Rust Tauri commands.

The SDK supports several tool modes, but Code mode should primarily use:

- **Regular tools** for read/list/write/run execution.
- **`requireApproval`** for yes/no approval before sensitive execution.
- **HITL tools** only when the tool needs user-provided data, not for simple
  approve/reject of an already-shaped tool call.

## Approval vs HITL

The SDK has two distinct pause mechanisms:

- `requireApproval`: pauses before execution, stores
  `status: "awaiting_approval"`, exposes pending calls via
  `getPendingToolCalls()`, and resumes with `approveToolCalls` /
  `rejectToolCalls`.
- HITL `onToolCalled`: can run custom logic and return `null` to pause with
  `status: "awaiting_hitl"`; resume by sending a `function_call_output`.

For `write_file` and `run_command`, use `requireApproval`. It matches the
Codex/Claude Code permission model better than reusing form HITL.

## Permission Modes

Build Code mode tools around a first-class permission mode:

```ts
type CodePermissionMode = "ask" | "yolo";
```

Recommended policy:

```ts
requireApproval: permissions.mode === "ask"
```

or a callback when we need finer per-call decisions:

```ts
requireApproval: (params, context) =>
  permissions.mode !== "yolo" && operationIsSensitive(params, context)
```

`yolo` / `--dangerously-skip-permissions` skips SDK approval only. It must not
skip Rust path scoping, canonicalization, command cwd confinement, output
limits, or event logging.

## State/UI Implications

Our current app already handles `awaiting_hitl` for interactive forms. Code mode
write/run approvals need a parallel path for `awaiting_approval`:

- Parse pending approval calls from SDK `ConversationState.pendingToolCalls`.
- Render approval cards in the transcript/tool step.
- Resume with `approveToolCalls: [callId]` or `rejectToolCalls: [callId]`.
- Add debug bridge endpoints such as `/approve` and `/reject` for deterministic
  headless verification.
- Keep event logging around both the approval decision and the eventual Rust
  execution result.

## Rust Boundary

Do not encode user-approval policy inside Rust primitives. Rust should expose
safe scoped operations, and the JS SDK tool layer should decide whether approval
is required for a call.

Rust must always enforce:

- Code tool root is the selected `working_dir`.
- Paths are canonicalized and remain under `working_dir`.
- Symlink escapes are rejected.
- Commands run with cwd confined to the working dir.
- Output is bounded.
- Attempts and results are logged.

