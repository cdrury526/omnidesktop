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

## UX reference

The maintainer has Stitch mockups (project `4128851077805521634`). **The Stitch
MCP read methods are blocked and no images were attached**, so the exact visual
is TBD — paste the reference images into the session before building the UI.
Working assumptions to confirm against them:
- Toggle lives in the header/toolbar (antd `Switch` or `Segmented`: Chat | Code).
- When on, show the selected folder as a chip (basename + full path on hover) with
  change/clear affordances; if on with no folder, prompt to pick one.
- Empty-state copy may change in code mode.

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
4. **Prompt injection.** `src/agent/runner.ts`: thread an optional `workingDir`
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
