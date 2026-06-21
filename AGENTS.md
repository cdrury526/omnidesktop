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
