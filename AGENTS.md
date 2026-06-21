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
- The chat UI is Ant Design X (`Bubble.List`, `Sender`, `ThoughtChain`,
  `Welcome`/`Prompts`, `XMarkdown`, `CodeHighlighter`) under `XProvider`; forms
  are antd. Prefer the X/antd primitives over hand-rolling. Use the
  `x-components`, `x-markdown`, `antd` skills before writing UI code.
- Keep the agent loop, MCP Apps sandbox, persistence, and observability intact.
