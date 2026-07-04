# HANDOFF — Omni Desktop

Context for the next agent picking up this project. Read this + `README.md`
first. The README is user-facing; this is the engineering brief.

## What this is

Native Linux desktop AI app (Tauri 2 + React 19 + Ant Design 6). Chat with any
OpenRouter model; when the model calls an MCP tool that ships a UI (`_meta.ui`),
a sandboxed iframe renders **inline in the transcript**, embedded on its tool
card. Everything runs locally; data in libSQL, API key in the OS keyring.

Status: **working end-to-end and pushed to GitHub** (`cdrury526/omnidesktop`).
Verified live: model picker, keyring, MCP connect, agent tool-calling,
interactive forms (HITL) with durable pause/resume, message queuing, cancel,
**inline MCP Apps** (render / submit / cancel / content-hug sizing / cleanup).

## ▶ NEXT TASKS — roadmap for future sessions

The app is working end-to-end as a local AI desktop/workspace shell. The next
sessions should move in this order:

1. **Code mode phase 2 — filesystem tools** (`CODE_MODE_BRIEF.md`,
   `CODE_TOOLS_SDK_NOTES.md`) — add Rust-scoped `list_dir` / `read_file` first,
   then `write_file` / `run_command` behind SDK `requireApproval`: default
   ask/approve, optional `yolo` / `--dangerously-skip-permissions` that skips
   approval but never skips Rust path scoping, canonicalization, output limits,
   or event logging. The current Code mode is prompt/context only; Rust
   currently exposes only `path_is_dir`.
2. **Productize workspace basics** — conversation rename, retry/regenerate, MCP
   server manager UI, and real empty/error states for the Tools / Agents /
   Commands rail sections.
3. **Production hardening** — production sandbox sidecar, bundle splitting,
   README/release packaging sanity checks.
4. **Sync later** — Turso/cloud sync should wait until the local coding workflow
   is solid.

## ✅ DONE — Agent internals split (commit `10f2dfe`)

`src/agent/runner.ts` is now a barrel over focused modules:
`mcp-tools.ts`, `turns.ts`, `state-display.ts`, `telemetry.ts`,
`toolcall-leak.ts`, and `turn-repair.ts`. `useAgentChat.ts` was trimmed to the
600-line repo limit by extracting bridge result helpers, error copy, and hook
types. This should stay split before adding Code mode filesystem logic.

## ✅ DONE — Inline MCP Apps in the transcript (commit `5e055728`)

The slide-out `AppPane` (per-session, `position:absolute; right:0`) fought the
multi-pane workspace — entering split could surface a background tab's pending
form and crush the chat column via `margin-right`. Fixed by moving the live
interactive iframe **inline onto its tool card**:

- **`InlineAppMount`** (`src/components/InlineAppMount.tsx`) — extracted the
  iframe/host-bridge lifecycle from `AppPane`; mounts into the pending tool's
  `ThoughtChain` step (kept expanded so the form can't be collapsed away).
  Callbacks read via a ref so streaming re-renders don't tear down the form
  mid-edit. `AppPane.tsx` + its CSS (`.app-pane*`, `--pane-width`, the
  `:has(.app-pane.open)` margin rule) removed.
- **`ToolStep`** matches the single pending HITL call by name and renders the
  mount there; `useAgentChat` still owns `activation` / `onAppContext`.
- **Content-driven form sizing** — the forms app was `autoResize:false` and
  filled a fixed-height container, so inline (no definite height) the field area
  collapsed to the 150px default iframe height. Now the form flows at natural
  height (`servers/forms/src/global.css`, `mcp-app.tsx`) and the host grows the
  iframe via `onsizechange`; the embed hugs content (1→174px, 4→382px, 8→644px).
- HITL pause/resume (`runner.ts`), sandbox CSP, and the cross-origin boundary
  are unchanged.

**Bridge-testing note:** every mounted form runs the dev `/form-poll` loop, so
with many tabs open `/formclick`/`/forminput` can be consumed by a *background*
tab's form. Use host-side `/submit` + `/cancel` (act on the focused tab) for
deterministic headless tests, or test with a single tab.

## Model tool-call leak guard (commit `5e055728`)

Some models stream their **raw tool-call template** into the text channel
instead of emitting a structured call, then loop — flooding the transcript and
wedging the app. Seen with `deepseek/deepseek-v4-flash` on OpenRouter (its
`<｜…｜>` special tokens; ~18× repetition persisted to `conversation_state`).
`streamText` (`runner.ts`) now bails on the first `<｜…｜>` / `<|tool…|` token,
cancels the turn, and the hook shows a clean "malformed tool call — switch
models" notice; `displayItemsFromState` strips any persisted leaked tail so
reloads stay clean. **This is model/provider-specific** — prefer a reliable
tool-calling model (Anthropic/OpenAI/Gemini) for forms.

---

## Code mode — first slice DONE

The **Code mode first slice** landed in commit `0cdeeea`; follow-on workspace
work then added tabs persisted in DB (`0003`), missing-folder read-only chats,
auto MCP connect + `mcp.connect.*` events, and split view.

### First slice (commit `0cdeeea`)
- Migration `0002` — `code_mode` + `working_dir` columns on `conversations`
  (the first real `ALTER` through the migration framework).
- `@tauri-apps/plugin-dialog` (+ `dialog:allow-open` capability, plugin init in
  `lib.rs`) for the native directory picker (`src/lib/dialog.ts`).
- `getCodeMode`/`setCodeMode` in `src/lib/db.ts`; `useAgentChat` holds the
  `codeMode`/`workingDir` state, loads it in `hydrate`, persists on
  toggle/change and on new-chat creation. **New chats default to off.**
- `turns.ts` `instructionsFor(workingDir)` appends a Code-mode prompt section
  (explicitly honest that there are NO file tools yet); threaded through
  `runTurn`/`resumeTurn`/`repairToolCall`.
- `src/components/CodeModeToggle.tsx` — header Chat/Code switch + folder chip
  (name shown, full path on hover, change/clear).
- Decisions made (sensible defaults from the brief): per-conversation scope;
  mid-chat toggling/folder-change allowed (affects subsequent turns); columns
  on `conversations` (not a side table); prompt carries just the path.
- **Missing-folder guard** (local): bound path kept in DB; composer disabled +
  warning UI when path absent on disk; `path_is_dir` in Rust.
- Verified live via the bridge: migration applied (`user_version=2`); seeded a
  `working_dir`, switched via the history UI (`hydrate` restored mode + chip),
  and the model correctly reported the folder when asked. Native picker itself
  can't be driven headlessly (OS dialog), so that one click is unverified.

## DONE — Ant Design X adoption (merged to `main`)

`ANTD_X_ADOPTION_PLAN.md` is **implemented and merged**, one PR per phase
(PRs #10–#16, all merged), each bridge-verified before the next. The chat is now `Bubble.List` + `XMarkdown` + `Sender` + `ThoughtChain`
+ `Welcome`/`Prompts` under `XProvider`; the form inputs are antd (the native
datepicker bug is fixed). The `@openrouter/agent` loop, MCP Apps sandbox,
persistence, and observability are untouched. The two reported bugs (no
autoscroll; broken datepicker) are fixed.

What landed per phase: **0** theming/`XProvider` + React-19 patch; **1**
`Bubble.List`/`XMarkdown`; **2** `Sender` + real turn cancel (AbortSignal →
`result.cancel()`); **3** `ThoughtChain` tool cards; **4** `Welcome`+`Prompts`
empty state; **6** antd form inputs (servers/forms); **7** extracted
`useAgentChat` (App.tsx back under the 600-line cap) + dead-CSS/doc cleanup.

**Streaming works (correction).** An earlier note here claimed `tauri-fetch`
buffered the whole response — that was **wrong**, an artifact of the debug
bridge's `/dom` `text` field reading empty for live-rendering nodes (the same
field reads ThoughtChain titles as empty too). Verified by polling the streaming
bubble's **rendered height** instead: it climbs incrementally (e.g. 158→291→382→
571px over ~3s) as deltas arrive. The whole path streams — `@tauri-apps/plugin-http`
yields a chunked `ReadableStream`, and `@openrouter/sdk` consumes it via
`getReader()` with `stream: true` + SSE (no `.text()`/`.json()` buffering). Turn
**cancel is responsive too** — aborts ~0.36s after the click *during* active
streaming. The only sluggish case is cancelling during **time-to-first-token**
(the model's pre-generation latency, ~5s with `deepseek-v4-flash`), where there's
no stream to interrupt yet; that TTFT is provider/model latency, not our code.

Verification gotcha: the model must be **connected to an MCP server** (Connect
button / bridge `/connect`) for turns to behave normally; HMR also leaves stale
`uncaught` events in the bridge log mid-edit — confirm against the *served*
source + `tsc` before trusting them.

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
- The interactive-forms server (in-repo): `cd servers/forms &&
  INPUT=mcp-app.html pnpm exec vite build && PORT=3002 bun main.ts` (serves
  `http://localhost:3002/mcp`). It's a pnpm workspace package alongside
  `packages/forms-dsl`; run `pnpm install` from the root after pulling.

## Where everything is

| Area | File |
|------|------|
| Host shell (connection, model/key, conversation list, render) | `src/App.tsx` |
| **Chat session hook** (transcript, composer, turn/HITL/queue/cancel logic) | `src/hooks/useAgentChat.ts` |
| Empty-state onboarding (`Welcome` + `Prompts`) | `src/components/ChatWelcome.tsx` |
| Inline MCP App mount (sandbox iframe embedded on its tool card) | `src/components/InlineAppMount.tsx` |
| Searchable history drawer (Ant) | `src/components/HistoryDrawer.tsx` |
| Model picker (Ant Select over OpenRouter catalog) | `src/components/ModelPicker.tsx` |
| **Agent loop barrel** (OpenRouter SDK; HITL forms; queue/repair; tool reliability) | `src/agent/runner.ts` → `mcp-tools.ts`, `turns.ts`, `state-display.ts`, `telemetry.ts`, `turn-repair.ts` |
| Model catalog fetch | `src/agent/models.ts` |
| JSON Schema → Zod (for SDK `tool()` inputSchema) | `src/agent/json-schema-to-zod.ts` |
| **Interactive-forms DSL** (field union, `when`, validators, Zod schema) | `packages/forms-dsl/` |
| **Interactive-forms MCP App server** (generic renderer) | `servers/forms/` |
| Source-attributed event log (`logEvent`/`getEvents` + error capture) | `src/lib/events.ts` |
| **Debug bridge** (webview side: drive/inspect over HTTP) | `src/lib/debug-bridge.ts` |
| **Debug bridge** (Rust side: tiny_http server on :1456, dev-only) | `src-tauri/src/debug.rs` |
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
(tables: `settings`, `mcp_servers`, `tabs`, `conversations`, `messages` (legacy),
`conversation_state` (SDK state per chat), `form_events`, `events` (timeline)).

**Debugging without a human in the loop:** a dev-only HTTP bridge on
`127.0.0.1:1456` lets an agent drive and inspect the running app — connect,
`/newchat`, `/send`, `/openform` (deterministic form, forced tool call),
`/forminput`/`/formclick` (drive the cross-origin form), `/type`/`/press`/`/click`
(host input), `/dom`/`/formdom` (computed layout), `/state`, `/events`
(source-attributed timeline), `/snapshot`. See the **`omni-debug-bridge` skill**.
Gated to dev builds (`#[cfg(debug_assertions)]` + `import.meta.env.DEV`).

## Conventions / rules

- **No source file over 600 lines.** If a file approaches it, split by concern.
  (`App.tsx` was 683; Phase 7 extracted `useAgentChat` → App.tsx ~446, hook ~470.)
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

## DONE — conversation continuity now uses the SDK StateAccessor

The earlier gap (text-only replay) is **fixed**. Continuity no longer rebuilds
`input` from `{role, content}` text via `fromChatMessages`; it uses the SDK's
own `StateAccessor` / `ConversationState` so tool calls and tool results persist
and replay too.

What changed:
- New `conversation_state` table (one JSON blob per chat) — `src-tauri/src/db.rs`.
- `getConversationState` / `saveConversationState` / `conversationStateAccessor`
  (a DB-backed `{ load, save }` StateAccessor) — `src/lib/db.ts`.
- `runTurn` now takes `{ userText, state }` instead of the full `messages`
  array. It passes **only the new user message** as `input` plus the `state`
  accessor; the SDK rehydrates prior history (incl. `function_call` /
  `function_call_output` items + `previousResponseId` for server-side chaining)
  and auto-saves response output + tool results after every turn —
  `src/agent/runner.ts`. Also adds `chatMsgsFromState()` to derive display
  bubbles from persisted state.
- `App.tsx` loads display from SDK state (`loadMessages`, with a fallback to the
  legacy `messages` text rows for pre-migration chats) and no longer writes the
  per-message text table.

Net effect: resuming a chat, the model sees the exact prior tool interactions —
which tool ran, with what args, and the precise output — not just prior answers.

Verification done: `tsc --noEmit`, `vite build`, `cargo build` all green.
**Not yet run live** — the worthwhile manual check is multi-turn tool
persistence: call a tool, reload/switch away and back, confirm a follow-up that
references the earlier tool output works. The legacy `messages` table + its
`getMessages` reader are intentionally kept (read-only) so old conversations
still render; they can be dropped once no pre-migration chats matter.

Relevant SDK exports (see `node_modules/@openrouter/agent/esm/index.d.ts`):
`StateAccessor`, `ConversationState`, `createInitialState`, `updateState`,
`appendToMessages`, `ModelResult.getState()`.

## DONE — interactive forms via durable HITL (the big one)

The agent can now render a real form, the user fills it, and the answers come
back as the tool's result — and the pause **survives a reload** (it's persisted
SDK state). Built as three layers:

1. **`packages/forms-dsl`** — the form language, the single source of truth.
   Discriminated field union (`fields.ts`: text/textarea/email/url/secret/
   number/slider/select/radio/multiselect/boolean/date/time/datetime/info),
   conditional visibility (`condition.ts`, `when`), normalize, validators
   (`validate.ts`: `validateSpec` agent→form with typo hints, `validateResult`
   form→agent honoring `when`), and the agent-facing **Zod** schema
   (`schema.ts`) that becomes the tool's `inputSchema`. `protocol.ts` holds the
   shared markers. Adding a field type = edit the union + one renderer case.
2. **`servers/forms`** — a generic MCP App server (cloned from
   `basic-server-react`'s build pipeline). One tool, `request_user_input`, whose
   `inputSchema` IS the DSL. Ships a native-input renderer (`FieldRenderer.tsx`),
   live `when`, local multi-step nav, host theming (`useHostStyles`). On submit
   it calls `updateModelContext({ structuredContent: { "omni.form/submit": true,
   values } })`. Run: `cd servers/forms && INPUT=mcp-app.html pnpm exec vite
   build && PORT=3002 bun main.ts`.
3. **Host HITL wiring** — `runner.ts`: tools flagged `_meta[INTERACTIVE_TOOL_META]`
   become SDK **HITL tools** — `onToolCalled` validates the spec (bad → returns
   issues so the model self-corrects; good → renders panel + returns `null` to
   PAUSE, `status: awaiting_hitl`). `resumeTurn()` resolves a paused call via a
   `function_call_output` item (the SDK's documented resume — see the OpenRouter
   HITL cookbook). `displayItemsFromState()` now yields tool **cards** alongside
   bubbles. `App.tsx`: catches the submit-marked `updateModelContext`,
   re-validates host-side (untrusted iframe), `resumeTurn`s; on load/switch it
   detects `awaiting_hitl` and **re-mounts the panel for the pending call**.
   `form_events` table + `logFormEvent()` log every interaction (spec, validity,
   issues, result) — the dataset for "what are agents tripping on."

Key decisions (locked with the user): custom compact DSL (not JSON Schema);
`updateModelContext` as the submit channel (our host makes it active);
`when` in v1; multi-step nav is App-local (one agent call, one result); chat
shows cards with the live interactive iframe embedded **inline on the tool card**
(`InlineAppMount`).

Verification: full stack builds green (`tsc --noEmit`, `vite build`, `cargo
build`, both package typechecks, forms bundle, and the forms server serves the
correct tool schema over MCP). **Not yet run live end-to-end** — the test is:
connect BOTH servers (3001 get-time, 3002 forms), ask the agent to "collect my
shipping details" (or anything needing structured input), fill the form, confirm
the agent continues with the values; then reload mid-form and confirm the panel
re-appears and still submits.

Follow-ups are tracked in the Backlog below.

## DONE — debug bridge, observability, queuing, reliability (this session)

All verified headlessly via the bridge unless noted.

- **Form cancel** — pane ✕ and an in-form Cancel button resolve the HITL call as
  cancelled; card → `cancelled`; confirm-on-cancel only if the form is dirty
  (form reports `FORM_DIRTY_KEY` across the cross-origin boundary). The
  dirty→`Modal.confirm` branch is verifiable headlessly now (drive a field dirty,
  click ✕, click Discard).
- **Debug bridge** (`debug.rs` + `debug-bridge.ts`, dev-only) — drive/inspect the
  app over HTTP, incl. **headless user-input simulation** (host `/type`/`/press`/
  `/click`; in-iframe `/forminput`/`/formclick` via a form↔bridge channel) and
  `/openform` (deterministic forms). The **`omni-debug-bridge` skill** documents it.
- **Message queuing** — typing while busy or a form is open queues (rendered as
  "queued"), flushes when the agent is free; fixes the chat-while-form-open bug.
- **Tool-call reliability guardrails** (engineering around intermittent
  tool-calling, not model-swapping) — strengthened system prompt + one-shot
  example; `tool_choice` forcing (`/openform`); and **self-repair**: after a turn
  that described a form but didn't call the tool, re-prompt once with the tool
  forced (`describedButDidntCall` + `repairToolCall`).
- **Observability** — `events` table + `logEvent`/`getEvents` with a **`source`**
  column (user / debug-bridge / queue / repair / system) + global error capture;
  `tool.call`/`tool.result` events tied to `conversation_state` by `callId`.
  Read the timeline via `/events`. This is the "what happened and who did it" log.

## Workspace shell — DONE through Phase 4 (split polish)

The chat→coding workspace is being built in phases (Stitch renders in
`stitch-renders/`). Shipped so far:
- **Phase 1** (`c23192d`) — left **icon rail** (History/Projects live;
  Tools/Agents/Commands stubbed; Settings) + in-rail **panels**. Projects panel
  groups code chats by working folder with a per-project `+`. Header relocated:
  model picker → composer footer, API key + MCP server → Settings panel.
- **Phase 2** (`ae6382b`) — **live multi-tab**. Each open tab is its own mounted
  `ChatSession` (`src/components/ChatSession.tsx`) with an independent
  `useAgentChat`; **hidden tabs stay mounted so background turns keep streaming**
  (verified). VS Code-style `TabBar`. `App.tsx` is now the shell: open-tabs
  state, debug bridge routed to the focused tab via a per-session handler
  registry, tab labels from session `meta` + the conversations list. MCP App UI
  renders **inline on its tool card** per session (`InlineAppMount`).
- **Phase 3** — **split view**. `useSplitView` + `TabBar` split/merge controls;
  two visible `ChatSession`s in a 50/50 layout; `focusKey` for debug-bridge
  `/send`. Open tabs also persist in DB (migration `0003`).
- **Phase 4** — **split polish**. The fixed grid became an antd `Splitter` with
  draggable panes and persisted ratio (`settings.split_ratio`). Inline MCP Apps
  remain per-transcript, so split mode does not steal a form from another tab.
  Verification note: the debug bridge now has `POST /drag` for host pointer
  drags (e.g. `.ant-splitter-bar-dragger`) and `/snapshot` sanitizes modern CSS
  colors before html2canvas capture, falling back to a simpler DOM canvas if
  html2canvas still rejects a modern color. Prefer computed `/dom` layout
  evidence for cross-origin iframes; snapshots still cannot see inside MCP App
  iframes.

## Backlog

- **Remaining antd cleanup.** Most shell debt is now migrated (`TabBar` uses
  antd `Tabs`, `SideRail` uses `Menu`, `SettingsPanel` uses `Form`, app buttons
  use `Button`). Remaining raw controls are mainly the queued-message remove
  button in `ChatSession` and `servers/forms` wrappers/buttons/labels around
  otherwise-antd inputs. Keep using antd/X primitives by default.
- **Streaming smoothness (optional polish)** — streaming works (see correction
  up top); deltas arrive in bursts, so the bubble grows in chunks rather than
  per-token. If smoother output is wanted, enable `Bubble` `typing` animation, or
  reduce time-to-first-token with a snappier model. Not a bug.
- **Code mode phase 2 — filesystem tools** — see `CODE_MODE_BRIEF.md`: scoped
  Rust `list_dir` / `read_file`, then `write_file` / `run_command` using the
  permission-mode architecture in `CODE_TOOLS_SDK_NOTES.md`: SDK
  `requireApproval` by default, optional yolo mode that skips approval only,
  never Rust scoping/logging.
- Live multi-turn tool-persistence sanity check (call a tool, reload, reference
  the earlier result) — built + headless-verified, not yet eyeballed live.
- Productize workspace basics: conversation rename, retry/regenerate, MCP server
  manager UI, real empty/error states for Tools / Agents / Commands.
- Production hardening: sandbox sidecar, code-split the 1MB+ JS bundles,
  README/release packaging sanity checks.
- Turso sync / multi-device later, after the local coding workflow is solid.
