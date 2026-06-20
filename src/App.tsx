import { useCallback, useEffect, useRef, useState } from "react";
import { AutoComplete, Input } from "antd";
import {
  connectToServer,
  type ServerInfo,
  type ToolCallInfo,
} from "./mcp/host-bridge";
import { buildMcpTools, runTurn, type ChatMsg } from "./agent/runner";
import { ModelPicker } from "./components/ModelPicker";
import { AppPane } from "./components/AppPane";
import { getApiKey, saveApiKey, deleteApiKey, keyringAvailable } from "./lib/secrets";
import {
  getSetting,
  setSetting,
  upsertMcpServer,
  listMcpServers,
  createConversation,
  listConversations,
  getMessages,
  addMessage,
  touchConversation,
  deleteConversation,
  type ConversationRow,
} from "./lib/db";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { HistoryOutlined } from "@ant-design/icons";
import "./App.css";

const DEFAULT_SERVER = "http://localhost:3001/mcp";

export default function App() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<"loading" | "stored" | "unsaved" | "empty">("loading");
  const [model, setModel] = useState("");

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

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const refreshConversations = useCallback(async () => {
    setConversations(await listConversations());
  }, []);

  // Restore the most recent conversation on mount.
  useEffect(() => {
    (async () => {
      const convs = await listConversations();
      setConversations(convs);
      if (convs.length > 0) {
        const latest = convs[0];
        setConversationId(latest.id);
        const rows = await getMessages(latest.id);
        setMessages(rows.map((r) => ({ role: r.role as ChatMsg["role"], content: r.content })));
      }
    })();
  }, []);

  const newChat = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setConnError(null);
    setHistoryOpen(false);
  }, []);

  const switchConversation = useCallback(async (id: number) => {
    setConversationId(id);
    const rows = await getMessages(id);
    setMessages(rows.map((r) => ({ role: r.role as ChatMsg["role"], content: r.content })));
    setHistoryOpen(false);
  }, []);

  const removeConversation = useCallback(
    async (id: number) => {
      await deleteConversation(id);
      if (id === conversationId) {
        setConversationId(null);
        setMessages([]);
      }
      await refreshConversations();
    },
    [conversationId, refreshConversations],
  );

  const [activation, setActivation] = useState<ToolCallInfo | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      // Persist the connection for next launch.
      void setSetting("server_url", url);
      void upsertMcpServer(url, info.name);
      setServerOptions((opts) =>
        opts.some((o) => o.value === url) ? opts : [...opts, { value: url }],
      );
    } catch (e) {
      setConnError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }, [serverUrl]);

  const appendDeltaToLastAssistant = useCallback((delta: string) => {
    setMessages((msgs) => {
      const next = msgs.slice();
      const last = next[next.length - 1];
      if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content + delta };
      return next;
    });
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (!apiKey) return setConnError("Enter your OpenRouter API key first.");
    if (!model) return setConnError("Pick a model first.");
    setConnError(null);

    // Ensure a conversation exists (title from the first user message).
    let convId = conversationId;
    if (convId == null) {
      convId = await createConversation(text.slice(0, 60));
      setConversationId(convId);
    }

    const userMsg: ChatMsg = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    await addMessage(convId, "user", text);

    // Tools are rebuilt per turn; onAutoSummon slides the pane out.
    const tools = server ? buildMcpTools(server, setActivation) : [];

    try {
      const full = await runTurn({ apiKey, model, messages: history, tools, onTextDelta: appendDeltaToLastAssistant });
      await addMessage(convId, "assistant", full);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((m) => {
        const next = m.slice();
        const last = next[next.length - 1];
        if (last?.role === "assistant" && !last.content) next[next.length - 1] = { ...last, content: `⚠️ ${msg}` };
        return next;
      });
      await addMessage(convId, "assistant", `⚠️ ${msg}`);
    } finally {
      setBusy(false);
      await touchConversation(convId);
      void refreshConversations();
    }
  }, [input, busy, apiKey, model, messages, server, conversationId, appendDeltaToLastAssistant, refreshConversations]);

  const toolCount = server ? server.tools.size : 0;

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

        <section className="messages" ref={scrollRef}>
          {messages.length === 0 && (
            <p className="hint">
              Pick a model, paste your OpenRouter key, connect an MCP server, then
              chat. When the model calls a tool that has a UI, the panel slides out
              automatically.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.content || (busy && i === messages.length - 1 ? "…" : "")}
            </div>
          ))}
        </section>

        <section className="composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={server ? "Message… (Enter to send)" : "Connect a server to start"}
            rows={2}
          />
          <button onClick={send} disabled={busy || !input.trim()}>
            {busy ? "…" : "Send"}
          </button>
        </section>
      </main>

      <AppPane activation={activation} onClose={() => setActivation(null)} />

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
