# Code Mode — discussion brief

A brief to kick off a fresh-session discussion. **This is the first "giant leap"
from chat app → coding app.** Read `HANDOFF.md` + `AGENTS.md` first; this assumes
that context. Nothing here is final — it frames the work and surfaces the
decisions to make together.

## The leap

Add a per-chat **Code mode**. When on, the user picks a **working folder** that's
associated with that chat (stored in the DB) and **injected into the agent's
system prompt**, so the model is grounded in a specific project. File-access
tools come later — the working folder is the foundation we get right first.

## Scope of THIS step

In:
- A **Code mode toggle** at the top of the chat.
- A **working-folder picker** (native directory dialog) shown/required when on.
- **Per-conversation persistence** of mode + folder (survives reload / chat switch).
- **Prompt injection** of the working folder into the agent turn.

Out (later, the "tools piece"):
- Reading/writing files, running commands, indexing/embeddings, a file tree,
  diffs. None of that yet — this step is state + plumbing + prompt context only.

## Destination (from the Stitch renders)

Renders live in `stitch-renders/stitch_omni_desktop_enhancements/` (`screen.png` +
`code.html` per screen; `omni_desktop_light/DESIGN.md` is the design system, and it
already matches our theme — indigo `#4f46e5`, soft-gray panels, 8px radius). The
full vision they depict:

- **Code Mode toggle** top-right in the header (pill, accent/green when on).
- In code mode the session is bound to a **project = working folder**, shown as a
  **tab** labeled by the folder name (folder icon + close ×).
- **Multi-tab**: several projects open at once (`omni-desktop`, `rust-cli`,
  `api-server`) with a `+` to add. (Note: there's already an unused `tabs` table.)
- **History grouped by directory**: code chats grouped under their folder
  (`projects/omni-desktop (3 chats)` → individual chats). An All | Code filter.
- Composer copy changes in code mode ("Ask Omni to write code, refactor, or debug…").
- A right rail with **Project Files** + an **Active Agent** card, and **Apply
  Changes** on code blocks.

**Only the first two bullets are this step.** The rest (multi-tab, history
grouping, files panel, active agent, apply-changes) are later — but the data model
here should not preclude them: storing `working_dir` per conversation directly
enables "history grouped by directory," and one-folder-per-chat is the unit a
future tab wraps.

## UX for this step

- Toggle in the header (antd `Switch`/`Segmented`), accent when on — matches the render.
- When on, show the selected folder as a chip/tab (folder name + full path on
  hover) with change/clear; if on with no folder, immediately open the picker.
- Optionally switch the composer placeholder + empty-state copy in code mode.
- Keep multi-tab/grouping/right-rail OUT — just the toggle + folder + its display.

## Where it touches this codebase

1. **DB — migration `0002` (first real `ALTER`).** Use the migration framework we
   just built (`src-tauri/src/db/migrations.rs` + `schema/`). Add
   `schema/0002_code_mode.sql` with `ALTER TABLE conversations ADD COLUMN
   code_mode INTEGER NOT NULL DEFAULT 0;` and `... ADD COLUMN working_dir TEXT;`
   then append a `Migration{version:2,…}`. (Decision: columns on `conversations`
   vs a small `chat_settings` table — columns are simplest for 1–2 fields.)
2. **Folder picker.** Add `@tauri-apps/plugin-dialog` (+ capability) for a native
   directory dialog; the chosen path returns to the frontend and persists via the
   existing `db_execute`. The path string is the user's own machine path (not a
   secret), but **actual file access stays behind Rust later** — don't open the
   filesystem to the webview (it hosts untrusted MCP iframes).
3. **Persistence + load.** `src/lib/db.ts` get/set helpers for a conversation's
   mode + dir; `useAgentChat.hydrate()` loads them; App (or the hook) holds the
   state and persists on toggle/change.
4. **Prompt injection.** `src/agent/turns.ts`: thread an optional `workingDir`
   into `runTurn`/`resumeTurn`/`openForm`; when set, append a code-mode section to
   `SYSTEM_PROMPT` (e.g. "You are in code mode. The working folder for this
   session is `<path>`. …"). Keep it minimal now — a directory listing is a tool
   concern for later.
5. **UI.** A toggle + folder chip in the header/`chat-toolbar`, wired to the
   per-conversation state. Ant Design X / antd primitives; keep files < 600 lines
   (App.tsx is ~445 — a `CodeModeToggle` component is the natural home).

## Decisions to make in the discussion

- **Mode scope:** per-conversation (recommended — matches our model) vs app-global.
- **Mid-chat toggling:** allowed? It only affects *subsequent* turns' prompt — fine?
- **Change folder mid-chat:** allowed (re-inject)? What about prior turns' context?
- **New-chat default:** off, or inherit the last chat's mode/folder?
- **DB shape:** columns on `conversations` vs a `chat_settings` table.
- **Prompt content now:** just the path, or also high-level repo hints? (No file
  reads yet.)
- **Missing folder on load:** the saved path was moved/deleted — detect and warn?
- **Picker:** confirm adding `@tauri-apps/plugin-dialog` + the capability entry.

## Next phase — filesystem tools architecture (NOT this step)

This is the "tools piece" that comes after the folder toggle. Written down now so
the first step is built to fit it. The model is: **the agent's tool calls hit OUR
host, and the host executes them via Rust** — the same boundary the app already
uses for HTTP, keyring, and DB. There is no external "filesystem MCP server"; the
fs tools are built into the host. See `CODE_TOOLS_SDK_NOTES.md` for the
OpenRouter Agent SDK-specific tool and approval shape.

**Shape:**
- A `buildCodeTools({ workingDir, permissions })` module alongside
  `buildMcpTools`, registered only in code mode: `read_file`, `list_dir`,
  `write_file`, `run_command`, … Each tool's `execute()` calls a Rust command
  via `invoke("fs_read", …)` etc. The agent sees the tools; Rust does the work.
- New Rust module (e.g. `src-tauri/src/fs.rs`) exposing those commands, each
  taking the conversation's `working_dir` + a path/args.
- A first-class **permission mode** travels with Code mode tool execution:
  default `ask`, optional `yolo` / `--dangerously-skip-permissions`. Build every
  write/command path as `propose -> policy decision -> execute`, so the approval
  step can be interactive in `ask` mode and skipped in `yolo` mode without
  changing the execution engine.

**Two separate boundaries — both required:**
1. **Execution boundary (mostly free).** The untrusted MCP App iframes are
   cross-origin sandboxed and have no `__TAURI_INTERNALS__`, so they *cannot*
   call `invoke`. Only the host React app can. The "untrusted iframe touches the
   disk" path is closed by construction — keep it that way (don't add an fs
   bridge reachable from the sandbox).
2. **Authorization boundary (the real work, in Rust).** The *model* picks the
   paths/commands and can be steered by prompt injection (file contents, MCP
   outputs, pasted text). So Rust must not trust the path it's handed: every fs
   command **canonicalizes, resolves symlinks, and rejects anything outside
   `working_dir`** (no `..` escape, no absolute paths out, no symlink-out). This
   scoping check is the load-bearing code and must live in Rust (the chokepoint),
   not the JS tool layer.

**Permission model, designed for a future yolo mode:**
- **Always enforced:** Code tools are only registered when Code mode has a
  reachable `working_dir`; Rust resolves all paths under that root; untrusted MCP
  iframes never get filesystem or command bridges; events are logged for every
  read/list/write/command attempt and result.
- **Default `ask` mode:** `list_dir` / `read_file` may run directly within the
  scoped root. `write_file` / `run_command` use the SDK's `requireApproval`
  gate, then execute only after the user approves.
- **`yolo` / `--dangerously-skip-permissions` mode:** skip SDK approval for
  writes and commands, but **do not skip Rust scoping, canonicalization, logging,
  command working-directory confinement, or output limits**. This mode is
  equivalent to Codex/Claude Code's "I know this can modify/run things in my
  project" toggle, not a way for the model or MCP iframe to escape the app's
  native boundary.
- **Implementation implication:** do not bake "approval required" into the Rust
  filesystem functions. Rust should expose safe primitives (`fs_read`, `fs_write`,
  `run_command`) that always enforce scope; the JS agent tool layer decides
  whether a given operation needs approval based on `permissions.mode`.

**Reuse what already exists:**
- **SDK approval state** — use `requireApproval` for "the agent wants to write
  `main.rs` / run `cargo build` — approve?" This gives us
  `awaiting_approval`, pending tool calls, and resume via `approveToolCalls` /
  `rejectToolCalls`. `yolo` mode bypasses only this approval checkpoint.
  `run_command` is the most dangerous (arbitrary exec even when scoped), so its
  approval card should show command, cwd, timeout, and expected file-write risk
  before yolo is enabled.
- **Events log** — every `fs_write` / `run_command` is an audit-trail entry for free.

Slogan to keep straight: *"tools hit our app, we execute via Rust"* is the
**transport**; the **safety** is *Rust enforces the path is inside the working dir
+ writes/exec follow the selected permission mode.* `yolo` can bypass approval,
not the Rust boundary.

## Guardrails (non-negotiable, from this project)

- Schema changes go through migrations — never hand-edit the live schema.
- Secrets/filesystem stay behind Rust; the webview is untrusted. Holding a path
  string is fine; file ops (later) go through Rust commands.
- Ant Design X / antd primitives over hand-rolling; use the project skills.
- Work on `main`, commit/push after verifying (AGENTS.md). Verify via the
  `omni-debug-bridge`; trust `/dom` (text + colors), not the html2canvas snapshot.

## Suggested first slice (concrete starting point)

1. Migration `0002`: `code_mode` + `working_dir` on `conversations`.
2. `db.ts` get/set helpers; load in `hydrate`.
3. Header toggle + native folder picker + folder chip.
4. Inject `working_dir` into the runner's system prompt.
5. **Verify:** toggle on → pick folder → send a turn → ask the model "what's my
   working folder?" and confirm it knows → reload → mode + folder restored.
