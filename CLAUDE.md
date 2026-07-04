# CLAUDE.md

See **`AGENTS.md`** for the full agent guide, and **`HANDOFF.md`** for the
engineering brief.

## The rules that matter most

- **Work on `main`. No feature branches or PRs by default.**
- **After verifying a change works, commit AND push to `origin/main` without
  asking.** Approval to commit/push is standing — don't prompt for it. Commit
  often, in small coherent units.
- **Verify before committing** — `tsc --noEmit`, `vite build`, `pnpm test:unit`
  (when agent/tools changed), `cargo build` (when Rust changed), and drive the
  running app via the `omni-debug-bridge` skill. Don't commit on red.
- **Trust `/dom`, not `/snapshot`** — the bridge's `/dom` returns each node's
  visible `text` + resolved `styles.color`/`backgroundColor`; use them to verify
  content/theme/contrast. The html2canvas `/snapshot` drops variable-driven text
  and the cross-origin iframe → false negatives; it's for rough layout only.
- **Schema changes go through migrations** — add a `schema/NNNN_*.sql` + a
  `Migration` entry in `src-tauri/src/db/migrations.rs` (versioned, applied at
  startup). Never hand-edit the live schema; use `ALTER TABLE … ADD COLUMN`.
- **Never commit local/secret files**: `.env`, `.cursor/`, `.claude/projects/`,
  `.firecrawl/`, `google-cloud-sdk/`, `tools/`, `dist/`, `target/`.
- End commit messages with the `Co-Authored-By` trailer (see AGENTS.md).
- Keep files under 600 lines.
- **Use Ant Design X / antd components — do NOT hand-roll UI.** This is a hard
  rule, not a preference. A raw `<button>`, `<ul>/<li>`, `<label>`, or a control
  built from `<div>` + custom CSS is a code smell — reach for the antd primitive
  instead: `Button`, `List`, `Tag`, `Form`, `Menu`, `Tabs`, `Segmented`,
  `Collapse`, `Switch`, `Tooltip`, `Popconfirm`, etc. (icons from
  `@ant-design/icons`).
- **Before writing ANY UI, invoke the relevant UI skill** to get the right
  component + its real API: **`antd`** (all antd primitives, props, tokens,
  demos), **`x-components`** (Bubble, Sender, ThoughtChain, Conversations,
  Welcome, Prompts, Attachments…), **`x-markdown`**, **`use-x-chat`**,
  **`x-card`**. Don't guess component names or props — ask the skill.
- If a component's built-in behavior doesn't fit, **use it as a shell and opt out
  of the part you don't want** (e.g. antd `Tabs` as a pure tab-strip with no
  panels) rather than reimplementing it. Only hand-roll as a last resort — and
  then match antd tokens and record it in the HANDOFF backlog. Full mapping +
  skill list in AGENTS.md.
- **Tools go through one pipeline** — never register tools ad hoc in hooks or
  `App.tsx`. Use `buildAgentTools()` for every `callModel` invocation; persist
  enable/disable in `tool_registry`; look up OpenRouter SDK tool/approval APIs in
  `docs/openrouter-agent-sdk/` via `pnpm docs:search` (see AGENTS.md).
