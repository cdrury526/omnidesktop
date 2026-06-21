/**
 * Webview side of the local debug bridge (see `src-tauri/src/debug.rs`).
 *
 * Listens for `debug://request` events the Rust HTTP server emits, performs the
 * action in the page (drive a turn, introspect the DOM, snapshot), and answers
 * via `complete_debug_request`. This is what lets an agent iterate on the UI
 * over `curl http://127.0.0.1:1456/...` without a human clicking around.
 *
 * `send`/`submit`/`state` are supplied by the app (they need its live agent
 * context); `dom`/`snapshot` are pure page introspection handled here.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { getLatestFormMetrics } from "../mcp/host-bridge";
import { logEvent, getEvents } from "./events";

// Read-only pokes we don't log (they're frequent and would drown the timeline).
const QUIET_ACTIONS = new Set(["state", "dom", "formdom", "events", "health"]);

export interface DebugHandles {
  /** Connect to an MCP server URL (so a turn has tools). */
  connect: (url: string) => Promise<unknown>;
  /** Start a fresh conversation (test isolation). */
  newchat: () => Promise<unknown>;
  /** Deterministically open a form with the given DSL spec (forced tool call). */
  openform: (spec: unknown) => Promise<unknown>;
  /** Run a chat turn with `text`; resolve when it completes or pauses. */
  send: (text: string) => Promise<unknown>;
  /** Resolve the pending HITL form with `values` (drives submit headlessly). */
  submit: (values: Record<string, unknown>) => Promise<unknown>;
  /** Cancel the pending HITL form (drives cancel headlessly). */
  cancel: () => Promise<unknown>;
  /** Summarize the active conversation (id, pending call, transcript items). */
  state: () => Promise<unknown>;
}

// Computed-style props that matter for layout debugging — the form-collapse
// class of bug shows up here (height: 0, flex-basis, overflow → min-height: 0).
const STYLE_PROPS = [
  "display", "position", "boxSizing",
  "width", "height", "minHeight", "maxHeight",
  "flex", "flexBasis", "flexGrow", "flexShrink", "flexDirection",
  "overflow", "overflowY", "padding", "margin",
] as const;

function inspectDom(selector: string) {
  const els = Array.from(document.querySelectorAll(selector)).slice(0, 25);
  return {
    selector,
    count: document.querySelectorAll(selector).length,
    nodes: els.map((node) => {
      const el = node as HTMLElement;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const styles: Record<string, string> = {};
      for (const p of STYLE_PROPS) styles[p] = cs.getPropertyValue(p) || String((cs as never)[p as never] ?? "");
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        class: el.getAttribute("class") || undefined,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        box: { clientH: el.clientHeight, scrollH: el.scrollHeight, offsetH: el.offsetHeight, clientW: el.clientWidth },
        styles,
        note: el.tagName === "IFRAME" ? "iframe contents are cross-origin/sandboxed — not introspectable" : undefined,
      };
    }),
  };
}

// ---- synthetic user input on the host document ----

function hostClick(selector: string) {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) throw new Error(`/click: no element matches ${selector}`);
  el.scrollIntoView({ block: "center" });
  el.click();
  return { clicked: true, tag: el.tagName.toLowerCase(), text: el.textContent?.trim().slice(0, 60) };
}

/** Set an input/textarea value the way React notices (native setter + input event). */
function hostType(selector: string, text: string) {
  const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) throw new Error(`/type: no element matches ${selector}`);
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, text);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return { ok: true, value: el.value };
}

function hostPress(key: string, selector?: string) {
  const el = (selector ? document.querySelector(selector) : document.activeElement) as HTMLElement | null;
  const target = el ?? document.body;
  const opts = { key, bubbles: true, cancelable: true };
  target.dispatchEvent(new KeyboardEvent("keydown", opts));
  target.dispatchEvent(new KeyboardEvent("keyup", opts));
  return { ok: true, key, on: target.tagName.toLowerCase() };
}

async function snapshot() {
  // html2canvas only sees same-origin DOM; the cross-origin form iframe renders
  // blank. Still useful for the chat transcript, cards, and pane sizing.
  const { default: html2canvas } = await import("html2canvas");
  const target = (document.querySelector(".layout") as HTMLElement | null) ?? document.body;
  const canvas = await html2canvas(target, { backgroundColor: "#ffffff", logging: false, scale: 1 });
  const pngBase64 = canvas.toDataURL("image/png").split(",")[1] ?? "";
  const saved = await invoke("save_snapshot", { request: { pngBase64 } });
  return { ...(saved as object), note: "the cross-origin form iframe is blank in snapshots — use /dom for form-host sizing" };
}

export function useDebugBridge(handles: DebugHandles) {
  const ref = useRef(handles);
  ref.current = handles;

  useEffect(() => {
    if (!import.meta.env.DEV) return; // dev-only; never wires up in a release build
    const unlisten = listen<{ requestId: string; action: string; params: Record<string, unknown> }>(
      "debug://request",
      async (event) => {
        const { requestId, action, params } = event.payload;
        // Record driving actions so the timeline shows when *I* poked vs the user.
        if (!QUIET_ACTIONS.has(action)) logEvent({ source: "debug-bridge", type: `debug.${action}`, data: params });
        try {
          let result: unknown;
          switch (action) {
            case "events":
              result = await getEvents(Number(params?.since) || 0, Number(params?.limit) || 500);
              break;
            case "connect":
              result = await ref.current.connect(String(params?.url ?? ""));
              break;
            case "newchat":
              result = await ref.current.newchat();
              break;
            case "openform":
              result = await ref.current.openform(params?.spec);
              break;
            case "send":
              result = await ref.current.send(String(params?.text ?? ""));
              break;
            case "submit":
              result = await ref.current.submit((params?.values ?? {}) as Record<string, unknown>);
              break;
            case "cancel":
              result = await ref.current.cancel();
              break;
            case "state":
              result = await ref.current.state();
              break;
            case "click":
              result = hostClick(String(params?.selector ?? ""));
              break;
            case "type":
              result = hostType(String(params?.selector ?? ""), String(params?.text ?? ""));
              break;
            case "press":
              result = hostPress(String(params?.key ?? ""), params?.selector ? String(params.selector) : undefined);
              break;
            case "dom":
              result = inspectDom(String(params?.selector ?? "body"));
              break;
            case "formdom":
              // The form iframe's self-reported interior layout (cross-origin).
              result = getLatestFormMetrics() ?? { note: "no form metrics yet — open a form first" };
              break;
            case "snapshot":
              result = await snapshot();
              break;
            default:
              throw new Error(`unknown debug action: ${action}`);
          }
          await invoke("complete_debug_request", { request: { requestId, result } });
        } catch (err) {
          await invoke("complete_debug_request", {
            request: { requestId, error: err instanceof Error ? err.message : String(err) },
          });
        }
      },
    );
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);
}
