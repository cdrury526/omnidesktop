# Code Tools Hardening Plan

Planning notes for tightening Code mode before adding more built-in tools. The
goal is to make future tools cheaper to add, easier to observe, and safer to
reason about.

## Context

Code mode currently has built-in `list_dir`, `read_file`, `write_file`, and
`run_command` tools. The tool registry and SDK assembly path are in place:
`CODE_TOOL_DEFINITIONS` feeds registry sync, `buildAgentTools()` applies persisted
enable/disable policy, and sensitive tools use SDK approval in default ask mode.

Before adding tools like `edit_file`, `search_files`, `apply_patch`, or symbol
navigation, harden the shared tool plumbing below.

## 1. Split Rust fs Command Helpers by Concern

`src-tauri/src/fs.rs` is still manageable, but it now holds path resolution,
file IO, process execution, command result structs, and tests. Split it before
adding more primitives.

Suggested structure:

- `src-tauri/src/fs/mod.rs` — public Tauri command exports and shared constants
- `src-tauri/src/fs/path.rs` — canonical root, path resolution, scope checks,
  symlink escape rejection
- `src-tauri/src/fs/file.rs` — list/read/write operations and result structs
- `src-tauri/src/fs/process.rs` — command execution, timeout, output truncation
- `src-tauri/src/fs/tests.rs` or module-local tests grouped by concern

Acceptance criteria:

- Existing Tauri command names stay stable: `fs_list_dir`, `fs_read_file`,
  `fs_write_file`, `run_command`, `path_is_dir`.
- Existing Rust tests still pass, including parent escape and symlink escape
  coverage.
- New tool primitives do not duplicate path-scoping logic.

## 2. Add Shared Tool Execution Telemetry

Approval decisions are logged, but Code tool execution should also emit
structured app events from the JS SDK execution path.

Add a thin helper around Code tool `execute` functions that logs:

- tool name
- path or command summary
- success/failure
- duration
- truncation or timeout flags

Suggested event types:

- `code_tool.start`
- `code_tool.end`
- `code_tool.error`

Keep sensitive payloads out of events. For `write_file`, log path and byte count,
not full content. For `run_command`, log command/args, cwd, exit code, timeout,
and truncation flags.

Acceptance criteria:

- All built-in Code tools use the same telemetry wrapper.
- Events are emitted for success and failure.
- The debug bridge `/events` stream can confirm write/run execution after
  approval.

## 3. Normalize Code Tool Result and Error Shape

Future tools will be easier for models and UI cards if Code tools return a
consistent shape instead of mixing successful result objects with thrown string
errors.

Candidate shape:

```ts
type CodeToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string; details?: unknown };
```

The SDK can still surface unexpected exceptions, but expected operational
failures should be structured where practical.

Consider codes such as:

- `path_escape`
- `not_found`
- `not_directory`
- `not_file`
- `too_large`
- `not_utf8`
- `command_failed`
- `command_timeout`
- `spawn_failed`

Acceptance criteria:

- Code tool outputs are predictable for success and expected failure.
- UI/tool cards can summarize failures without parsing arbitrary strings.
- Model-facing output remains compact and useful.

## 4. Make Command Execution Async or Blocking-Safe in Rust

`run_command` currently uses a polling loop and blocks the Tauri command handler
thread while the child process runs. This is acceptable for the first slice, but
heavier use will run tests/builds often.

Preferred options:

- Use async process handling where it fits Tauri's runtime cleanly.
- Or isolate blocking work with `tauri::async_runtime::spawn_blocking`.

Preserve current safety properties:

- cwd locked to the canonical working directory
- explicit argv, no implicit shell
- bounded timeout
- bounded stdout/stderr
- killed process on timeout

Acceptance criteria:

- Long-running commands do not block unrelated Tauri command handling.
- Timeout behavior remains deterministic.
- Existing command tests still pass; add a timeout test if practical.

## 5. Introduce a CodeToolContext

`buildCodeTools` currently receives `workingDir`, `permissions`, and `isEnabled`.
As tools grow, centralize the execution context so new tools inherit shared
policy and observability.

Candidate shape:

```ts
interface CodeToolContext {
  workingDir: string;
  permissions: CodeToolPermissions;
  isEnabled: (name: string) => boolean;
  limits: {
    maxReadBytes: number;
    maxWriteBytes: number;
    maxCommandOutputBytes: number;
    defaultCommandTimeoutMs: number;
    maxCommandTimeoutMs: number;
  };
  logExecution: <T>(
    name: string,
    summary: Record<string, unknown>,
    run: () => Promise<T>,
  ) => Promise<T>;
}
```

This should stay in the agent/tool layer. Rust remains the enforcement
chokepoint for filesystem scope and process cwd confinement.

Acceptance criteria:

- New Code tools do not each hand-roll telemetry, permissions, or limits.
- Existing `buildAgentTools()` call sites stay simple.
- `yolo` continues to skip SDK approval only, not Rust safety checks.

## 6. Add a Tool Capability Table in Tests

Add a small test matrix for built-ins to prevent registry/implementation drift.

The table should cover:

- registered in `CODE_TOOL_DEFINITIONS`
- implemented by `buildCodeTools`
- sensitive or not
- default approval behavior
- registry-visible title and description

Candidate table:

```ts
const CODE_TOOL_CAPABILITIES = [
  { name: "list_dir", sensitive: false },
  { name: "read_file", sensitive: false },
  { name: "write_file", sensitive: true },
  { name: "run_command", sensitive: true },
];
```

Acceptance criteria:

- A missing implementation for a registered tool fails tests.
- A missing registry definition for an implemented tool fails tests.
- Approval behavior matches sensitivity in ask/yolo modes.

## Suggested Order

1. Add shared telemetry and the capability table first. They improve confidence
   before behavior changes.
2. Split Rust modules while behavior is still small and well covered.
3. Normalize result/error shapes.
4. Make command execution async or blocking-safe.
5. Introduce `CodeToolContext` when telemetry/result conventions are settled.

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
