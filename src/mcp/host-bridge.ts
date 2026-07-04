/**
 * MCP Apps host bridge.
 *
 * Ported and lightly adapted from the MCP ext-apps `basic-host` reference
 * (examples/basic-host/src/implementation.ts). This is the load-bearing piece:
 * it wires an MCP `Client` to the provided `AppBridge`, which speaks the
 * MCP Apps postMessage protocol to the sandboxed UI running in an iframe.
 *
 * Key architectural constraint (from the spec): the sandbox proxy iframe MUST
 * be served from a DIFFERENT ORIGIN than this host. In dev we serve it from
 * http://localhost:1430 (see sandbox-server.ts) while the host runs on :1420.
 */

import {
  RESOURCE_MIME_TYPE,
  getToolUiResourceUri,
  type McpUiSandboxProxyReadyNotification,
  AppBridge,
  PostMessageTransport,
  type McpUiResourceCsp,
  type McpUiResourcePermissions,
  buildAllowAttribute,
  type McpUiUpdateModelContextRequest,
  type McpUiMessageRequest,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult, Resource, Tool } from "@modelcontextprotocol/sdk/types.js";
import { getTheme, onThemeChange } from "./theme";
import { HOST_STYLE_VARIABLES } from "./host-styles";

/** The cross-origin sandbox proxy. MUST differ from the host origin. */
export const SANDBOX_PROXY_BASE_URL =
  import.meta.env.VITE_SANDBOX_URL ?? "http://localhost:1430/sandbox.html";

const IMPLEMENTATION = { name: "Omni Desktop (MCP Apps Host)", version: "0.1.0" };

export const log = {
  info: console.log.bind(console, "[HOST]"),
  warn: console.warn.bind(console, "[HOST]"),
  error: console.error.bind(console, "[HOST]"),
};

export interface ServerInfo {
  name: string;
  url: string;
  client: Client;
  tools: Map<string, Tool>;
  resources: Map<string, Resource>;
  appHtmlCache: Map<string, string>;
}

export async function connectToServer(serverUrl: URL): Promise<ServerInfo> {
  log.info("Connecting to server:", serverUrl.href);
  const client = await connectWithFallback(serverUrl);

  const name = client.getServerVersion()?.name ?? serverUrl.href;

  const toolsList = await client.listTools();
  const tools = new Map(toolsList.tools.map((tool) => [tool.name, tool]));
  log.info("Server tools:", Array.from(tools.keys()));

  // Resources carry listing-level _meta.ui (fallback for content-level).
  const resourcesList = await client.listResources().catch(() => ({ resources: [] }));
  const resources = new Map(resourcesList.resources.map((r) => [r.uri, r]));
  log.info("Server resources:", Array.from(resources.keys()));

  return { name, url: serverUrl.href, client, tools, resources, appHtmlCache: new Map() };
}

async function connectWithFallback(serverUrl: URL): Promise<Client> {
  try {
    const client = new Client(IMPLEMENTATION);
    await client.connect(new StreamableHTTPClientTransport(serverUrl));
    log.info("Connected via Streamable HTTP transport");
    return client;
  } catch (streamableError) {
    log.info("Streamable HTTP failed, trying SSE:", streamableError);
  }

  try {
    const client = new Client(IMPLEMENTATION);
    await client.connect(new SSEClientTransport(serverUrl));
    log.info("Connected via SSE transport");
    return client;
  } catch (sseError) {
    throw new Error(`Could not connect with any transport. SSE error: ${sseError}`);
  }
}

interface UiResourceData {
  html: string;
  csp?: McpUiResourceCsp;
  permissions?: McpUiResourcePermissions;
}

export interface ToolCallInfo {
  serverInfo: ServerInfo;
  tool: Tool;
  input: Record<string, unknown>;
  resultPromise: Promise<CallToolResult>;
  appResourcePromise?: Promise<UiResourceData>;
}

export function hasAppHtml(t: ToolCallInfo): t is Required<ToolCallInfo> {
  return !!t.appResourcePromise;
}

/** Non-throwing variant: does this tool declare an MCP App UI resource? */
export function getToolUiResourceUriSafe(tool: Tool): string | undefined {
  try {
    return getToolUiResourceUri(tool) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Invoke a tool. If it declares a UI resource, also fetch the app HTML. */
export function callTool(
  serverInfo: ServerInfo,
  name: string,
  input: Record<string, unknown>,
): ToolCallInfo {
  log.info("Calling tool", name, "with input", input);
  const resultPromise = serverInfo.client.callTool({
    name,
    arguments: input,
  }) as Promise<CallToolResult>;

  const tool = serverInfo.tools.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);

  const toolCallInfo: ToolCallInfo = { serverInfo, tool, input, resultPromise };

  const uiResourceUri = getToolUiResourceUri(tool);
  if (uiResourceUri) {
    toolCallInfo.appResourcePromise = getUiResource(serverInfo, uiResourceUri);
  }

  return toolCallInfo;
}

async function getUiResource(serverInfo: ServerInfo, uri: string): Promise<UiResourceData> {
  log.info("Reading UI resource:", uri);
  const resource = await serverInfo.client.readResource({ uri });
  if (!resource) throw new Error(`Resource not found: ${uri}`);
  if (resource.contents.length !== 1) {
    throw new Error(`Unexpected contents count: ${resource.contents.length}`);
  }

  const content = resource.contents[0];
  if (content.mimeType !== RESOURCE_MIME_TYPE) {
    throw new Error(`Unsupported MIME type: ${content.mimeType}`);
  }

  const html = "blob" in content ? atob(content.blob as string) : (content.text as string);

  // Content-level _meta.ui takes precedence; fall back to listing-level.
  const contentMeta = (content as any)._meta || (content as any).meta;
  const listingMeta = (serverInfo.resources.get(uri) as any)?._meta;
  const uiMeta = contentMeta?.ui ?? listingMeta?.ui;

  return { html, csp: uiMeta?.csp, permissions: uiMeta?.permissions };
}

/** Point the outer sandbox iframe at the cross-origin proxy and await ready. */
export function loadSandboxProxy(
  iframe: HTMLIFrameElement,
  csp?: McpUiResourceCsp,
  permissions?: McpUiResourcePermissions,
): Promise<boolean> {
  if (iframe.src) return Promise.resolve(false); // prevent reload

  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  const allowAttribute = buildAllowAttribute(permissions);
  if (allowAttribute) iframe.setAttribute("allow", allowAttribute);

  const readyNotification: McpUiSandboxProxyReadyNotification["method"] =
    "ui/notifications/sandbox-proxy-ready";

  const readyPromise = new Promise<boolean>((resolve) => {
    const listener = ({ source, data }: MessageEvent) => {
      if (source === iframe.contentWindow && data?.method === readyNotification) {
        log.info("Sandbox proxy loaded");
        window.removeEventListener("message", listener);
        resolve(true);
      }
    };
    window.addEventListener("message", listener);
  });

  const sandboxUrl = new URL(SANDBOX_PROXY_BASE_URL);
  if (csp) sandboxUrl.searchParams.set("csp", JSON.stringify(csp));
  log.info("Loading sandbox proxy...", csp ? `(CSP: ${JSON.stringify(csp)})` : "");
  iframe.src = sandboxUrl.href;

  return readyPromise;
}

export async function initializeApp(
  iframe: HTMLIFrameElement,
  appBridge: AppBridge,
  { input, resultPromise, appResourcePromise }: Required<ToolCallInfo>,
): Promise<void> {
  const appInitializedPromise = hookInitializedCallback(appBridge);

  // Pass contentWindow as BOTH target and source so this transport only
  // accepts messages from this specific iframe.
  await appBridge.connect(
    new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!),
  );

  const { html, csp, permissions } = await appResourcePromise;
  await appBridge.sendSandboxResourceReady({ html, csp, permissions });

  await appInitializedPromise;
  log.info("MCP App initialized");

  appBridge.sendToolInput({ arguments: input });

  resultPromise.then(
    (result) => appBridge.sendToolResult(result),
    (error) =>
      appBridge.sendToolCancelled({
        reason: error instanceof Error ? error.message : String(error),
      }),
  );
}

function hookInitializedCallback(appBridge: AppBridge): Promise<void> {
  const oninitialized = appBridge.oninitialized;
  return new Promise<void>((resolve) => {
    appBridge.oninitialized = (...args) => {
      resolve();
      appBridge.oninitialized = oninitialized;
      appBridge.oninitialized?.(...args);
    };
  });
}

export type ModelContext = McpUiUpdateModelContextRequest["params"];
export type AppMessage = McpUiMessageRequest["params"];

/**
 * Latest layout metrics a form app reported via `sendLog` — the only window
 * into the cross-origin iframe's interior (the debug bridge surfaces it).
 */
let latestFormMetrics: unknown = null;
export function getLatestFormMetrics(): unknown {
  return latestFormMetrics;
}

export interface AppBridgeCallbacks {
  onContextUpdate?: (context: ModelContext | null) => void;
  onMessage?: (message: AppMessage) => void;
  onDisplayModeChange?: (mode: "inline" | "fullscreen") => void;
}

export function newAppBridge(
  serverInfo: ServerInfo,
  iframe: HTMLIFrameElement,
  callbacks?: AppBridgeCallbacks,
): AppBridge {
  const serverCapabilities = serverInfo.client.getServerCapabilities();
  const appBridge = new AppBridge(
    serverInfo.client,
    IMPLEMENTATION,
    {
      openLinks: {},
      serverTools: serverCapabilities?.tools,
      serverResources: serverCapabilities?.resources,
      updateModelContext: { text: {} },
    },
    {
      hostContext: {
        theme: getTheme(),
        platform: "web",
        styles: { variables: HOST_STYLE_VARIABLES },
        containerDimensions: { maxHeight: 6000 },
        displayMode: "inline",
        availableDisplayModes: ["inline", "fullscreen"],
      },
    },
  );

  const offTheme = onThemeChange((newTheme) =>
    appBridge.sendHostContextChange({ theme: newTheme }),
  );

  const iframeResizeObserver = new ResizeObserver(([entry]) => {
    const width = Math.round(entry.contentRect.width);
    if (width > 0) {
      appBridge.sendHostContextChange({ containerDimensions: { width, maxHeight: 6000 } });
    }
  });
  iframeResizeObserver.observe(iframe);

  const prevOnclose = appBridge.onclose;
  appBridge.onclose = () => {
    iframeResizeObserver.disconnect();
    offTheme();
    prevOnclose?.();
  };

  // Register handlers BEFORE connect() — the app can send requests immediately
  // after the init handshake, so late handlers would miss early requests.

  appBridge.onmessage = async (params) => {
    callbacks?.onMessage?.(params);
    return {};
  };

  appBridge.onopenlink = async (params) => {
    window.open(params.url, "_blank", "noopener,noreferrer");
    return {};
  };

  appBridge.onloggingmessage = (params) => {
    // Form apps report their own computed layout here (the debug bridge reads it
    // to introspect the cross-origin iframe interior). Other logs just print.
    const data = params?.data as { kind?: string } | undefined;
    if (data?.kind === "omni.form/metrics") latestFormMetrics = data;
    else log.info("App log:", params);
  };

  appBridge.onupdatemodelcontext = async (params) => {
    const hasContent = params.content && params.content.length > 0;
    const hasStructured =
      params.structuredContent && Object.keys(params.structuredContent).length > 0;
    callbacks?.onContextUpdate?.(hasContent || hasStructured ? params : null);
    return {};
  };

  appBridge.onsizechange = async ({ height }) => {
    if (height !== undefined) {
      iframe.style.height = `${height}px`;
    }
  };

  appBridge.onrequestdisplaymode = async (params) => {
    const newMode = params.mode === "fullscreen" ? "fullscreen" : "inline";
    appBridge.sendHostContextChange({ displayMode: newMode });
    callbacks?.onDisplayModeChange?.(newMode);
    return { mode: newMode };
  };

  return appBridge;
}

/**
 * High-level lifecycle helper used by the slide-out pane: mount a tool's app
 * into the given (empty) outer iframe and return the live bridge.
 */
export async function mountApp(
  iframe: HTMLIFrameElement,
  toolCallInfo: ToolCallInfo,
  callbacks?: AppBridgeCallbacks,
): Promise<AppBridge> {
  if (!hasAppHtml(toolCallInfo)) {
    throw new Error("This tool did not declare an MCP App UI resource.");
  }
  const { csp, permissions } = await toolCallInfo.appResourcePromise;
  await loadSandboxProxy(iframe, csp, permissions);
  const bridge = newAppBridge(toolCallInfo.serverInfo, iframe, callbacks);
  await initializeApp(iframe, bridge, toolCallInfo);
  return bridge;
}
