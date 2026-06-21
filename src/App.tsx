import { useCallback, useEffect, useRef, useState } from "react";
import { AutoComplete, Input, Modal } from "antd";
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
  openForm,
  displayItemsFromState,
  pendingHitlCall,
  type DisplayItem,
} from "./agent/runner";
import { isFormSubmit, isFormCancel, readFormDirty, validateResult, type FormSpec } from "@omni/forms-dsl";
import { useDebugBridge } from "./lib/debug-bridge";
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

  // Whether the open form has unsaved input — reported by the form app (the host
  // can't see inside the cross-origin iframe). Drives the confirm-on-cancel.
  const formDirtyRef = useRef(false);
  // Summon a panel for a fresh tool call; the new form starts clean so a stale
  // dirty flag from a previous form can't trigger a spurious discard prompt.
  const summonPanel = useCallback((info: ToolCallInfo) => {
    formDirtyRef.current = false;
    setActivation(info);
  }, []);

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
        summonPanel(info);
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
    formDirtyRef.current = false;
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

  const setAssistantError = useCallback((msg: string) => {
    setMessages((m) => {
      const next = m.slice();
      const last = next[next.length - 1];
      if (last?.kind === "msg" && last.role === "assistant" && !last.content) {
        next[next.length - 1] = { ...last, content: `⚠️ ${msg}` };
      }
      return next;
    });
  }, []);

  /** Run one user turn for `text`. Returns the conversation id it ran against. */
  const runUserTurn = useCallback(
    async (text: string): Promise<number | null> => {
      if (!text || busy) return null;
      if (!apiKey) { setConnError("Enter your OpenRouter API key first."); return null; }
      if (!model) { setConnError("Pick a model first."); return null; }
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
      setBusy(true);

      const tools = server ? buildMcpTools(server, summonPanel) : [];
      const state = conversationStateAccessor(convId);
      try {
        await runTurn({ apiKey, model, userText: text, state, tools, onTextDelta: appendDeltaToLastAssistant });
        // Reconcile with persisted state (surfaces tool cards). The panel, if a
        // form paused, was already opened by onAutoSummon mid-turn.
        setMessages(displayItemsFromState(await getConversationState(convId)));
      } catch (e) {
        setAssistantError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
        await touchConversation(convId);
        void refreshConversations();
      }
      return convId;
    },
    [busy, apiKey, model, conversationId, server, appendDeltaToLastAssistant, setAssistantError, refreshConversations],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await runUserTurn(text);
  }, [input, runUserTurn]);

  /**
   * Feed an output back to the pending HITL call and resume. `build` derives the
   * output + the form_events log from the pending call. Shared by submit/cancel.
   */
  const resumePendingCall = useCallback(
    async (
      build: (pending: { callId: string; name: string; args: Record<string, unknown> }) => {
        output: unknown;
        log: Parameters<typeof logFormEvent>[0];
      } | null,
    ): Promise<number | null> => {
      const convId = conversationId;
      if (convId == null || busy) return null;
      const pending = pendingHitlCall(await getConversationState(convId));
      if (!pending) return null;

      const built = build(pending);
      if (!built) return null;
      void logFormEvent(built.log);

      setActivation(null);
      setBusy(true);
      setMessages((m) => [...m, { kind: "msg", role: "assistant", content: "" }]);

      const accessor = conversationStateAccessor(convId);
      const tools = server ? buildMcpTools(server, summonPanel) : [];
      try {
        await resumeTurn({ apiKey, model, callId: pending.callId, output: built.output, state: accessor, tools, onTextDelta: appendDeltaToLastAssistant });
        setMessages(displayItemsFromState(await getConversationState(convId)));
      } catch (e) {
        setAssistantError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
        await touchConversation(convId);
        void refreshConversations();
      }
      return convId;
    },
    [conversationId, busy, server, apiKey, model, appendDeltaToLastAssistant, setAssistantError, refreshConversations],
  );

  /** Validate the submitted values host-side (untrusted iframe) and resume. */
  const resolvePendingForm = useCallback(
    (values: Record<string, unknown>) =>
      resumePendingCall((pending) => {
        const spec = pending.args as unknown as FormSpec;
        const check = validateResult(spec, values);
        return {
          output: check.ok ? check.cleaned : { error: "invalid_result", issues: check.issues },
          log: { conversationId, toolName: pending.name, spec, specValid: true, issues: check.ok ? undefined : check.issues, result: values, status: "submitted" },
        };
      }),
    [resumePendingCall, conversationId],
  );

  /** Resolve the pending form as cancelled so the agent unblocks. */
  const cancelPendingForm = useCallback(
    () =>
      resumePendingCall((pending) => ({
        output: { cancelled: true, reason: "The user dismissed the form without submitting." },
        log: { conversationId, toolName: pending.name, spec: pending.args, specValid: true, status: "cancelled" },
      })),
    [resumePendingCall, conversationId],
  );

  /** Cancel, confirming first only if the user has entered something. */
  const requestCancel = useCallback(() => {
    if (formDirtyRef.current) {
      Modal.confirm({
        title: "Discard your answers?",
        content: "The form will be cancelled and what you've entered cleared.",
        okText: "Discard",
        okType: "danger",
        cancelText: "Keep editing",
        onOk: () => void cancelPendingForm(),
      });
    } else {
      void cancelPendingForm();
    }
  }, [cancelPendingForm]);

  // The form app pushes submit / cancel / dirty signals here (updateModelContext).
  const onAppContext = useCallback(
    async (ctx: ModelContext | null) => {
      const sc = ctx?.structuredContent;
      if (isFormSubmit(sc)) return void resolvePendingForm(sc.values as Record<string, unknown>);
      if (isFormCancel(sc)) return requestCancel();
      const dirty = readFormDirty(sc);
      if (dirty !== null) formDirtyRef.current = dirty;
    },
    [resolvePendingForm, requestCancel],
  );

  // Closing the pane on a pending form cancels it (same as the form's Cancel);
  // otherwise it just dismisses a display-only app panel.
  const onPaneClose = useCallback(async () => {
    const st = conversationId != null ? await getConversationState(conversationId) : null;
    if (pendingHitlCall(st)) requestCancel();
    else setActivation(null);
  }, [conversationId, requestCancel]);

  // Local debug bridge: lets an agent drive/inspect this app over HTTP. See
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
    openform: async (spec) => {
      if (busy) return { error: "busy" };
      if (!apiKey || !model || !server) return { error: "need apiKey + model + connected server" };
      const convId = conversationId ?? (await createConversation(`form: ${(spec as { title?: string })?.title ?? "untitled"}`));
      if (conversationId == null) setConversationId(convId);
      setBusy(true);
      setMessages((m) => [...m, { kind: "msg", role: "assistant", content: "" }]);
      const accessor = conversationStateAccessor(convId);
      const tools = buildMcpTools(server, summonPanel);
      try {
        await openForm({ apiKey, model, spec, state: accessor, tools, onTextDelta: appendDeltaToLastAssistant });
        setMessages(displayItemsFromState(await getConversationState(convId)));
      } catch (e) {
        setAssistantError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
        await touchConversation(convId);
        void refreshConversations();
      }
      const st = await getConversationState(convId);
      return { conversationId: convId, pending: pendingHitlCall(st), items: displayItemsFromState(st) };
    },
    send: async (text) => {
      const convId = await runUserTurn(text);
      const st = convId != null ? await getConversationState(convId) : null;
      return { conversationId: convId, pending: pendingHitlCall(st), items: displayItemsFromState(st) };
    },
    submit: async (values) => {
      const convId = await resolvePendingForm(values);
      const st = convId != null ? await getConversationState(convId) : null;
      return { resolved: convId != null, pending: pendingHitlCall(st), items: displayItemsFromState(st) };
    },
    cancel: async () => {
      const convId = await cancelPendingForm();
      const st = convId != null ? await getConversationState(convId) : null;
      return { cancelled: convId != null, pending: pendingHitlCall(st), items: displayItemsFromState(st) };
    },
    state: async () => {
      const st = conversationId != null ? await getConversationState(conversationId) : null;
      return { conversationId, busy, connected: !!server, formDirty: formDirtyRef.current, pending: pendingHitlCall(st), items: displayItemsFromState(st) };
    },
  });

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
                  {m.status === "cancelled" && "· cancelled"}
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
