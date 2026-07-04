# Agent guide — Omni Desktop

How agents work in this repo. Read `HANDOFF.md` (engineering brief) and
`README.md` (user-facing) for what the app is and where things live.

## Workflow: work on `main`, commit and push often

This is a fast-iteration, single-maintainer project. **Do not** create feature
branches or pull requests by default.

- Work directly on `main`.
- After a change is **verified working**, **commit and push to `origin/main`** —
  do not ask for permission to commit or push. Approval is standing.
- Commit in small, coherent units as you go, not one giant commit at the end.
- Only branch / open a PR if the maintainer explicitly asks for one.

## Verify before you commit

"Verified working" means you actually checked it — state what you ran:

- Frontend typecheck: `./node_modules/.bin/tsc --noEmit`
- Frontend build: `./node_modules/.bin/vite build`
- Agent/tool unit tests (when `src/agent/**` tools/registry changed): `pnpm test:unit`
- Rust build (when `src-tauri/**` changed): `cargo build --manifest-path src-tauri/Cargo.toml`
- Behavior: drive the running app via the **debug bridge** (`omni-debug-bridge`
  skill, `127.0.0.1:1456`) — `/send`, `/openform`, `/dom`, `/snapshot`, `/events`.
  Prefer the rendered **snapshot** or computed layout over the `/dom` `text`
  field (it reads empty for live/animated nodes).

Don't commit on red. If something fails, fix it or say so plainly.

## Don't commit local / secret files

These are intentionally untracked — never `git add` them: `.env`, `.cursor/`,
`.claude/projects/`, `.firecrawl/`, `google-cloud-sdk/`, `tools/`, build output
(`dist/`, `target/`). API keys live in the OS keyring; the DB and any tokens stay
behind Rust (see the secrets guardrail in `HANDOFF.md`).

## Docs mirrors are agent reference tooling

`docs/` and the `pnpm docs:*` / `omni-docs` commands are dev-time lookup tools
for agents working on integrations like OpenRouter or AG-UI. They are not an
in-app feature area and should not pull the product roadmap away from Omni
Desktop itself.

Before OpenRouter or AG-UI implementation work, prefer checking local docs with
`pnpm docs:index --compact`, `pnpm docs:search --json ...`, or `pnpm docs:open
-- <id>` instead of guessing APIs from memory. See `docs/README.md` for command
examples and `docs/doc-cli-backlog.md` for the tooling backlog.

## Tools and tool registry (OpenRouter Agent SDK)

The app has **two layers** — do not conflate them:

| Layer | Role | Key files |
|-------|------|-----------|
| **Registry (policy)** | Persist which tools the user wants in model context | `tool_registry` table (`0007`), `src/lib/tool-registry.ts`, `src/lib/db.ts`, Tools rail panel |
| **Primitives (execution)** | SDK `tool()` wrappers + Rust chokepoint for Code mode | `src/agent/build-tools.ts`, `mcp-tools.ts`, `code-tools.ts`, `src-tauri/src/fs.rs` |

### Assembly — always use `buildAgentTools`

Every turn/resume/openForm path must build tools the same way:

```ts
const tools = buildAgentTools({
  server,
  workingDir,           // Code tools only when set + reachable
  summonPanel,
  toolPolicies,         // Map from toolEnabledMap(registry rows)
});
```

`buildAgentTools` (exported via `src/agent/runner.ts`):

1. Filters MCP + built-in Code tools by persisted `enabled` policy (missing row → **enabled**).
2. On name collision, **host Code tools win** over MCP (event: `tool.collision`).
3. Asserts **unique tool names** before `callModel` — the SDK rejects shadowed tools.

Do **not** call `buildMcpTools` / `buildCodeTools` directly from hooks except inside
`build-tools.ts`. Do **not** bypass the registry when adding new tools.

### Registry sync and UI

- **`syncToolRegistry(server)`** — upsert `CODE_TOOL_DEFINITIONS` + connected MCP
  `listTools` into DB; preserves existing `enabled` on conflict.
- **`listActiveToolRegistry(mcpUrl)`** — Tools panel shows builtins + current MCP
  server only. Stale MCP rows stay in DB so reconnect restores user prefs.
- Keys: `builtin:code` + `""` + name; `mcp` + server URL + name (`toolPolicyKey`).

### OpenRouter SDK — two pause mechanisms

Before changing tool behavior, check local docs (not memory):

```bash
pnpm docs:search --mirror openrouter-agent-sdk requireApproval
pnpm docs:open -- <id>   # e.g. tool-approval-state, tools
pnpm docs:symbol callModel
```

| SDK status | Use for | Host resume |
|------------|---------|-------------|
| `awaiting_hitl` | Interactive MCP forms (`onToolCalled` → `null`) | `resumeTurn` + `function_call_output` |
| `awaiting_approval` | Sensitive Code tools (`requireApproval: true`) | `resumeApprovalTurn` + `approveToolCalls` / `rejectToolCalls` |

- **HITL** = user fills data (forms). **Approval** = yes/no before execute (write/run).
- Read tools (`list_dir`, `read_file`) run without approval. Future `write_file` /
  `run_command` use `requireApproval` when `permissions.mode === "ask"`; `yolo`
  skips approval only — never Rust path scoping (`CODE_TOOLS_SDK_NOTES.md`).
- UI: Approve/Reject on tool cards; debug bridge `/approve`, `/reject` (optional
  `callIds` array). State helpers: `pendingHitlCall`, `pendingApprovalCalls`.

### Adding a new tool

1. **MCP** — discovered automatically on connect; registry row created on sync.
2. **Built-in Code** — add to `CODE_TOOL_DEFINITIONS`, implement in
   `buildCodeTools`, add Rust command in `fs.rs` (path scoping mandatory).
3. If sensitive, add name to `SENSITIVE_CODE_TOOLS` in `code-tools.ts`.
4. Extend `pnpm test:unit` if you add pure policy/name logic.

See also `CODE_MODE_BRIEF.md`, `CODE_TOOLS_SDK_NOTES.md`, `HANDOFF.md` (roadmap).

## Commit messages

Conventional, imperative subject; brief body on the why + what was verified. End
with:

```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Conventions (see HANDOFF.md for the full list)

- No source file over 600 lines — split by concern.
- Match the surrounding file's style.
- **Use Ant Design X / antd components — do NOT hand-roll UI (hard rule).** The
  chat UI is Ant Design X (`Bubble.List`, `Sender`, `ThoughtChain`,
  `Welcome`/`Prompts`, `XMarkdown`, `CodeHighlighter`) under `XProvider`;
  everything else (buttons, lists, forms, tabs, menus…) is antd. A raw
  `<button>`, `<ul>/<li>`, `<label>`, or a `<div>`+CSS control is a smell.

  **Before writing any UI, invoke the relevant skill** for the right component
  and its real API (don't guess props/names):
  - `antd` — every antd primitive: `Button`, `Input`, `List`, `Tag`, `Form`,
    `Menu`, `Tabs`, `Segmented`, `Collapse`, `Switch`, `Tooltip`, `Popconfirm`,
    `Drawer`, `Empty`, `Select`, `AutoComplete`… plus tokens, theming, demos.
  - `x-components` — Bubble, Sender, ThoughtChain, Conversations, Welcome,
    Prompts, Attachments, Actions, Suggestion, Think, FileCard, XProvider…
  - `x-markdown` — Markdown rendering / streaming / custom component mapping.
  - `use-x-chat`, `x-chat-provider`, `x-request` — chat data/transport hooks.
  - `x-card` — `@ant-design/x-card` for AI-driven card UIs.

  **Raw element → reach for instead:** `<button>` → `Button` (`type="text"` for
  ghost/icon buttons); `<ul>/<li>` list → `List` or `Menu`; a chip/pill →
  `Tag`; label+input rows → `Form` / `Form.Item`; a vertical icon rail →
  `Menu` (`mode="inline"`, `inlineCollapsed`) or `Segmented`; tab strip →
  `Tabs`; expander → `Collapse`.

  If a component's built-in behavior doesn't fit, **use it as a shell and opt
  out** of the unwanted part (e.g. antd `Tabs type="editable-card"` as a pure
  tab-strip: `items` with `key`/`label`/`icon` and NO `children`, driven by
  `activeKey`/`onChange`/`onEdit`, sessions rendered separately). Hand-roll only
  as a last resort, match antd tokens, and log it in the HANDOFF backlog.

  **Known debt to migrate to antd** (hand-rolled in the rail/tabs work): `TabBar`
  (→ `Tabs`), `SideRail` items (→ `Menu`/`Segmented` + `Button`), `CodeModeToggle`
  folder chip (→ `Tag`), `ProjectsPanel` session list (→ `List`), `SettingsPanel`
  fields (→ `Form`), and the `<button>`s in `App.tsx` (→ `Button`).
- Keep the agent loop, MCP Apps sandbox, persistence, and observability intact.
