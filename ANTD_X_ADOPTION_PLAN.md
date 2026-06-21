# Ant Design + Ant Design X Adoption Plan

A phased plan to replace the hand-rolled chat UI with the Ant Design X chat
primitives and the hand-rolled form inputs with Ant Design components — fixing
the concrete bugs (no autoscroll, broken native datepicker) along the way —
**without touching the agent loop, MCP Apps sandbox, persistence, or the
observability we built.**

Each phase is a self-contained PR: implement → typecheck/build → **verify
headlessly via the debug bridge** → commit/merge → next phase.

---

## 0. Context for the next session (read first)

- Read `HANDOFF.md` and `README.md`. This plan assumes that context.
- The app is a Tauri 2 + React 19 + Ant Design desktop app. Chat is currently
  **custom HTML/CSS in `src/App.tsx` + `src/App.css`**; the agent loop is
  `@openrouter/agent` (`src/agent/runner.ts`); interactive forms are MCP Apps
  rendered in a cross-origin sandbox iframe (`servers/forms`, `@omni/forms-dsl`).
- **Skills to use (all available this machine):**
  - `x-components` — Bubble, Sender, Conversations, ThoughtChain, Welcome,
    Prompts, Actions, XProvider, Notification.
  - `x-markdown` — streaming-safe Markdown / code / LaTeX rendering.
  - `antd` — base Ant Design components (DatePicker, Select, ConfigProvider,
    theme tokens) for the form and chrome.
  - `x-chat-provider`, `use-x-chat`, `x-request`, `x-card` — **reference only**;
    NOT adopted in this plan (see §2).
  - `omni-debug-bridge` — the headless verification harness used in every phase.
  - `frontend-design` (plugin) — for taste/typography decisions when reshaping UI.
- **Invoke the relevant skill before writing code for that surface.** They carry
  the exact component APIs and gotchas; don't guess.

## 1. Goal

| Surface | From | To |
|---|---|---|
| Message list | custom `.bubble` divs, manual scroll | `Bubble.List` + `XMarkdown` |
| Composer | raw `<textarea>` + button | `Sender` (loading, cancel, queue) |
| Tool calls | minimal `.tool-card` status line | `ThoughtChain` (expandable, statuses) |
| Empty state | one hint sentence | `Welcome` + clickable `Prompts` |
| Theming | none (raw CSS vars) | `XProvider` / `ConfigProvider` (antd + X, light/dark) |
| Form inputs | native HTML inputs (broken datepicker) | antd components (`DatePicker`, `Select`, …) |

## 2. Guardrails — do NOT touch (out of scope)

These are deliberate architecture choices; the X SDK's alternatives are a
refactor, not a swap. **Keep them.**

- **Agent loop:** `@openrouter/agent` + `runTurn`/`resumeTurn`/`openForm`, the
  DB-backed `StateAccessor`, HITL pause/resume, the queue + self-repair
  guardrails, the tool-call reliability work. **Do NOT introduce `useXChat` /
  a custom `ChatProvider`** (Tier 2). The UI consumes the existing
  `DisplayItem[]` + streaming callbacks; the loop is unchanged.
- **MCP Apps sandbox:** the double-iframe + per-request CSP (`sandbox.ts`,
  `sandbox-server.ts`) is load-bearing security. Forms stay MCP Apps; **do NOT
  adopt `x-card` / A2UI** as a replacement (Tier 3).
- **Secrets / HTTP:** API key in keyring, all HTTP via Rust (`tauri-fetch`).
  Do not add a frontend HTTP client. (`x-request` stays unused.)
- **Persistence + observability:** libSQL `conversation_state` / `events` /
  `form_events`, and the debug bridge. The new UI must keep emitting the same
  events and reading the same state.

Also out of scope for now: Attachments/multimodal, Sources/citations,
Suggestion/slash-commands (Tier 3 — revisit once there's model/agent support).

## 3. How every phase is verified (the debug bridge)

`omni-debug-bridge` skill has the full reference. Per phase, before merging:

```bash
curl -sS http://127.0.0.1:1456/health
# drive
curl -sS -X POST :1456/newchat
curl -sS -X POST :1456/openform -d '{"spec":{...}}'   # deterministic, no model luck
curl -sS -X POST :1456/send     -d '{"text":"..."}'
# inspect
curl -sS ':1456/dom?selector=.ant-bubble,.ant-sender,...'   # confirm Ant components render
curl -sS :1456/events?since=<id>                            # confirm events still flow + no errors
curl -sS :1456/snapshot                                     # html2canvas of the host (chat chrome)
```

**Acceptance for a phase = (1) `tsc --noEmit` + `vite build` + `cargo build`
green, (2) the new components render (`/dom` shows their class names), (3) the
event timeline is unchanged in shape (turns/tools/queue still logged, no new
`uncaught`/`turn.error`), (4) the behavior the phase targets is confirmed via the
bridge.** Snapshots are secondary (the cross-origin form is blank in them).

---

## Phase 0 — Foundation (theming + the two quick bugs)

**Why first:** everything else renders inside the provider, and the scroll/patch
fixes are tiny and unblock testing.

- Install: `@ant-design/x`, `@ant-design/x-markdown`. (antd + icons already in.)
- Import `@ant-design/v5-patch-for-react-19` at the top of `src/main.tsx`
  (currently in `package.json` but never imported — required for React 19).
- Wrap the app in `XProvider` (which composes antd `ConfigProvider`): theme
  tokens mapped to the existing CSS variables, light/dark following the OS (reuse
  `src/mcp/theme.ts`). This gives antd + X a single theme source.
- **Scroll fix (independent of the rest):** add a `useEffect` that scrolls the
  message container to bottom whenever `messages` changes (not only during
  streaming deltas). Once `Bubble.List` lands (Phase 1) it autoscrolls natively
  and this can be removed.

**Verify:** app boots themed (light/dark toggles with OS), no regressions to the
existing custom chat (still works), `/send` then confirm the view scrolls to the
newest message. `tsc`/`vite`/`cargo` green.

## Phase 1 — Message list → `Bubble.List` + `XMarkdown`

**Highest UX impact.** Replace the `.bubble` map with `Bubble.List`.

- Map `DisplayItem` (kind `msg`) → Bubble items: `role` → placement/styling,
  user vs assistant avatars/roles config.
- Render assistant content through **`XMarkdown`** (`x-markdown` skill): code
  blocks, lists, tables, LaTeX, and **streaming-safe** partial-Markdown handling
  (important — we stream deltas). Keep user messages plain text.
- Wire streaming: `Bubble`'s `loading`/typing + content render fed by the
  existing `appendDeltaToLastAssistant` delta stream. Confirm partial Markdown
  doesn't flicker/break mid-stream (the skill covers `hasNextChunk`).
- `Bubble.List` handles autoscroll → remove the Phase 0 scroll shim.
- Tool cards (`kind: tool`) stay as the current `.tool-card` for now (Phase 3
  upgrades them) — or render as a simple Bubble variant temporarily.

**Verify:** `/send "Show a markdown table and a JS code block"` → `/dom?selector=
.ant-bubble` shows bubbles; confirm `<pre>/<code>` + table elements render;
stream a long reply and confirm autoscroll + no mid-stream breakage; `/events`
shows the same `turn.*` flow.

## Phase 2 — Composer → `Sender`

- Replace the `<textarea>` + button with **`Sender`** (`x-components` skill):
  built-in loading state, Enter/Shift-Enter, and an `onCancel`/abort affordance.
- **Wire real cancel:** today there's no turn abort. Add an `AbortController` to
  `runTurn`/`resumeTurn` (the OpenRouter SDK `ModelResult` has `.cancel()`), and
  hook `Sender`'s cancel to it. Log a `turn.cancelled` event.
- Integrate the **existing message queue** (already built): while busy/`formPending`,
  `Sender` queues (we keep the queued-list UI, or use `Sender`'s header to show
  queued items). Don't regress the queue/flush behavior or its events.

**Verify:** `/type` + `/press Enter` still sends (real path); during a turn,
`/type`+Enter queues (`/state` shows `queued`, `/events` shows `queue.enqueue`);
trigger a long turn and confirm cancel aborts it (`/events` shows
`turn.cancelled`, no `turn.error`).

## Phase 3 — Tool cards → `ThoughtChain`

- Replace `.tool-card` rendering with **`ThoughtChain`** (`x-components` skill):
  expandable steps, per-step status (`pending`/`success`/`error`), loading blink.
- Map our tool statuses: `pending → awaiting input`, `done → success`,
  `error`/`cancelled` → error/neutral. Pull richer detail (tool name, and — via
  the `callId` → `conversation_state` link we built — the args/result) into the
  expandable body.
- Keep the side `AppPane` for the live form; ThoughtChain is the transcript view.

**Verify:** `/openform` → `/dom?selector=.ant-thought-chain` shows a pending
step; submit → step flips to success; `/events` `tool.call`/`tool.result` still
emit with `callId`.

## Phase 4 — Empty state → `Welcome` + `Prompts`

- Replace the single hint paragraph with **`Welcome`** (branding/intro) +
  **`Prompts`** (`x-components` skill): clickable starter prompts that call
  `send(text)` (e.g. "Set up a subscription", "What can you do?", a form demo).
- Use `frontend-design` skill for taste (copy, layout, not templated-looking).

**Verify:** fresh `/newchat` → `/dom?selector=.ant-welcome,.ant-prompts`;
clicking a prompt (via `/click`) sends it (`/events` `turn.start`).

## Phase 5 — Conversations sidebar (optional)

- Optionally replace/augment `HistoryDrawer` with the X **`Conversations`**
  component (grouped, active key, create/rename/delete) backed by the existing
  libSQL conversations + `hydrate()`. Keep it a drawer or promote to a sidebar —
  a UX call (use `frontend-design`).
- Lower priority; can ship after the chat core. Skip if scope is tight.

**Verify:** switch/create/delete via the component; `hydrate()` still restores
transcript + re-mounts a pending form; History still "remembers selection".

## Phase 6 — Forms → Ant Design components (fixes the datepicker)

- In `servers/forms/src/FieldRenderer.tsx`, replace native inputs with antd
  (`antd` skill): `DatePicker`/`TimePicker` (the broken one), `Select`,
  `Checkbox.Group`, `Radio.Group`, `Input`/`Input.TextArea`/`Input.Password`,
  `InputNumber`, `Slider`, `Switch`, `Form` for layout/validation display.
- Theme the form from the **host** context: wrap in antd `ConfigProvider` with
  tokens derived from the `useHostStyles` variables so it matches the app
  light/dark. (CSP already allows `style-src 'unsafe-inline'` for antd's
  CSS-in-JS — verify the sandbox CSP still passes.)
- **Trade-off to accept:** the single-file form bundle grows (~+1 MB). Fine for
  now; if it matters later, lazy-load heavy widgets or revisit per-field.
- Keep `@omni/forms-dsl` (the language) and the HITL submit/cancel/dirty channel
  unchanged — only the rendering changes.

**Verify (per field type):** `/openform` with a spec containing every field type
incl. `date`/`datetime` → `/formdom` shows the fields laid out; `/forminput` +
`/formclick submit` round-trips values; **specifically confirm the datepicker is
the antd one and selecting a date returns a proper ISO value**. Re-run the full
form regression (2-step, dropdown, multiselect, conditional `when`).

## Phase 7 — Cleanup

- Extract `useAgentChat` (and/or `useConversations`) from `App.tsx` — the render
  refactor naturally shrinks it; get it back under the 600-line rule.
- Delete now-dead custom chat CSS in `App.css`.
- Update `HANDOFF.md` (chat is now Ant Design X; forms are antd) and this plan's
  status.

---

## Sequencing & PRs

Phase 0 → 1 → 2 → 3 → 4 → 6 → 7, with Phase 5 optional/anytime after 4. One PR
per phase, each verified via the bridge before merge, each independently
revertible. Phases 1–4 are the "Tier 1" chat sprint; Phase 6 is the forms
sprint; they're independent and can be reordered if the datepicker is more
urgent than the chat polish.

## Risks & mitigations

- **Streaming + Markdown flicker** — use `x-markdown`'s incomplete-syntax
  handling; verify with a long streamed reply via the bridge.
- **antd CSS-in-JS inside the sandbox CSP** — `style-src 'unsafe-inline'` is
  already allowed; verify the form still renders (no CSP violations in console /
  `uncaught` events).
- **React 19 quirks** — the v5 patch import (Phase 0) is the known fix.
- **Bundle size (forms)** — accepted; revisit with lazy-loading if needed.
- **Theming drift** — single source via XProvider/ConfigProvider tokens mapped
  from the existing CSS vars; check light/dark in both chat and form.
- **Regressions** — every phase re-runs the headless form + chat round-trips and
  checks `/events` for new `uncaught`/`turn.error`.
