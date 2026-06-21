/**
 * Inline MCP App mount — the interactive sandbox iframe rendered *in the
 * transcript*, embedded on the tool call that summoned it (replaces the
 * slide-out `AppPane`).
 *
 * Given the live `ToolCallInfo` for a pending/open tool, it creates the outer
 * sandbox iframe and drives the host-bridge lifecycle via `mountApp()`, exactly
 * as the old pane did — only the mount target moved. The iframe sizes itself
 * via the bridge's `onsizechange`, so it grows to fit the form inline.
 */
import { useEffect, useRef, useState } from "react";
import type { AppBridge } from "@modelcontextprotocol/ext-apps/app-bridge";
import { mountApp, type ToolCallInfo, type ModelContext } from "../mcp/host-bridge";

export interface InlineAppMountProps {
  activation: ToolCallInfo;
  /** Structured data the app pushes back into the conversation context. */
  onContextUpdate?: (ctx: ModelContext | null) => void;
}

export function InlineAppMount({ activation, onContextUpdate }: InlineAppMountProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<AppBridge | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  // Read the callback through a ref so a changing identity (App re-renders the
  // chat constantly while streaming) can never tear down and remount the iframe
  // mid-form — the effect depends only on the activation itself.
  const ctxRef = useRef(onContextUpdate);
  ctxRef.current = onContextUpdate;

  useEffect(() => {
    if (!mountRef.current) return;

    let disposed = false;
    const container = mountRef.current;
    setStatus("loading");
    setError(null);

    // Fresh outer iframe per activation. Its src is set to the cross-origin
    // sandbox proxy inside loadSandboxProxy() — never to app HTML directly.
    const iframe = document.createElement("iframe");
    iframe.title = "MCP App";
    // Height is driven by the app's size-changed reports (host bridge's
    // `onsizechange` sets `iframe.style.height`), so the embed hugs the form's
    // natural content height. A small initial height avoids the browser's 150px
    // default iframe flash before the first report lands.
    iframe.style.cssText =
      "width:100%;height:80px;border:none;background:transparent;display:block;";
    container.appendChild(iframe);

    mountApp(iframe, activation, {
      onContextUpdate: (ctx) => ctxRef.current?.(ctx),
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
  }, [activation]);

  return (
    <div className="inline-app-mount">
      {status === "loading" && <div className="inline-app-note">Summoning app…</div>}
      {status === "error" && (
        <div className="inline-app-note error">Failed to load app: {error}</div>
      )}
      {/* The bridge mounts the outer iframe into this element. */}
      <div ref={mountRef} className="inline-app-surface" />
    </div>
  );
}
