import { useCallback, useEffect, useRef, useState } from "react";
import { AutoComplete, Input } from "antd";
import {
  connectToServer,
  callTool,
  type ServerInfo,
  type ToolCallInfo,
  type ModelContext,
} from "./mcp/host-bridge";
import {
  buildMcpTools,
  runTurn,
  resumeTurn,
  displayItemsFromState,
  pendingHitlCall,
  type DisplayItem,
} from "./agent/runner";
import { isFormSubmit, validateResult, type FormSpec } from "@omni/forms-dsl";
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
  getConversationState,
  conversationStateAccessor,
  logFormEvent,
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

  const [messages, setMessages] = useState<DisplayItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [activation, setActivation] = useState<ToolCallInfo | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // The latest server, readable from stable callbacks without re-binding them.
  const serverRef = useRef<ServerInfo | null>(null);
  useEffect(() => {
    serverRef.current = server;
  }, [server]);

  const refreshConversations = useCallback(async () => {
    setConversations(await listConversations());
  }, []);

  /**
   * Reflect a conversation's persisted SDK state into the UI: render the full
   * transcript (text bubbles + tool cards) and, if the conversation is paused
   * awaiting form input, re-mount the panel for the pending call so the user
   * can still submit — even after a reload.
   */
  const hydrate = useCallback(async (id: number) => {
    const state = await getConversationState(id);
    if (state) {
      setMessages(displayItemsFromState(state));
      const pending = pendingHitlCall(state);
      const srv = serverRef.current;
      if (pending && srv?.tools.has(pending.name)) {
        const info = callTool(srv, pending.name, pending.args);
        setActivation(info);
      } else {
        setActivation(null);
      }
      return;
    }
    // Legacy text-only conversations (pre SDK-state migration).
    const rows = await getMessages(id);
    setMessages(rows.map((r) => ({ kind: "msg", role: r.role as "user" | "assistant", content: r.content })));
    setActivation(null);
  }, []);

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
    setMessages([]);
    setActivation(null);
    setConnError(null);
    setHistoryOpen(false);
  }, []);

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
        setMessages([]);
        setActivation(null);
      }
      await refreshConversations();
    },
    [conversationId, refreshConversations],
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
      if (last?.kind === "msg" && last.role === "assistant") {
        next[next.length - 1] = { ...last, content: last.content + delta };
      }
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

    let convId = conversationId;
    if (convId == null) {
      convId = await createConversation(text.slice(0, 60));
      setConversationId(convId);
    }

    setMessages((m) => [
      ...m,
      { kind: "msg", role: "user", content: text },
      { kind: "msg", role: "assistant", content: "" },
    ]);
    setInput("");
    setBusy(true);

    const tools = server ? buildMcpTools(server, setActivation) : [];
    const state = conversationStateAccessor(convId);

    try {
      await runTurn({ apiKey, model, userText: text, state, tools, onTextDelta: appendDeltaToLastAssistant });
      // Reconcile the transcript with persisted state (surfaces tool cards). The
      // panel, if a form paused, was already opened by onAutoSummon mid-turn.
      setMessages(displayItemsFromState(await getConversationState(convId)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((m) => {
        const next = m.slice();
        const last = next[next.length - 1];
        if (last?.kind === "msg" && last.role === "assistant" && !last.content) {
          next[next.length - 1] = { ...last, content: `⚠️ ${msg}` };
        }
        return next;
      });
    } finally {
      setBusy(false);
      await touchConversation(convId);
      void refreshConversations();
    }
  }, [input, busy, apiKey, model, server, conversationId, appendDeltaToLastAssistant, hydrate, refreshConversations]);

  /**
   * The form app pushes the user's submission here (via `updateModelContext`).
   * We validate it host-side (the iframe is untrusted), resolve the paused HITL
   * call with the cleaned values, and let the SDK resume the conversation.
   */
  const onAppContext = useCallback(
    async (ctx: ModelContext | null) => {
      const sc = ctx?.structuredContent;
      if (!isFormSubmit(sc) || busy) return;
      const convId = conversationId;
      if (convId == null) return;

      const state = await getConversationState(convId);
      const pending = pendingHitlCall(state);
      if (!pending) return;

      const spec = pending.args as unknown as FormSpec;
      const check = validateResult(spec, sc.values);
      const output = check.ok ? check.cleaned : { error: "invalid_result", issues: check.issues };

      void logFormEvent({
        conversationId: convId,
        toolName: pending.name,
        spec,
        specValid: true,
        issues: check.ok ? undefined : check.issues,
        result: sc.values,
        status: "submitted",
      });

      setActivation(null);
      setBusy(true);
      setMessages((m) => [...m, { kind: "msg", role: "assistant", content: "" }]);

      const accessor = conversationStateAccessor(convId);
      const tools = server ? buildMcpTools(server, setActivation) : [];
      try {
        await resumeTurn({
          apiKey,
          model,
          callId: pending.callId,
          output,
          state: accessor,
          tools,
          onTextDelta: appendDeltaToLastAssistant,
        });
        setMessages(displayItemsFromState(await getConversationState(convId)));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setMessages((m) => {
          const next = m.slice();
          const last = next[next.length - 1];
          if (last?.kind === "msg" && last.role === "assistant" && !last.content) {
            next[next.length - 1] = { ...last, content: `⚠️ ${msg}` };
          }
          return next;
        });
      } finally {
        setBusy(false);
        await touchConversation(convId);
        void refreshConversations();
      }
    },
    [busy, conversationId, server, apiKey, model, appendDeltaToLastAssistant, hydrate, refreshConversations],
  );

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
          {messages.map((m, i) =>
            m.kind === "tool" ? (
              <div key={i} className={`tool-card ${m.status}`}>
                <span className="tool-card-icon">🔧</span>
                <span className="tool-card-name">{m.name}</span>
                <span className="tool-card-status">
                  {m.status === "pending" && "· awaiting input"}
                  {m.status === "done" && "· done"}
                  {m.status === "error" && "· error"}
                </span>
              </div>
            ) : (
              <div key={i} className={`bubble ${m.role}`}>
                {m.content || (busy && i === messages.length - 1 ? "…" : "")}
              </div>
            ),
          )}
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

      <AppPane
        activation={activation}
        onClose={() => setActivation(null)}
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
