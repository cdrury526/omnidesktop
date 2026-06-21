import { useCallback, useEffect, useRef, useState } from "react";
import { connectToServer, type ServerInfo } from "../mcp/host-bridge";
import { logEvent } from "../lib/events";
import { getSetting, setSetting, upsertMcpServer, listMcpServers } from "../lib/db";

export const DEFAULT_MCP_SERVER = "http://localhost:3001/mcp";

export type ConnectTrigger = "auto" | "manual" | "debug-bridge";

function eventSource(trigger: ConnectTrigger) {
  return trigger === "manual" ? "user" : trigger === "debug-bridge" ? "debug-bridge" : "system";
}

export function useMcpConnection() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_MCP_SERVER);
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [serverOptions, setServerOptions] = useState<{ value: string }[]>([
    { value: DEFAULT_MCP_SERVER },
  ]);
  const inFlight = useRef(false);

  const connectTo = useCallback(async (url: string, trigger: ConnectTrigger): Promise<ServerInfo | null> => {
    const trimmed = url.trim();
    if (!trimmed) {
      const msg = "Enter an MCP server URL (e.g. http://localhost:3001/mcp).";
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

  const connectFromBridge = useCallback(
    (url: string) => connectTo(url, "debug-bridge"),
    [connectTo],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [savedUrl, rows] = await Promise.all([getSetting("server_url"), listMcpServers()]);
      if (cancelled) return;
      const urls = new Set([DEFAULT_MCP_SERVER, ...rows.map((r: { url: string }) => r.url)]);
      if (savedUrl) urls.add(savedUrl);
      setServerOptions([...urls].map((value) => ({ value })));
      if (savedUrl) setServerUrl(savedUrl);
      if (savedUrl?.trim()) await connectTo(savedUrl.trim(), "auto");
    })();
    return () => {
      cancelled = true;
    };
  }, [connectTo]);

  return {
    serverUrl,
    setServerUrl,
    server,
    connecting,
    connectError,
    serverOptions,
    connect,
    connectFromBridge,
  };
}
