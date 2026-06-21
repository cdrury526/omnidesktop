---
name: omni-debug-bridge
description: Drive and inspect the Omni Desktop Tauri app headlessly over its localhost debug API — connect MCP servers, send chat turns, resolve interactive forms, read computed DOM layout (incl. the cross-origin form iframe interior), and snapshot. Use when iterating on Omni Desktop's chat UI, MCP App panes, interactive forms, or any layout/agent behavior, so you can verify changes without a human clicking.
---

# Omni Debug Bridge

A local HTTP server inside the app (`127.0.0.1:1456`) lets an agent drive and
introspect the running app. The loop is: drive over `curl`, read computed
layout / state, patch, re-verify — no human in the loop.

Implementation: `src-tauri/src/debug.rs` (HTTP server + request/response
correlation via `debug://request` events) and `src/lib/debug-bridge.ts` (the
webview handlers). The bridge starts automatically with the app in dev.

## Assumptions

- Repo root: `/home/drury/projects/omni-desktop`
- Host UI (Vite): `http://localhost:1420`, sandbox proxy: `http://localhost:1430`
- Debug API: `http://127.0.0.1:1456`
- A demo forms server runs at `http://localhost:3002/mcp`
  (`cd servers/forms && INPUT=mcp-app.html pnpm exec vite build && PORT=3002 bun main.ts`)
- Snapshots save to `snapshots/omni-<unix-millis>.png`

## Start / reuse the app

```bash
curl -sS http://127.0.0.1:1456/health           # {"ok":true} if running
```

If down, the user starts it with `pnpm tauri dev` (it can't be launched
headlessly — it opens a native window). `tauri dev` auto-restarts the app on
**Rust** changes; **frontend** changes hot-reload; **sandbox** changes
(`sandbox-server.ts` / `src/mcp/sandbox.ts`) need a full `pnpm tauri dev`
restart (the sandbox server runs under `concurrently -k`).

## Endpoints

```bash
# liveness
curl -sS http://127.0.0.1:1456/health

# connect an MCP server (so a turn has tools)
curl -sS -X POST http://127.0.0.1:1456/connect -H 'content-type: application/json' \
  -d '{"url":"http://localhost:3002/mcp"}'

# run a chat turn (drives the agent; resolves when it completes or pauses)
curl -sS -X POST http://127.0.0.1:1456/send -H 'content-type: application/json' \
  -d '{"text":"Show a test form: a text field Email and a dropdown Color (red/green/blue)."}'

# active conversation: id, pending HITL call (incl. the form spec), transcript items
curl -sS http://127.0.0.1:1456/state

# resolve the pending interactive form headlessly (skip clicking the panel)
curl -sS -X POST http://127.0.0.1:1456/submit -H 'content-type: application/json' \
  -d '{"values":{"email":"a@b.com","color":"green"}}'

# computed box + layout styles of HOST elements (the key tool for layout bugs)
curl -sS 'http://127.0.0.1:1456/dom?selector=.app-pane-surface%20iframe'

# the FORM iframe's self-reported interior layout (it is cross-origin; /dom
# cannot pierce it, so the form app reports its own metrics via sendLog)
curl -sS http://127.0.0.1:1456/formdom

# html2canvas PNG of the host UI -> snapshots/ (note: the cross-origin form
# iframe renders BLANK in snapshots — use /dom and /formdom for form layout)
curl -sS http://127.0.0.1:1456/snapshot
```

## Iteration procedure

1. Reproduce through the API: `/connect`, `/send` to trigger the UI state.
2. Inspect with `/state` (agent/data), `/dom` (host layout), `/formdom` (form
   interior). Prefer computed styles over screenshots for layout bugs — they
   show *why* (e.g. `height: 0`, collapsed flex), not just that it looks wrong.
3. Patch the smallest relevant layer.
4. Verify: `tsc --noEmit`, `vite build`, `cargo build --manifest-path src-tauri/Cargo.toml`.
5. Re-run the API flow and re-inspect.

## Layout gotcha (hard-won)

The form renders through a **double iframe**: host outer iframe → cross-origin
sandbox proxy (`:1430`) → inner app iframe. A `height: 100%` chain only resolves
if **every** ancestor has a definite height. The collapse can hide at any level
— check all three with `/dom` (outer iframe element) and `/formdom`
(`viewport.h` = inner iframe height the form actually sees). If `/dom` shows the
outer iframe tall but `/formdom` shows a short `viewport.h`, the sandbox proxy
document is the collapsed layer.
