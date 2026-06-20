# Omni Desktop

A native Linux desktop AI assistant (Tauri + React) that works with **any model**
via [OpenRouter](https://openrouter.ai), and renders **interactive MCP App UIs**
in a slide-out pane — forms, pickers, dashboards summoned by the model's tool calls.

The model only ever *calls a tool*; the host renders the UI deterministically
from the tool's `ui://` resource. So rich, interactive panels work identically
across every tool-capable model — no per-provider UI code.

## Features

- **Any model** — searchable picker over OpenRouter's full model catalog (filtered
  to tool-capable models). Swap Claude / GPT / Gemini / DeepSeek / Llama with one click.
- **Auto-summoning app pane** — when the model calls a tool that ships an
  [MCP App](https://modelcontextprotocol.io) UI, a sandboxed panel slides out and
  renders it; results flow back into the conversation.
- **Secure by design** — the API key lives in the OS keyring; the DB and any cloud
  token stay behind the Rust boundary, never exposed to the webview that hosts the
  untrusted MCP App iframes (double-iframe, per-request CSP sandbox).
- **Persistent history** — conversations and messages stored locally (libSQL),
  with a searchable Ant Design history drawer.
- **Local-first data, sync-ready** — libSQL embedded database now; flip a Cargo
  flag to sync to [Turso](https://turso.tech) later, no schema or query changes.

## Architecture

```
Tauri shell (native window)
├─ React + Ant Design  ── chat, model picker, history drawer
├─ Slide-out App pane   ── sandboxed iframe rendering MCP App UIs
│     └─ cross-origin sandbox proxy (:1430) + AppBridge   [MCP Apps spec]
├─ OpenRouter agent SDK ── tool-calling loop; tool execute → MCP call → auto-summon
│     └─ HTTP routed through Rust (Tauri http plugin) to avoid webview CORS
└─ Rust core
      ├─ OS keyring (API key)
      └─ libSQL data layer  (settings · mcp_servers · tabs · conversations · messages)
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
connect to an MCP server, and chat. To try the app pane, run an
[ext-apps](https://github.com/modelcontextprotocol/ext-apps) example server on
`http://localhost:3001/mcp` and ask the model to use one of its tools.

> **NVIDIA + Wayland:** WebKitGTK's DMA-BUF renderer crashes on NVIDIA/Wayland;
> the app sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` in the Rust entrypoint, so no
> manual workaround is needed.

## Project layout

| Path | Role |
|------|------|
| `src/App.tsx` | Host shell: chat, model/key/server, persistence wiring |
| `src/components/AppPane.tsx` | Slide-out pane; drives the MCP App bridge lifecycle |
| `src/components/HistoryDrawer.tsx` | Searchable conversation history (Ant Design) |
| `src/agent/runner.ts` | OpenRouter agent loop; MCP tools → SDK tools w/ auto-summon |
| `src/mcp/host-bridge.ts` | MCP Apps host bridge (AppBridge wiring) |
| `src/lib/db.ts` · `src/lib/secrets.ts` | DB + keyring frontend APIs |
| `src-tauri/src/db.rs` | libSQL data layer behind `db_execute`/`db_select` commands |
| `sandbox-server.ts` | Cross-origin sandbox proxy with per-request CSP |

## Roadmap

- Turso cloud sync (flag-flip in `src-tauri/Cargo.toml`)
- Production cross-origin sandbox (run the proxy as a Tauri sidecar)
- MCP server manager UI · conversation rename · multiple concurrent app panes

## Tech

Tauri 2 · React 19 · Ant Design 6 · `@openrouter/agent` · `@modelcontextprotocol/ext-apps` · libSQL · keyring
