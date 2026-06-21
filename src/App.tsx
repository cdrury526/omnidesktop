import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import { AutoComplete, Input } from "antd";
import { Bubble, Sender, ThoughtChain } from "@ant-design/x";
import { XMarkdown } from "@ant-design/x-markdown";
import { markdownComponents } from "./components/MarkdownCode";
import { connectToServer, type ServerInfo } from "./mcp/host-bridge";
import { type DisplayItem } from "./agent/runner";
import { useDebugBridge } from "./lib/debug-bridge";
import { logEvent, installErrorCapture } from "./lib/events";
import { useAgentChat } from "./hooks/useAgentChat";
import { ModelPicker } from "./components/ModelPicker";
import { AppPane } from "./components/AppPane";
import { getApiKey, saveApiKey, deleteApiKey, keyringAvailable } from "./lib/secrets";
import {
  getSetting,
  setSetting,
  upsertMcpServer,
  listMcpServers,
  listConversations,
  deleteConversation,
  type ConversationRow,
} from "./lib/db";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { ChatWelcome } from "./components/ChatWelcome";
import { HistoryOutlined } from "@ant-design/icons";
import "./App.css";

const DEFAULT_SERVER = "http://localhost:3001/mcp";

type ToolItem = Extract<DisplayItem, { kind: "tool" }>;

// Our tool-call statuses → ThoughtChain step status + a friendly label.
const TOOL_STATUS: Record<ToolItem["status"], { status: "loading" | "success" | "error" | "abort"; label: string }> = {
  pending: { status: "loading", label: "awaiting input" },
  done: { status: "success", label: "done" },
  error: { status: "error", label: "error" },
  cancelled: { status: "abort", label: "cancelled" },
};

function pretty(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") {
    try { return JSON.stringify(JSON.parse(v), null, 2); } catch { return v; }
  }
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

/**
 * One tool call rendered as a ThoughtChain step: status + expandable detail
 * (the call args — e.g. the form spec — and the result, linked by callId via
 * the persisted conversation_state). Self-contained expand state so it can live
 * inside Bubble.List's per-item contentRender.
 */
function ToolStep({ item }: { item: ToolItem }) {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const map = TOOL_STATUS[item.status];
  const argsText = pretty(item.args);
  const resultText = item.status === "pending" ? "" : pretty(item.result);
  const detail = [argsText && `arguments:\n${argsText}`, resultText && `result:\n${resultText}`]
    .filter(Boolean)
    .join("\n\n");
  return (
    <ThoughtChain
      className="tool-chain"
      items={[
        {
          key: item.callId || item.name,
          title: item.name,
          description: map.label,
          status: map.status,
          blink: item.status === "pending",
          collapsible: !!detail,
          content: detail ? (
            <pre className="tool-detail">{detail}</pre>
          ) : undefined,
        },
      ]}
      expandedKeys={expandedKeys}
      onExpand={setExpandedKeys}
    />
  );
}

export default function App() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<"loading" | "stored" | "unsaved" | "empty">("loading");
  const [model, setModel] = useState("");

  // Capture swallowed errors into the event log so a "weird thing" leaves a trace.
  useEffect(() => {
    installErrorCapture();
  }, []);

  // Load the saved key from the OS keyring once on mount.
  useEffect(() => {
    getApiKey().then((k) => {
      if (k) {
        setApiKey(k);
        setKeyStatus("stored");
      } else {
        setKeyStatus("empty");
      }
    });
  }, []);

  const [serverOptions, setServerOptions] = useState<{ value: string }[]>([
    { value: DEFAULT_SERVER },
  ]);

  // Restore persisted model + server URL and saved servers from the local DB.
  useEffect(() => {
    getSetting("model").then((m) => m && setModel(m));
    getSetting("server_url").then((u) => u && setServerUrl(u));
    listMcpServers().then((rows) => {
      const urls = new Set([DEFAULT_SERVER, ...rows.map((r) => r.url)]);
      setServerOptions([...urls].map((value) => ({ value })));
    });
  }, []);

  const onModelChange = useCallback((id: string) => {
    setModel(id);
    void setSetting("model", id);
  }, []);

  const persistKey = useCallback(async () => {
    if (!apiKey) {
      await deleteApiKey();
      setKeyStatus("empty");
    } else {
      await saveApiKey(apiKey);
      setKeyStatus("stored");
    }
  }, [apiKey]);

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const refreshConversations = useCallback(async () => {
    setConversations(await listConversations());
  }, []);

  // The chat session for the active conversation (transcript, composer, turn +
  // form actions). App keeps connection, the conversation list, and rendering.
  const chat = useAgentChat({
    apiKey,
    model,
    server,
    conversationId,
    setConversationId,
    onConversationsChanged: refreshConversations,
    setConnError,
  });
  const {
    messages, input, setInput, busy, queued, setQueued, formPending, activation,
    submit, cancelTurn, hydrate, resetChat, onAppContext, onPaneClose,
  } = chat;

  // Restore the most recent conversation on mount.
  useEffect(() => {
    (async () => {
      const convs = await listConversations();
      setConversations(convs);
      if (convs.length > 0) {
        setConversationId(convs[0].id);
        await hydrate(convs[0].id);
      }
    })();
  }, [hydrate]);

  const newChat = useCallback(() => {
    setConversationId(null);
    resetChat();
    setConnError(null);
    setHistoryOpen(false);
  }, [resetChat]);

  const switchConversation = useCallback(
    async (id: number) => {
      setConversationId(id);
      await hydrate(id);
      setHistoryOpen(false);
    },
    [hydrate],
  );

  const removeConversation = useCallback(
    async (id: number) => {
      await deleteConversation(id);
      if (id === conversationId) {
        setConversationId(null);
        resetChat();
      }
      await refreshConversations();
    },
    [conversationId, resetChat, refreshConversations],
  );

  const connect = useCallback(async () => {
    const url = serverUrl.trim();
    if (!url) {
      setConnError("Enter an MCP server URL (e.g. http://localhost:3001/mcp).");
      return;
    }
    setConnecting(true);
    setConnError(null);
    try {
      const info = await connectToServer(new URL(url));
      setServer(info);
      void setSetting("server_url", url);
      void upsertMcpServer(url, info.name);
      setServerOptions((opts) =>
        opts.some((o) => o.value === url) ? opts : [...opts, { value: url }],
      );
      logEvent({ source: "user", type: "connect", data: { url, name: info.name, tools: info.tools.size } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setConnError(msg);
      logEvent({ source: "user", type: "connect.error", data: { url, error: msg } });
    } finally {
      setConnecting(false);
    }
  }, [serverUrl]);

  // Local debug bridge: lets an agent drive/inspect this app over HTTP. App owns
  // connect/newchat; the chat-level actions come from useAgentChat. See
  // src/lib/debug-bridge.ts and src-tauri/src/debug.rs.
  useDebugBridge({
    connect: async (url) => {
      const info = await connectToServer(new URL(url));
      setServer(info);
      void setSetting("server_url", url);
      return { name: info.name, tools: [...info.tools.keys()] };
    },
    newchat: async () => {
      newChat();
      return { ok: true };
    },
    openform: chat.openFormBridge,
    send: chat.sendBridge,
    submit: chat.submitBridge,
    cancel: chat.cancelBridge,
    state: chat.bridgeState,
  });

  const toolCount = server ? server.tools.size : 0;

  // Per-role rendering for Bubble.List. Stable reference (the skill warns inline
  // role objects reset typing/animation). Assistant content goes through
  // XMarkdown (streaming-safe); user stays plain text; tool/queued reuse the
  // existing card markup until Phases 3/2 upgrade them.
  const roles = useMemo(
    () => ({
      user: {
        placement: "end" as const,
        contentRender: (content: unknown) => (
          <div className="bubble-user-text">{String(content ?? "")}</div>
        ),
      },
      assistant: {
        placement: "start" as const,
        // XMarkdown's own streaming animation: block elements fade in as they're
        // parsed from the stream (tied to real arrival, so it never throttles or
        // crawls), with a tail cursor while the model is still generating.
        // `status === "loading"` marks the actively-streaming bubble.
        contentRender: (content: unknown, info: { status?: string }) => {
          const live = info?.status === "loading";
          return (
            <XMarkdown
              content={String(content ?? "")}
              components={markdownComponents}
              streaming={{ hasNextChunk: live, enableAnimation: true, tail: live }}
            />
          );
        },
      },
      tool: {
        placement: "start" as const,
        variant: "borderless" as const,
        contentRender: (content: unknown) => <ToolStep item={content as ToolItem} />,
      },
      queued: {
        placement: "end" as const,
        variant: "borderless" as const,
        contentRender: (content: unknown) => {
          const q = content as { text: string; index: number };
          return (
            <div className="bubble queued">
              <span className="queued-text">{q.text}</span>
              <span className="queued-tag">queued</span>
              <button
                className="queued-remove"
                title="Remove from queue"
                onClick={() => setQueued((qs) => qs.filter((_, j) => j !== q.index))}
              >
                ✕
              </button>
            </div>
          );
        },
      },
    }),
    [],
  );

  // The transcript (messages + queued) mapped to Bubble.List items. The last
  // assistant bubble streams while busy (skeleton until the first delta lands).
  const bubbleItems = useMemo(() => {
    const items = messages.map((m, i) => {
      if (m.kind === "tool") return { key: `m${i}`, role: "tool", content: m };
      const streaming = m.role === "assistant" && i === messages.length - 1 && busy;
      return {
        key: `m${i}`,
        role: m.role,
        content: m.content,
        streaming,
        loading: streaming && !m.content,
      };
    });
    queued.forEach((text, index) =>
      items.push({ key: `q${index}`, role: "queued", content: { text, index } } as never),
    );
    return items as ComponentProps<typeof Bubble.List>["items"];
  }, [messages, queued, busy]);

  return (
    <div className="layout">
      <main className="chat-pane">
        <header className="chat-header">
          <h1>Omni Desktop</h1>
          <ModelPicker value={model} onChange={onModelChange} />
          <Input.Password
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setKeyStatus("unsaved");
            }}
            onBlur={persistKey}
            placeholder="OpenRouter API key"
            style={{ width: 220 }}
            title={
              keyringAvailable
                ? "Stored in your OS keyring"
                : "Not running in Tauri — key won't persist"
            }
          />
          <span className={`key-status ${keyStatus}`}>
            {keyStatus === "stored" && "🔒 saved"}
            {keyStatus === "unsaved" && "● unsaved"}
            {keyStatus === "empty" && "no key"}
          </span>
        </header>

        <section className="connect-row">
          <AutoComplete
            value={serverUrl}
            onChange={setServerUrl}
            options={serverOptions}
            style={{ flex: 1 }}
            popupMatchSelectWidth={false}
            filterOption={(input, option) =>
              (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
            }
            placeholder="http://localhost:3001/mcp"
            onKeyDown={(e) => {
              if (e.key === "Enter") connect();
            }}
          />
          <button onClick={connect} disabled={connecting}>
            {connecting ? "Connecting…" : server ? "Reconnect" : "Connect"}
          </button>
        </section>
        {server && (
          <div className="status-line">
            Connected to <strong>{server.name}</strong> · {toolCount} tool{toolCount === 1 ? "" : "s"} available
          </div>
        )}
        {connError && <div className="error-banner">{connError}</div>}

        <section className="chat-toolbar">
          <button className="ghost" onClick={() => setHistoryOpen(true)}>
            <HistoryOutlined /> History
          </button>
          <button className="ghost" onClick={newChat}>
            + New chat
          </button>
        </section>

        <section className="messages">
          {bubbleItems && bubbleItems.length > 0 ? (
            <Bubble.List
              items={bubbleItems}
              role={roles}
              autoScroll
              style={{ height: "100%" }}
            />
          ) : (
            <ChatWelcome onPick={submit} />
          )}
        </section>

        <section className="composer">
          <Sender
            value={input}
            onChange={setInput}
            onSubmit={submit}
            loading={busy}
            onCancel={cancelTurn}
            // While loading, Sender suppresses its own Enter-submit (the button
            // is "cancel"). Intercept Enter so a message typed mid-turn still
            // queues, matching the form-open queue path (which goes via onSubmit).
            onKeyDown={(e) => {
              if (busy && e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit(input);
                return false;
              }
            }}
            autoSize={{ minRows: 1, maxRows: 6 }}
            placeholder={
              !server
                ? "Connect a server to start"
                : busy
                  ? "Agent is working — Enter queues, ✕ cancels"
                  : formPending
                    ? "Form open — your message will queue (Enter)"
                    : "Message… (Enter to send)"
            }
          />
        </section>
      </main>

      <AppPane
        activation={activation}
        onClose={onPaneClose}
        onContextUpdate={onAppContext}
      />

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        conversations={conversations}
        activeId={conversationId}
        onSelect={switchConversation}
        onNew={newChat}
        onDelete={removeConversation}
      />
    </div>
  );
}
