# Omni Desktop

A native Linux desktop agent (Tauri + React) that works with **any model** (via
OpenRouter, later) and renders **interactive MCP App UIs** in a slide-out side
pane — forms, dropdowns, pickers, etc. summoned by tool calls during a
conversation.

This repo currently contains the **host shell**: the two-pane layout, the
slide-out animation, and a faithful port of the MCP Apps **host bridge** wired
to a cross-origin sandbox. The agent/model loop (OpenRouter) is the next layer.

---

## Architecture

```
Tauri shell (native Linux window, webview on :1420)
├─ Pane 1  React chat / controls            ← src/App.tsx
├─ Pane 2  slide-out MCP App surface         ← src/components/AppPane.tsx
│            └─ OUTER sandbox iframe  ──────────────┐  (src points at :1430)
│                 └─ INNER iframe (untrusted app HTML, document.write)
│
├─ Host bridge (AppBridge wiring)            ← src/mcp/host-bridge.ts
│    └─ MCP Client  ──HTTP/SSE──►  MCP App server(s)
│
└─ Cross-origin sandbox proxy (:1430)        ← sandbox-server.ts + src/mcp/sandbox.ts
```

### Why two origins (this is the load-bearing rule)

The MCP Apps spec **requires** the sandbox to run on a *different origin* than
the host. We satisfy that with:

- **Host** on `http://localhost:1420` (Vite / Tauri webview).
- **Sandbox proxy** on `http://localhost:1430` (`sandbox-server.ts`).

Untrusted app HTML never touches the host origin. It is `document.write`-n into
an **inner** iframe that lives inside the **outer** sandbox iframe (the relay,
`src/mcp/sandbox.ts`), which only forwards validated postMessages between host
and app. CSP is applied as an **HTTP header** built per-request from the app's
`?csp=` metadata — tamper-proof, unlike a `<meta>` tag.

---

## The host-bridge interface (verified against ext-apps `basic-host`)

`AppBridge` (from `@modelcontextprotocol/ext-apps/app-bridge`) is **provided** —
we wire it, we don't reimplement the protocol. The full lifecycle for one app
activation, as implemented in `src/mcp/host-bridge.ts`:

```
callTool(serverInfo, name, input)            // invoke tool; if it declares
   → ToolCallInfo { resultPromise,           //   _meta.ui.resourceUri, also
                    appResourcePromise }      //   readResource() the UI html+csp

mountApp(iframe, toolCallInfo, callbacks):
   1. await appResourcePromise               // get { html, csp, permissions }
   2. loadSandboxProxy(iframe, csp, perms)    // iframe.src = :1430/sandbox.html?csp=…
      → resolves on "ui/notifications/sandbox-proxy-ready"
   3. newAppBridge(serverInfo, iframe, cb)    // construct + register handlers
   4. initializeApp(iframe, bridge, info):
        bridge.connect(new PostMessageTransport(win, win))
        bridge.sendSandboxResourceReady({ html, csp, permissions })
        await oninitialized                    // inner iframe ready
        bridge.sendToolInput({ arguments })
        resultPromise.then(sendToolResult, sendToolCancelled)
```

**Host → app methods** (we call these): `connect`, `sendSandboxResourceReady`,
`sendToolInput`, `sendToolResult`, `sendToolCancelled`, `sendHostContextChange`.

**App → host callbacks** (we handle these, registered *before* `connect()`):
`onmessage`, `onopenlink`, `onloggingmessage`, `onupdatemodelcontext`,
`onsizechange`, `onrequestdisplaymode`, `oninitialized`.

`onupdatemodelcontext` is the important one for the agent layer: it's how an app
pushes structured data (a submitted form, a chosen value) **back into the model's
context**. We surface it via the `onContextUpdate` callback (see App.tsx).

> Model-agnostic by construction: the model's only job is to *call a tool*. It
> never generates UI. The host renders deterministically from the tool's
> `ui://` metadata, so every tool-calling model behaves identically.

---

## Run it (dev)

Native window (needs Linux system deps — see below):

```bash
pnpm tauri dev
```

This runs `pnpm dev:all` (host on :1420 **and** the sandbox proxy on :1430) then
opens the Tauri window.

Browser-only (no native deps, good for UI work):

```bash
pnpm dev:all        # host :1420 + sandbox :1430
# open http://localhost:1420
```

### Required Linux system packages (Fedora 44)

The Tauri scaffold flagged `webkit2gtk` + `rsvg2` missing. Install:

```bash
sudo dnf install webkit2gtk4.1-devel librsvg2-devel \
  gtk3-devel libappindicator-gtk3-devel \
  openssl-devel curl wget file
```

(Frontend-only `pnpm dev:all` and `pnpm build` work **without** these.)

### NVIDIA + Wayland note (already handled)

On NVIDIA under Wayland, WebKitGTK's DMA-BUF renderer triggers a GDK
"Error 71 (Protocol error)" that crashes the window before it draws. The fix is
baked into `src-tauri/src/lib.rs`: we set `WEBKIT_DISABLE_DMABUF_RENDERER=1` at
the top of `run()` (Linux only, respecting any user override). This applies to
both `tauri dev` and the bundled app — no shell env or wrapper needed. (Note:
this is independent of which GPU driver you run; it reproduced on both nouveau
and the proprietary driver.)

### Test end-to-end with a real MCP App server

The host needs something that serves an MCP App. Use an ext-apps example:

```bash
git clone https://github.com/modelcontextprotocol/ext-apps.git
cd ext-apps/examples/qr-server && npm install && npm run build && npm run serve
# serves an MCP App server on http://localhost:3001/mcp
```

Then in Omni Desktop: connect to `http://localhost:3001/mcp`, and click a tool
marked `app`. The side pane slides out and renders the app's UI.

---

## Status / next steps

- [x] Tauri + React scaffold, two-pane slide-out shell
- [x] MCP Apps host bridge (AppBridge) ported + wired
- [x] Cross-origin sandbox proxy with per-request CSP header
- [ ] **OpenRouter agent loop** — model picker + tool-calling; route tool calls
      with `_meta.ui` to the pane. (`@openrouter/agent`)
- [ ] **OS keyring** for the OpenRouter API key (libsecret).
- [ ] **Production cross-origin** — in a bundled app there's no Vite. Run the
      `sandbox-server.ts` logic as a **Tauri sidecar** bound to a localhost port,
      and update `ALLOWED_REFERRER_PATTERN` in `src/mcp/sandbox.ts` +
      `VITE_SANDBOX_URL` to match the packaged host origin.
- [ ] Multiple concurrent apps / pane history (currently one app at a time).

## Layout

| Path | Role |
|------|------|
| `src/App.tsx` | Host shell: connect, tool list, activation, context log |
| `src/components/AppPane.tsx` | Slide-out pane; drives `mountApp` lifecycle |
| `src/mcp/host-bridge.ts` | AppBridge wiring (the load-bearing port) |
| `src/mcp/sandbox.ts` | Outer-iframe relay (runs on :1430, cross-origin) |
| `src/mcp/host-styles.ts` / `theme.ts` | host context styles + theme |
| `sandbox-server.ts` | Serves the relay with tamper-proof CSP header on :1430 |
