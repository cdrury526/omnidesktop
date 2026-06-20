/**
 * The slide-out MCP App pane (Pane 2).
 *
 * When `activation` is set, this pane slides in from the right, creates the
 * OUTER sandbox iframe, and drives the host bridge lifecycle via mountApp().
 * When dismissed it tears the bridge down and slides away.
 */
import { useEffect, useRef, useState } from "react";
import type { AppBridge } from "@modelcontextprotocol/ext-apps/app-bridge";
import { mountApp, type ToolCallInfo, type ModelContext } from "../mcp/host-bridge";

export interface AppPaneProps {
  activation: ToolCallInfo | null;
  onClose: () => void;
  /** Structured data the app pushes back into the conversation context. */
  onContextUpdate?: (ctx: ModelContext | null) => void;
}

export function AppPane({ activation, onClose, onContextUpdate }: AppPaneProps) {
  const open = activation !== null;
  const mountRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<AppBridge | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activation || !mountRef.current) return;

    let disposed = false;
    const container = mountRef.current;
    setStatus("loading");
    setError(null);

    // Fresh outer iframe per activation. Its src is set to the cross-origin
    // sandbox proxy inside loadSandboxProxy() — never to app HTML directly.
    const iframe = document.createElement("iframe");
    iframe.title = "MCP App";
    iframe.style.cssText = "width:100%;height:100%;border:none;background:transparent;";
    container.appendChild(iframe);

    mountApp(iframe, activation, {
      onContextUpdate,
      onDisplayModeChange: () => {},
    })
      .then((bridge) => {
        if (disposed) {
          bridge.close();
          return;
        }
        bridgeRef.current = bridge;
        setStatus("ready");
      })
      .catch((e) => {
        if (disposed) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      disposed = true;
      bridgeRef.current?.close();
      bridgeRef.current = null;
      container.replaceChildren();
    };
  }, [activation, onContextUpdate]);

  return (
    <aside className={`app-pane ${open ? "open" : ""}`} aria-hidden={!open}>
      <header className="app-pane-header">
        <span className="app-pane-title">
          {activation ? activation.tool.title ?? activation.tool.name : "MCP App"}
        </span>
        <button className="app-pane-close" onClick={onClose} title="Dismiss">
          ✕
        </button>
      </header>

      <div className="app-pane-body">
        {status === "loading" && <div className="app-pane-note">Summoning app…</div>}
        {status === "error" && (
          <div className="app-pane-note error">Failed to load app: {error}</div>
        )}
        {/* The bridge mounts the outer iframe into this element. */}
        <div ref={mountRef} className="app-pane-surface" />
      </div>
    </aside>
  );
}
