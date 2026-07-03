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
  // Colors (resolved to rgb) so callers can check theme/contrast directly
  // instead of eyeballing a snapshot — html2canvas drops variable-driven text.
  "color", "backgroundColor",
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
      // Visible text (innerText respects display/visibility; textContent is the
      // fallback when layout hasn't computed innerText). The reliable way to
      // confirm content actually rendered — don't trust the html2canvas snapshot.
      const text = (el.innerText || el.textContent || "").trim();
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        class: el.getAttribute("class") || undefined,
        text: text ? text.slice(0, 300) : undefined,
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

function dispatchPointer(
  el: EventTarget,
  type: string,
  x: number,
  y: number,
  pointerId: number,
  buttons: number,
) {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId,
    pointerType: "mouse",
    isPrimary: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons,
  }));
}

function dispatchMouse(el: EventTarget, type: string, x: number, y: number, buttons: number) {
  el.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons,
  }));
}

function pointFor(el: HTMLElement, params: Record<string, unknown>) {
  const r = el.getBoundingClientRect();
  const x = typeof params.x === "number" ? params.x : r.left + r.width / 2;
  const y = typeof params.y === "number" ? params.y : r.top + r.height / 2;
  return { x, y };
}

async function hostDrag(params: Record<string, unknown>) {
  const selector = String(params.selector ?? "");
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) throw new Error(`/drag: no element matches ${selector}`);
  el.scrollIntoView({ block: "center", inline: "center" });

  const from = pointFor(el, params);
  const dx = Number(params.dx ?? 0);
  const dy = Number(params.dy ?? 0);
  const steps = Math.max(1, Math.min(60, Math.round(Number(params.steps ?? 12))));
  const pointerId = Math.max(1, Math.round(Number(params.pointerId ?? 1)));

  dispatchPointer(el, "pointerover", from.x, from.y, pointerId, 0);
  dispatchPointer(el, "pointerenter", from.x, from.y, pointerId, 0);
  dispatchMouse(el, "mouseover", from.x, from.y, 0);
  dispatchMouse(el, "mouseenter", from.x, from.y, 0);
  dispatchPointer(el, "pointerdown", from.x, from.y, pointerId, 1);
  dispatchMouse(el, "mousedown", from.x, from.y, 1);

  const moveTarget = document;
  for (let i = 1; i <= steps; i += 1) {
    const x = from.x + (dx * i) / steps;
    const y = from.y + (dy * i) / steps;
    dispatchPointer(moveTarget, "pointermove", x, y, pointerId, 1);
    dispatchMouse(moveTarget, "mousemove", x, y, 1);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  const to = { x: from.x + dx, y: from.y + dy };
  dispatchPointer(moveTarget, "pointerup", to.x, to.y, pointerId, 0);
  dispatchMouse(moveTarget, "mouseup", to.x, to.y, 0);
  dispatchPointer(el, "pointerout", to.x, to.y, pointerId, 0);
  dispatchPointer(el, "pointerleave", to.x, to.y, pointerId, 0);

  return {
    dragged: true,
    tag: el.tagName.toLowerCase(),
    selector,
    from: { x: Math.round(from.x), y: Math.round(from.y) },
    to: { x: Math.round(to.x), y: Math.round(to.y) },
    steps,
  };
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
  const safeRoot = document.documentElement;
  try {
    return await withSnapshotSafeStyles(safeRoot, async () => {
      const canvas = await html2canvas(target, {
        backgroundColor: "#ffffff",
        logging: false,
        scale: 1,
        ignoreElements: (el) => ["IFRAME", "STYLE", "LINK"].includes(el.tagName),
        onclone: (doc, clonedTarget) => {
          sanitizeSnapshotClone(safeRoot, doc.documentElement);
          sanitizeSnapshotClone(target, clonedTarget as HTMLElement);
        },
      });
      return saveSnapshotCanvas(canvas, "html2canvas; cross-origin form iframes are blank — use /dom for form-host sizing");
    });
  } catch (error) {
    const canvas = fallbackSnapshotCanvas(target);
    const reason = error instanceof Error ? error.message : String(error);
    return saveSnapshotCanvas(canvas, `fallback canvas after html2canvas failed: ${reason}`);
  }
}

function normalizeCssColor(value: string): string {
  const v = value.trim();
  if (!v || v === "none" || v === "currentcolor") return v;
  if (/^(rgba?|hsla?)\(/i.test(v) || /^#[0-9a-f]{3,8}$/i.test(v)) return v;
  const srgb = v.match(/^color\(srgb\s+([^)]+)\)$/i);
  if (!srgb) return v.startsWith("color(") || v.includes("color-mix(") ? "rgba(0, 0, 0, 0)" : v;
  const [rgbPart, alphaPart] = srgb[1].split(/\s*\/\s*/);
  const channels = rgbPart.trim().split(/\s+/).slice(0, 3).map((part) => {
    const n = part.endsWith("%") ? Number.parseFloat(part) / 100 : Number.parseFloat(part);
    return Math.round(Math.min(1, Math.max(0, n)) * 255);
  });
  if (channels.length !== 3 || channels.some((n) => !Number.isFinite(n))) return "rgba(0, 0, 0, 0)";
  const alpha = alphaPart == null ? 1 : Math.min(1, Math.max(0, Number.parseFloat(alphaPart)));
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${Number.isFinite(alpha) ? alpha : 1})`;
}

function snapshotSafeValue(prop: string, value: string): string | null {
  if (prop.startsWith("--")) return null;
  const v = value.trim();
  if (!v) return v;
  const unsupported = v.includes("color(") || v.includes("color-mix(") || v.includes("light-dark(");
  if (!unsupported) return v;

  if (prop.toLowerCase().includes("color")) return normalizeCssColor(v);
  if (prop === "background") return v.startsWith("color(") ? normalizeCssColor(v) : "none";
  if (prop.includes("shadow") || prop.includes("image") || prop === "filter" || prop === "backdrop-filter") {
    return "none";
  }
  return null;
}

function sanitizeSnapshotClone(sourceRoot: HTMLElement, clonedRoot: HTMLElement) {
  const sourceEls = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll("*"))] as HTMLElement[];
  const cloneEls = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll("*"))] as HTMLElement[];

  sourceEls.forEach((source, i) => {
    const clone = cloneEls[i];
    if (!clone) return;
    const cs = getComputedStyle(source);
    clone.removeAttribute("style");
    for (const prop of Array.from(cs)) {
      const safe = snapshotSafeValue(prop, cs.getPropertyValue(prop));
      if (safe != null) clone.style.setProperty(prop, safe, cs.getPropertyPriority(prop));
    }
  });

  // Avoid html2canvas parsing modern CSS Color 4 declarations from stylesheets
  // after we have inlined the computed layout/color styles it needs.
  const root = clonedRoot.getRootNode() as Document;
  root.querySelectorAll("style,link[rel='stylesheet']").forEach((el) => el.remove());
}

async function saveSnapshotCanvas(canvas: HTMLCanvasElement, note: string) {
  const pngBase64 = canvas.toDataURL("image/png").split(",")[1] ?? "";
  if (pngBase64.length < 100) throw new Error("snapshot canvas produced an empty PNG");
  const saved = await invoke("save_snapshot", { request: { pngBase64 } });
  return { ...(saved as object), note };
}

function fallbackSnapshotCanvas(target: HTMLElement): HTMLCanvasElement {
  const rect = target.getBoundingClientRect();
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rect.width));
  canvas.height = Math.max(1, Math.round(rect.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = normalizeCssColor(getComputedStyle(target).backgroundColor) || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const els = Array.from(target.querySelectorAll("*")).slice(0, 800) as HTMLElement[];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.right < rect.left || r.bottom < rect.top) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
    const x = Math.round(r.left - rect.left);
    const y = Math.round(r.top - rect.top);
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    const bg = normalizeCssColor(cs.backgroundColor);
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, w, h);
    }
    const border = normalizeCssColor(cs.borderTopColor);
    if (border && border !== "rgba(0, 0, 0, 0)" && Number.parseFloat(cs.borderTopWidth) > 0) {
      ctx.strokeStyle = border;
      ctx.lineWidth = Math.max(1, Number.parseFloat(cs.borderTopWidth));
      ctx.strokeRect(x, y, w, h);
    }

    const text = (el.children.length === 0 ? el.innerText || el.textContent || "" : "").trim();
    if (!text) continue;
    ctx.fillStyle = normalizeCssColor(cs.color) || "#000000";
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillText(text.slice(0, 120), x + 3, y + 3, Math.max(0, w - 6));
  }
  return canvas;
}

function findUnsupportedSnapshotStyle(root: HTMLElement): string | null {
  const els = [root, ...Array.from(root.querySelectorAll("*"))] as HTMLElement[];
  for (const el of els) {
    const cs = getComputedStyle(el);
    for (const prop of Array.from(cs)) {
      if (prop.startsWith("--")) continue;
      const value = cs.getPropertyValue(prop);
      if (value.includes("color(") || value.includes("color-mix(") || value.includes("light-dark(")) {
        const label = el.id ? `#${el.id}` : el.className ? `.${String(el.className).split(/\s+/)[0]}` : el.tagName.toLowerCase();
        return `${label} ${prop}: ${value}`;
      }
    }
  }
  return null;
}

async function withSnapshotSafeStyles<T>(target: HTMLElement, capture: () => Promise<T>): Promise<T> {
  const els = [target, ...Array.from(target.querySelectorAll("*"))] as HTMLElement[];
  const previousStyles = els.map((el) => el.getAttribute("style"));
  const sheets = Array.from(document.querySelectorAll("style,link[rel='stylesheet']")) as HTMLElement[];
  const sheetPositions = sheets.map((el) => ({
    el,
    parent: el.parentNode,
    next: el.nextSibling,
  }));

  try {
    els.forEach((el) => {
      const cs = getComputedStyle(el);
      el.removeAttribute("style");
      for (const prop of Array.from(cs)) {
        const safe = snapshotSafeValue(prop, cs.getPropertyValue(prop));
        if (safe != null) el.style.setProperty(prop, safe, cs.getPropertyPriority(prop));
      }
    });
    sheetPositions.forEach(({ el }) => el.remove());
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const unsafe = findUnsupportedSnapshotStyle(target);
    if (unsafe) throw new Error(`snapshot unsafe computed style remains: ${unsafe}`);
    return await capture();
  } finally {
    els.forEach((el, i) => {
      const prev = previousStyles[i];
      if (prev == null) el.removeAttribute("style");
      else el.setAttribute("style", prev);
    });
    sheetPositions.forEach(({ el, parent, next }) => {
      if (!parent) return;
      if (next && next.parentNode === parent) parent.insertBefore(el, next);
      else parent.appendChild(el);
    });
  }
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
            case "drag":
              result = await hostDrag(params ?? {});
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
