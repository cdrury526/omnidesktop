import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { connectToServer, type ServerInfo } from "./mcp/host-bridge";
import { useDebugBridge } from "./lib/debug-bridge";
import { logEvent, installErrorCapture } from "./lib/events";
import { SideRail, type RailSection } from "./components/SideRail";
import { HistoryPanel } from "./components/panels/HistoryPanel";
import { ProjectsPanel } from "./components/panels/ProjectsPanel";
import { SettingsPanel } from "./components/panels/SettingsPanel";
import { TabBar, type TabInfo } from "./components/TabBar";
import { ChatSession, type SessionMeta, type BridgeHandlers } from "./components/ChatSession";
import { getApiKey, saveApiKey, deleteApiKey } from "./lib/secrets";
import {
  getSetting,
  setSetting,
  upsertMcpServer,
  listMcpServers,
  listConversations,
  deleteConversation,
  type ConversationRow,
} from "./lib/db";
import { Button } from "antd";
import { CloseOutlined, PlusOutlined } from "@ant-design/icons";
import "./App.css";

const RAIL_TITLES: Record<RailSection, string> = {
  history: "History",
  projects: "Projects",
  tools: "Tools",
  agents: "Agents",
  commands: "Commands",
  settings: "Settings",
};

const DEFAULT_SERVER = "http://localhost:3001/mcp";

/** One open tab: a mounted ChatSession. The live conversation id lives inside
 * the session and is reported back via `meta`; here we hold only what's needed
 * to mount it (the conversation to open, or a folder for a new project chat). */
interface Tab {
  key: string;
  initialConversationId: number | null;
  initialWorkingDir?: string | null;
}

/** Last path segment — the folder's own name, for a code tab's label. */
function folderName(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export default function App() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

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

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  // The rail section whose panel is open (null = collapsed to icons only).
  const [railSection, setRailSection] = useState<RailSection | null>(null);

  const refreshConversations = useCallback(async () => {
    setConversations(await listConversations());
  }, []);

  // ---- open tabs (each is a live ChatSession) ----
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeKey, setActiveKey] = useState("");
  const [meta, setMeta] = useState<Record<string, SessionMeta>>({});
  const tabSeq = useRef(0);
  const nextKey = () => `t${++tabSeq.current}`;

  // The active tab, readable from the stable bridge dispatchers.
  const activeKeyRef = useRef(activeKey);
  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  const toggleRail = useCallback((section: RailSection) => {
    setRailSection((cur) => (cur === section ? null : section));
  }, []);

  // Restore the most recent conversation as the first tab on mount.
  useEffect(() => {
    (async () => {
      const convs = await listConversations();
      setConversations(convs);
      const key = nextKey();
      setTabs([{ key, initialConversationId: convs[0]?.id ?? null }]);
      setActiveKey(key);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A session reports its conversation id / code mode / busy for the tab label. */
  const handleMeta = useCallback((key: string, m: SessionMeta) => {
    setMeta((prev) => {
      const cur = prev[key];
      if (cur && cur.conversationId === m.conversationId && cur.workingDir === m.workingDir && cur.codeMode === m.codeMode && cur.busy === m.busy) {
        return prev;
      }
      return { ...prev, [key]: m };
    });
  }, []);

  // Bridge handlers per session; the debug bridge dispatches to the focused tab.
  const bridgeRef = useRef<Map<string, BridgeHandlers>>(new Map());
  const registerBridge = useCallback((key: string, handlers: BridgeHandlers | null) => {
    if (handlers) bridgeRef.current.set(key, handlers);
    else bridgeRef.current.delete(key);
  }, []);

  const newBlankTab = useCallback(() => {
    const key = nextKey();
    setTabs((prev) => [...prev, { key, initialConversationId: null }]);
    setActiveKey(key);
  }, []);

  const newChatInProject = useCallback((dir: string) => {
    const key = nextKey();
    setTabs((prev) => [...prev, { key, initialConversationId: null, initialWorkingDir: dir }]);
    setActiveKey(key);
  }, []);

  const convIdOfTab = useCallback(
    (t: Tab) => meta[t.key]?.conversationId ?? t.initialConversationId,
    [meta],
  );

  /** Open a conversation: focus its tab if already open, else open a new one. */
  const openConversation = useCallback(
    (id: number) => {
      const existing = tabs.find((t) => convIdOfTab(t) === id);
      if (existing) {
        setActiveKey(existing.key);
        return;
      }
      const key = nextKey();
      setTabs((prev) => [...prev, { key, initialConversationId: id }]);
      setActiveKey(key);
    },
    [tabs, convIdOfTab],
  );

  /** Close a set of tabs, picking a sensible new active and never leaving zero. */
  const closeTabs = useCallback(
    (keys: string[]) => {
      if (keys.length === 0) return;
      const kill = new Set(keys);
      setMeta((m) => {
        const c = { ...m };
        keys.forEach((k) => delete c[k]);
        return c;
      });
      const next = tabs.filter((t) => !kill.has(t.key));
      if (next.length === 0) {
        const k = nextKey();
        setTabs([{ key: k, initialConversationId: null }]);
        setActiveKey(k);
        return;
      }
      setTabs(next);
      if (kill.has(activeKey)) {
        const idx = tabs.findIndex((t) => t.key === activeKey);
        const neighbor = next[Math.min(idx, next.length - 1)] ?? next[0];
        setActiveKey(neighbor.key);
      }
    },
    [tabs, activeKey],
  );

  const closeTab = useCallback((key: string) => closeTabs([key]), [closeTabs]);

  const removeConversation = useCallback(
    async (id: number) => {
      await deleteConversation(id);
      const doomed = tabs.filter((t) => convIdOfTab(t) === id).map((t) => t.key);
      closeTabs(doomed);
      await refreshConversations();
    },
    [tabs, convIdOfTab, closeTabs, refreshConversations],
  );

  const connect = useCallback(async () => {
    const url = serverUrl.trim();
    if (!url) {
      setConnectError("Enter an MCP server URL (e.g. http://localhost:3001/mcp).");
      return;
    }
    setConnecting(true);
    setConnectError(null);
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
      setConnectError(msg);
      logEvent({ source: "user", type: "connect.error", data: { url, error: msg } });
    } finally {
      setConnecting(false);
    }
  }, [serverUrl]);

  // Local debug bridge: connect/newchat are app-level; chat actions dispatch to
  // the focused tab's registered handlers. See src/lib/debug-bridge.ts.
  const activeHandlers = () => bridgeRef.current.get(activeKeyRef.current);
  useDebugBridge({
    connect: async (url) => {
      const info = await connectToServer(new URL(url));
      setServer(info);
      void setSetting("server_url", url);
      return { name: info.name, tools: [...info.tools.keys()] };
    },
    newchat: async () => {
      newBlankTab();
      return { ok: true };
    },
    openform: async (spec) => (await activeHandlers()?.openform(spec)) ?? { error: "no active session" },
    send: async (text) => (await activeHandlers()?.send(text)) ?? { error: "no active session" },
    submit: async (values) => (await activeHandlers()?.submit(values)) ?? { error: "no active session" },
    cancel: async () => (await activeHandlers()?.cancel()) ?? { error: "no active session" },
    state: async () => (await activeHandlers()?.state()) ?? { error: "no active session" },
  });

  const toolCount = server ? server.tools.size : 0;
  const activeConvId = useMemo(() => {
    const t = tabs.find((x) => x.key === activeKey);
    return t ? convIdOfTab(t) : null;
  }, [tabs, activeKey, convIdOfTab]);

  // Tab labels: a code tab shows its folder name; a plain chat its title.
  const tabInfos = useMemo<TabInfo[]>(
    () =>
      tabs.map((t) => {
        const m = meta[t.key];
        const convId = m?.conversationId ?? t.initialConversationId;
        const wd = m?.workingDir ?? t.initialWorkingDir ?? null;
        const label = wd
          ? folderName(wd)
          : convId != null
            ? conversations.find((c) => c.id === convId)?.title || `Chat ${convId}`
            : "New chat";
        return { key: t.key, label, code: !!wd, busy: !!m?.busy };
      }),
    [tabs, meta, conversations],
  );

  return (
    <div className="layout">
      <SideRail
        active={railSection}
        onSelect={toggleRail}
        badges={{ settings: !apiKey || !server }}
      />

      {railSection && (
        <aside className="rail-panel">
          <header className="panel-header">
            <span className="panel-title">{RAIL_TITLES[railSection]}</span>
            <Button
              className="panel-close"
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setRailSection(null)}
              aria-label="Close panel"
            />
          </header>
          {railSection === "history" && (
            <HistoryPanel
              conversations={conversations}
              activeId={activeConvId}
              onSelect={openConversation}
              onDelete={removeConversation}
            />
          )}
          {railSection === "projects" && (
            <ProjectsPanel
              conversations={conversations}
              activeId={activeConvId}
              onSelect={openConversation}
              onDelete={removeConversation}
              onNewInProject={newChatInProject}
            />
          )}
          {railSection === "settings" && (
            <SettingsPanel
              apiKey={apiKey}
              keyStatus={keyStatus}
              onApiKeyChange={(k) => {
                setApiKey(k);
                setKeyStatus("unsaved");
              }}
              onApiKeyBlur={persistKey}
              serverUrl={serverUrl}
              serverOptions={serverOptions}
              onServerUrlChange={setServerUrl}
              onConnect={connect}
              connecting={connecting}
              serverName={server?.name ?? null}
              toolCount={toolCount}
              connectError={connectError}
            />
          )}
        </aside>
      )}

      <main className="workspace">
        <header className="chat-header">
          <h1>Omni Desktop</h1>
          <div className="header-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={newBlankTab}>
              New chat
            </Button>
          </div>
        </header>

        <TabBar
          tabs={tabInfos}
          activeKey={activeKey}
          onSelect={setActiveKey}
          onClose={closeTab}
          onAdd={newBlankTab}
        />

        <div className="sessions">
          {tabs.map((t) => (
            <ChatSession
              key={t.key}
              tabKey={t.key}
              active={t.key === activeKey}
              apiKey={apiKey}
              model={model}
              onModelChange={onModelChange}
              server={server}
              onConversationsChanged={refreshConversations}
              initialConversationId={t.initialConversationId}
              initialWorkingDir={t.initialWorkingDir}
              onMeta={handleMeta}
              registerBridge={registerBridge}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
