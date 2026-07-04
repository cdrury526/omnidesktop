# Omni Desktop

A native Linux desktop AI assistant (Tauri + React) that works with **any model**
via [OpenRouter](https://openrouter.ai), and renders **interactive MCP App UIs**
inline in the transcript — forms, pickers, dashboards summoned by the model's
tool calls.

The model only ever *calls a tool*; the host renders the UI deterministically
from the tool's `ui://` resource. So rich, interactive panels work identically
across every tool-capable model — no per-provider UI code.

## Features

- **Any model** — searchable picker over OpenRouter's full model catalog (filtered
  to tool-capable models). Swap Claude / GPT / Gemini / DeepSeek / Llama with one click.
- **Polished chat UI (Ant Design X)** — streaming Markdown that fades in as it
  arrives, code blocks rendered as copy-able cards with syntax highlighting, tool
  calls shown as expandable `ThoughtChain` steps, and a `Welcome` + starter
  `Prompts` empty state. Light/dark theme follows the OS.
- **Inline MCP Apps** — when the model calls a tool that ships an
  [MCP App](https://modelcontextprotocol.io) UI, a sandboxed iframe renders on
  that tool card in the transcript; results flow back into the conversation.
  Interactive forms (antd inputs) pause the agent for human input and resume on
  submit — surviving reload.
- **Workspace shell** — open multiple chats as tabs, keep background sessions
  mounted while they stream, split the workspace into two panes, and group Code
  mode chats by project folder.
- **Secure by design** — the API key lives in the OS keyring; the DB and any cloud
  token stay behind the Rust boundary, never exposed to the webview that hosts the
  untrusted MCP App iframes (double-iframe, per-request CSP sandbox).
- **Persistent history** — conversations and full SDK state stored locally
  (libSQL) with a versioned-migration schema, plus a searchable history drawer.
- **Local-first data, sync-ready** — libSQL embedded database now; flip a Cargo
  flag to sync to [Turso](https://turso.tech) later, no schema or query changes.

## Architecture

```
Tauri shell (native window)
├─ React + Ant Design X ── workspace tabs/split view; streaming chat
│                          (Bubble · Sender · ThoughtChain · XMarkdown)
├─ Inline MCP Apps     ── sandboxed iframe mounted on the tool card
│     └─ cross-origin sandbox proxy (:1430) + AppBridge   [MCP Apps spec]
├─ OpenRouter agent SDK ── tool-calling loop; tool execute → MCP call → auto-summon
│     └─ HTTP routed through Rust (Tauri http plugin) to avoid webview CORS
└─ Rust core
      ├─ OS keyring (API key)
      └─ libSQL data layer  ── versioned migrations; conversations ·
                               conversation_state · messages · events · …
```

## Prerequisites

- [Rust](https://rustup.rs) + [Node 18+](https://nodejs.org) + [pnpm](https://pnpm.io)
- Linux system deps (Fedora):
  ```bash
  sudo dnf install webkit2gtk4.1-devel librsvg2-devel gtk3-devel \
    libappindicator-gtk3-devel openssl-devel curl wget file
  ```

## Run

```bash
pnpm install
pnpm tauri dev      # starts Vite + the cross-origin sandbox proxy + the window
```

Then in the app: pick a model, paste your OpenRouter API key (saved to the keyring),
connect to an MCP server, and chat. To try an inline MCP App, run an
[ext-apps](https://github.com/modelcontextprotocol/ext-apps) example server on
`http://localhost:3001/mcp` and ask the model to use one of its tools.

> **NVIDIA + Wayland:** WebKitGTK's DMA-BUF renderer crashes on NVIDIA/Wayland;
> the app sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` in the Rust entrypoint, so no
> manual workaround is needed.

## Project layout

| Path | Role |
|------|------|
| `src/App.tsx` | Host shell: connection, model/key, conversation list, render |
| `src/hooks/useAgentChat.ts` | Chat session: transcript, composer, turn/HITL/queue/cancel |
| `src/components/MarkdownCode.tsx` | Themed streaming Markdown + code cards (copy button) |
| `src/components/InlineAppMount.tsx` | Inline sandbox iframe for MCP App tool cards |
| `src/components/TabBar.tsx` · `SideRail.tsx` | Workspace tabs/split controls · navigation rail |
| `src/components/panels/HistoryPanel.tsx` · `ProjectsPanel.tsx` | History and project-folder panels |
| `src/components/ChatWelcome.tsx` | Empty-state Welcome+Prompts |
| `src/agent/runner.ts` | Agent barrel; see `src/agent/turns.ts`, `mcp-tools.ts`, `state-display.ts` |
| `src/mcp/host-bridge.ts` | MCP Apps host bridge (AppBridge wiring) |
| `src/lib/db.ts` · `src/lib/secrets.ts` | DB + keyring frontend APIs |
| `src-tauri/src/db/` | libSQL data layer (`mod.rs`) + versioned `migrations.rs` + `schema/` |
| `sandbox-server.ts` | Cross-origin sandbox proxy with per-request CSP |

## Roadmap

- Code mode filesystem tools: scoped read/list are in place; write/command next
  with default SDK approval plus optional yolo mode
- Conversation rename · retry/regenerate · MCP server manager UI
- Production cross-origin sandbox sidecar · bundle splitting
- Turso cloud sync after the local coding workflow is solid

## Tech

Tauri 2 · React 19 · Ant Design 6 + Ant Design X · `@openrouter/agent` · `@modelcontextprotocol/ext-apps` · libSQL · keyring
