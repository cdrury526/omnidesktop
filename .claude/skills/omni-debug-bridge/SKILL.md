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
- Snapshots save to `snapshots/omni-<unix-millis>.png`
- Dev-only: the whole bridge is gated to debug builds (`#[cfg(debug_assertions)]`
  + `import.meta.env.DEV`); it never exists in a release build.

## Driving form fields (Tier 2)

Form-field driving (`/forminput`, `/formclick`) is **on by default** in dev — the
forms server injects a runtime flag and widens only the form's connect-src. Just
run it normally; opt out later with `OMNI_DEBUG=0`:

```bash
cd servers/forms && INPUT=mcp-app.html pnpm exec vite build && PORT=3002 bun main.ts
```

## Reliable scenario pattern

Use `/openform` for **deterministic** forms (it forces the tool call, so it never
depends on the model's phrasing). `/forminput` waits for the form via the command
queue — no readiness polling needed; it fails fast (~12s) with a clear error if
no form opened.

```bash
curl -sS -X POST :1456/newchat
curl -sS -X POST :1456/openform -d '{"spec":{"v":1,"title":"T","fields":[{"id":"email","type":"email","label":"Email"}]}}'
curl -sS -X POST :1456/forminput -d '{"id":"email","value":"a@b.com"}'
curl -sS -X POST :1456/formclick -d '{"target":"submit"}'
```

(`/send "make a form"` also works but relies on the model emitting the tool call;
prefer `/openform` for deterministic UI tests.)

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

# cancel the pending interactive form (agent unblocks, card -> cancelled)
curl -sS -X POST http://127.0.0.1:1456/cancel

# start a fresh conversation (test isolation — do this before a scenario)
curl -sS -X POST http://127.0.0.1:1456/newchat

# deterministically open a form from a DSL spec (forced tool call — no model luck)
curl -sS -X POST http://127.0.0.1:1456/openform -H 'content-type: application/json' \
  -d '{"spec":{"v":1,"title":"T","fields":[{"id":"email","type":"email","label":"Email"}]}}'

# --- synthetic USER INPUT on the host document ---
curl -sS -X POST http://127.0.0.1:1456/type  -H 'content-type: application/json' \
  -d '{"selector":".composer textarea","text":"hello"}'
curl -sS -X POST http://127.0.0.1:1456/press -H 'content-type: application/json' \
  -d '{"selector":".composer textarea","key":"Enter"}'   # drives the REAL send path
curl -sS -X POST http://127.0.0.1:1456/click -H 'content-type: application/json' \
  -d '{"selector":".app-pane-close"}'                     # or any host button / Ant Modal btn

# --- user input INSIDE the cross-origin form iframe (needs OMNI_DEBUG, see below) ---
curl -sS -X POST http://127.0.0.1:1456/forminput -H 'content-type: application/json' \
  -d '{"id":"country","value":"Japan"}'
curl -sS -X POST http://127.0.0.1:1456/formclick -H 'content-type: application/json' \
  -d '{"target":"submit"}'    # submit | cancel | next | back

# computed box + layout styles of HOST elements (the key tool for layout bugs)
curl -sS 'http://127.0.0.1:1456/dom?selector=.app-pane-surface%20iframe'

# the FORM iframe's self-reported interior layout (it is cross-origin; /dom
# cannot pierce it, so the form app reports its own metrics via sendLog)
curl -sS http://127.0.0.1:1456/formdom

# the source-attributed activity timeline — turns, queue, form, repair, errors.
# THE tool for "this weird thing happened": the `source` column separates user
# actions from debug-bridge pokes from agent machinery (queue/repair/system).
curl -sS 'http://127.0.0.1:1456/events?limit=50'   # newest first; ?since=<id> to tail

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
