# Code Tools Hardening Plan

Status notes for the Code mode hardening pass. The goal was to make future tools
cheaper to add, easier to observe, and safer to reason about.

## Status

Implemented in the Code tools hardening pass:

- Rust fs helpers split by concern.
- Shared Code tool execution telemetry.
- Normalized Code tool result/error shape.
- `run_command` isolated with `spawn_blocking` at the Tauri command boundary.
- `CodeToolContext` introduced in the agent tool layer.
- Built-in tool capability table covered by unit tests.

## Context

Code mode currently has built-in `list_dir`, `read_file`, `write_file`, and
`run_command` tools. The tool registry and SDK assembly path are in place:
`CODE_TOOL_DEFINITIONS` feeds registry sync, `buildAgentTools()` applies persisted
enable/disable policy, and sensitive tools use SDK approval in default ask mode.

The next Code tools can build on this plumbing instead of adding one-off policy,
telemetry, result, or path-scope handling.

## 1. Split Rust fs Command Helpers by Concern

`src-tauri/src/fs.rs` now stays as the public Tauri command boundary. The
implementation is split below it by concern.

Current structure:

- `src-tauri/src/fs.rs` — public Tauri command exports
- `src-tauri/src/fs/path.rs` — canonical root, path resolution, scope checks,
  symlink escape rejection
- `src-tauri/src/fs/file.rs` — list/read/write operations and result structs
- `src-tauri/src/fs/process.rs` — command execution, timeout, output truncation
- `src-tauri/src/fs/tests.rs` — scoped filesystem and command tests

Preserved:

- Existing Tauri command names stay stable: `fs_list_dir`, `fs_read_file`,
  `fs_write_file`, `run_command`, `path_is_dir`.
- Existing Rust tests still pass, including parent escape and symlink escape
  coverage.
- New tool primitives do not duplicate path-scoping logic.

## 2. Add Shared Tool Execution Telemetry

Approval decisions were already logged. Code tool execution now also emits
structured app events from the JS SDK execution path.

`src/agent/code-tool-telemetry.ts` wraps Code tool `execute` functions and logs:

- tool name
- path or command summary
- success/failure
- duration
- truncation or timeout flags

Event types:

- `code_tool.start`
- `code_tool.end`
- `code_tool.error`

Keep sensitive payloads out of events. For `write_file`, log path and byte count,
not full content. For `run_command`, log command/args, cwd, exit code, timeout,
and truncation flags.

Payload rules:

- All built-in Code tools use the same telemetry wrapper.
- Events are emitted for success and failure.
- `write_file` logs path and byte count, not full content.
- `run_command` logs command/args, cwd, exit code, timeout, and truncation flags.

## 3. Normalize Code Tool Result and Error Shape

Code tools now return a consistent shape instead of mixing successful result
objects with thrown string errors.

Current shape:

```ts
type CodeToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string };
```

Expected operational failures are returned as `{ ok: false, error, code }` and
also logged as `code_tool.error`.

Current error codes include:

- `path_escape`
- `not_found`
- `not_directory`
- `not_file`
- `too_large`
- `not_utf8`
- `command_failed`
- `command_timeout`
- `spawn_failed`

Result behavior:

- Code tool outputs are predictable for success and expected failure.
- UI/tool cards can summarize failures without parsing arbitrary strings.
- Model-facing output remains compact and useful.

## 4. Make Command Execution Async or Blocking-Safe in Rust

The process implementation remains a synchronous primitive for testability, but
the public Tauri `run_command` command now calls it through
`tauri::async_runtime::spawn_blocking`.

Preserve current safety properties:

- cwd locked to the canonical working directory
- explicit argv, no implicit shell
- bounded timeout
- bounded stdout/stderr
- killed process on timeout

Preserved:

- Long-running commands do not block unrelated Tauri command handling.
- Timeout behavior remains deterministic.
- Existing command tests still pass; add a timeout test if practical.

## 5. Introduce a CodeToolContext

`buildCodeTools` now creates a `CodeToolContext` so new tools inherit shared
policy and observability.

Current shape:

```ts
interface CodeToolContext {
  workingDir: string;
  permissions: CodeToolPermissions;
  isEnabled: (name: string) => boolean;
  execute: <T>(
    name: string,
    summary: Record<string, unknown>,
    run: () => Promise<T>,
    resultSummary?: (result: T) => Record<string, unknown>,
  ) => Promise<CodeToolResult<T>>;
}
```

This should stay in the agent/tool layer. Rust remains the enforcement
chokepoint for filesystem scope and process cwd confinement.

Notes:

- New Code tools do not each hand-roll telemetry, permissions, or limits.
- Existing `buildAgentTools()` call sites stay simple.
- `yolo` continues to skip SDK approval only, not Rust safety checks.

## 6. Add a Tool Capability Table in Tests

`CODE_TOOL_CAPABILITIES` is now the source table for built-ins and unit tests
cover it to prevent registry/implementation drift.

The table covers:

- registered in `CODE_TOOL_DEFINITIONS`
- implemented by `buildCodeTools`
- sensitive or not
- default approval behavior
- registry-visible title and description

Current table:

```ts
const CODE_TOOL_CAPABILITIES = [
  { name: "list_dir", sensitive: false },
  { name: "read_file", sensitive: false },
  { name: "write_file", sensitive: true },
  { name: "run_command", sensitive: true },
];
```

Test coverage:

- A missing implementation for a registered tool fails tests.
- A missing registry definition for an implemented tool fails tests.
- Approval behavior matches sensitivity in ask/yolo modes.

## Verification

For these changes, run:

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
pnpm test:unit
cargo test --manifest-path src-tauri/Cargo.toml fs::tests
cargo build --manifest-path src-tauri/Cargo.toml
```

Bridge checks should confirm:

- Tools rail still lists all Code built-ins.
- A write or command approval emits approval and execution events.
- Rejecting an approval still returns a clean rejected tool result.
