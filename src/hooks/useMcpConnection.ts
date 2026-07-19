import { useCallback, useEffect, useRef, useState } from "react";
import { connectToServer, type ServerInfo } from "../mcp/host-bridge";
import { logEvent } from "../lib/events";
import { getSetting, setSetting, upsertMcpServer, listMcpServers } from "../lib/db";

// Older builds prefilled this external demo endpoint even though Omni does not
// start it. Do not restore it automatically; users can still enter it manually.
const LEGACY_DEMO_MCP_SERVER = "http://localhost:3001/mcp";

export type ConnectTrigger = "auto" | "manual" | "debug-bridge";

function eventSource(trigger: ConnectTrigger) {
  return trigger === "manual" ? "user" : trigger === "debug-bridge" ? "debug-bridge" : "system";
}

export function useMcpConnection() {
  const [serverUrl, setServerUrl] = useState("");
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [serverOptions, setServerOptions] = useState<{ value: string }[]>([]);
  const inFlight = useRef(false);

  const connectTo = useCallback(async (url: string, trigger: ConnectTrigger): Promise<ServerInfo | null> => {
    const trimmed = url.trim();
    if (!trimmed) {
      const msg = "Enter the URL of an MCP server to connect optional tools.";
      setConnectError(msg);
      logEvent({
        source: eventSource(trigger),
        type: "mcp.connect.error",
        data: { url: trimmed, error: msg, trigger },
      });
      return null;
    }
    if (inFlight.current) return null;
    inFlight.current = true;
    setConnecting(true);
    setConnectError(null);
    const started = performance.now();
    logEvent({
      source: eventSource(trigger),
      type: "mcp.connect.attempt",
      data: { url: trimmed, trigger },
    });
    try {
      const info = await connectToServer(new URL(trimmed));
      setServer(info);
      setServerUrl(trimmed);
      void setSetting("server_url", trimmed);
      void upsertMcpServer(trimmed, info.name);
      setServerOptions((opts) =>
        opts.some((o) => o.value === trimmed) ? opts : [...opts, { value: trimmed }],
      );
      logEvent({
        source: eventSource(trigger),
        type: "mcp.connect.ok",
        data: {
          url: trimmed,
          name: info.name,
          tools: info.tools.size,
          trigger,
          durationMs: Math.round(performance.now() - started),
        },
      });
      return info;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setConnectError(msg);
      logEvent({
        source: eventSource(trigger),
        type: "mcp.connect.error",
        data: {
          url: trimmed,
          error: msg,
          trigger,
          durationMs: Math.round(performance.now() - started),
        },
      });
      return null;
    } finally {
      inFlight.current = false;
      setConnecting(false);
    }
  }, []);

  const connect = useCallback(() => connectTo(serverUrl, "manual"), [connectTo, serverUrl]);

  const updateServerUrl = useCallback((url: string) => {
    setServerUrl(url);
    setConnectError(null);
  }, []);

  const connectFromBridge = useCallback(
    (url: string) => connectTo(url, "debug-bridge"),
    [connectTo],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [savedUrl, rows] = await Promise.all([getSetting("server_url"), listMcpServers()]);
      if (cancelled) return;
      const shouldClearLegacyDefault = savedUrl === LEGACY_DEMO_MCP_SERVER;
      const restoredUrl = shouldClearLegacyDefault ? "" : savedUrl?.trim();
      if (shouldClearLegacyDefault) void setSetting("server_url", "");

      const urls = new Set(
        rows
          .map((row: { url: string }) => row.url)
          .filter((url) => url !== LEGACY_DEMO_MCP_SERVER),
      );
      if (restoredUrl) urls.add(restoredUrl);
      setServerOptions([...urls].map((value) => ({ value })));
      // MCP tools are optional. Remember the last URL, but never turn a
      // stopped external server into an error on app startup.
      if (restoredUrl) setServerUrl(restoredUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [connectTo]);

  return {
    serverUrl,
    setServerUrl: updateServerUrl,
    server,
    connecting,
    connectError,
    serverOptions,
    connect,
    connectFromBridge,
  };
}
