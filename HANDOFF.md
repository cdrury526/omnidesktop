# HANDOFF — Omni Desktop

Context for the next agent picking up this project. Read this + `README.md`
first. The README is user-facing; this is the engineering brief.

## What this is

Native Linux desktop AI app (Tauri 2 + React 19 + Ant Design 6). Chat with any
OpenRouter model; when the model calls an MCP tool that ships a UI (`_meta.ui`),
a sandboxed panel auto-slides-out and renders it. Everything runs locally; data
in libSQL, API key in the OS keyring.

Status: **working end-to-end and pushed to GitHub** (`cdrury526/omnidesktop`).
Verified live: model picker, keyring, MCP connect, agent tool-calling,
auto-summon pane rendering a real MCP App, chat history persistence + drawer.

## Run / verify

```bash
pnpm install
pnpm tauri dev          # Vite :1420 + sandbox proxy :1430 + native window
```
- Frontend typecheck: `./node_modules/.bin/tsc --noEmit`
- Frontend build: `./node_modules/.bin/vite build`
- Rust build: `cd src-tauri && cargo build`
- A demo MCP App server: clone `modelcontextprotocol/ext-apps`, then
  `cd examples/basic-server-react && bun install && bun run build && PORT=3001 bun main.ts`
  (serves `http://localhost:3001/mcp`).

## Where everything is

| Area | File |
|------|------|
| Host shell (chat, model/key/server, persistence wiring) | `src/App.tsx` |
| Slide-out MCP App pane (bridge lifecycle) | `src/components/AppPane.tsx` |
| Searchable history drawer (Ant) | `src/components/HistoryDrawer.tsx` |
| Model picker (Ant Select over OpenRouter catalog) | `src/components/ModelPicker.tsx` |
| **Agent loop** (OpenRouter SDK; MCP tools → SDK tools; auto-summon) | `src/agent/runner.ts` |
| Model catalog fetch | `src/agent/models.ts` |
| JSON Schema → Zod (for SDK `tool()` inputSchema) | `src/agent/json-schema-to-zod.ts` |
| **MCP Apps host bridge** (AppBridge wiring) | `src/mcp/host-bridge.ts` |
| Sandbox relay (runs in the cross-origin outer iframe) | `src/mcp/sandbox.ts` |
| Host context styles / theme for app UIs | `src/mcp/host-styles.ts`, `src/mcp/theme.ts` |
| DB frontend API + helpers | `src/lib/db.ts` |
| Keyring frontend API | `src/lib/secrets.ts` |
| Native fetch (Rust-routed, CORS bypass) | `src/lib/tauri-fetch.ts` |
| Cross-origin sandbox proxy server (per-request CSP) | `sandbox-server.ts` |
| Rust entrypoint (Wayland fix, plugins, DB init, commands) | `src-tauri/src/lib.rs` |
| Rust libSQL data layer (`db_execute`/`db_select`) | `src-tauri/src/db.rs` |
| Tauri config / capabilities | `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json` |

DB file at runtime: `~/.local/share/com.drury.omni-desktop/omni.db`
(tables: `settings`, `mcp_servers`, `tabs`, `conversations`, `messages`).

## Conventions / rules

- **No source file over 600 lines.** If a file approaches it, split by concern.
  Current largest: `host-bridge.ts` (352), `App.tsx` (326) — watch these; if
  `App.tsx` grows, extract hooks (e.g. `useConversations`, `useAgentChat`).
- **Match surrounding style.** Comment density, naming, and idiom already vary
  by file — follow the file you're in.
- **Secrets never cross into the webview.** API key → keyring (Rust); DB and any
  future Turso token → Rust only. The webview hosts *untrusted* MCP App iframes,
  so anything sensitive stays behind a Tauri command. Do not add a frontend HTTP
  client that holds credentials.
- **MCP App content is untrusted.** The double-iframe + per-request CSP sandbox
  (`sandbox.ts` + `sandbox-server.ts`) is load-bearing security — don't relax the
  iframe `sandbox`/CSP or collapse the cross-origin split.
- **Ported code stays faithful.** `host-bridge.ts`, `sandbox.ts`, `host-styles.ts`
  are ports of `modelcontextprotocol/ext-apps` `basic-host`; keep them aligned
  with upstream so spec updates are easy to track.
- **Verify before claiming done:** typecheck + the relevant build. State what you
  actually ran.
- Commit messages end with the Co-Authored-By trailer; push to `origin/main`.

## Gotchas (hard-won — don't rediscover these)

- **NVIDIA/Wayland:** WebKitGTK DMA-BUF renderer crashes the window (GDK "Error
  71"). Fixed by `WEBKIT_DISABLE_DMABUF_RENDERER=1` set at the top of
  `run()` in `lib.rs`. Independent of GPU driver.
- **CORS:** OpenRouter calls from the webview fail ("Load failed"). All external
  HTTP goes through the Tauri http plugin via `src/lib/tauri-fetch.ts` →
  injected into the SDK as a custom `HTTPClient({ fetcher })` and used by
  `models.ts`. Scope is `https://openrouter.ai/*` in `capabilities/default.json`.
- **pnpm 11:** `pnpm-workspace.yaml` has `verifyDepsBeforeRun: false` (a harmless
  `@openrouter/sdk` postinstall otherwise makes `pnpm install` exit non-zero and
  breaks `tauri dev`) and `onlyBuiltDependencies: [esbuild, @openrouter/sdk]`.
- **Ports:** host 1420, sandbox proxy 1430. To free them without self-killing the
  shell, use `fuser -k -n tcp <port>` (not `pkill -f vite`).
- **libSQL is local-only now** (`core` feature). Turso sync = add features
  `replication, remote, sync, tls` in `src-tauri/Cargo.toml` and swap
  `Builder::new_local` → `new_remote_replica(path, url, token)` in `db.rs`
  (token in keyring). No schema/query/frontend changes.
- **Production sandbox:** in a bundled build there's no Vite/sandbox-server. The
  proxy must be run as a Tauri sidecar (or equivalent) on a separate origin.
  Currently dev-only.

## NEXT TASK — evaluate conversation continuity vs. SDK leverage

The user wants to know whether our "continue a past conversation" approach
**fully leverages the OpenRouter agent SDK**. Honest current state:

- We persist only `{role, content}` *text* per turn (`messages` table). On send,
  `runTurn` rebuilds `input` from that text via `fromChatMessages(history)` and
  spins up a **fresh `OpenRouter` instance each turn**. We do **not** use the
  SDK's `state`/`StateAccessor` (`createInitialState`/`updateState`/
  `conversation-state` helpers), and we do **not** persist tool calls or tool
  results.

Likely gap: continuity is *text-only replay*. The SDK is built around the
Responses-API item stream (incl. `function_call` / `function_call_output`
items) and a `StateAccessor` for stateful multi-turn. So when resuming a chat,
the model sees prior **answers** but not the prior **tool interactions** (which
tool ran, with what args, and the exact result) — it can't reference exact tool
outputs or know it already did something.

Things to investigate / decide:
1. Should we persist full message items (`toChatMessage`/raw `OpenResponsesResult`
   output incl. tool calls/results), not just assistant text?
2. Should we adopt the SDK `StateAccessor` pattern with a DB-backed persistence
   adapter, instead of reconstructing `input` each turn?
3. Is per-turn `new OpenRouter()` fine, or should the client/state be retained?
4. What's the right schema for richer history (a `role`+`content` text table is
   lossy for tool turns)?

Relevant SDK exports (see `node_modules/@openrouter/agent/esm/index.d.ts`):
`createInitialState`, `updateState`, `appendToMessages`, `StateAccessor`,
`ConversationState`, `toChatMessage`, `fromChatMessages`, `ModelResult.getState()`.

## Backlog

Turso sync · production sandbox sidecar · MCP server manager UI · conversation
rename · multiple concurrent app panes · code-split the 1MB+ JS bundle.
