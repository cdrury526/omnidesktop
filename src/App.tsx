import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebugBridge } from "./lib/debug-bridge";
import { installErrorCapture } from "./lib/events";
import { SideRail, type RailSection } from "./components/SideRail";
import { HistoryPanel } from "./components/panels/HistoryPanel";
import { ProjectsPanel } from "./components/panels/ProjectsPanel";
import { SettingsPanel } from "./components/panels/SettingsPanel";
import { TabBar } from "./components/TabBar";
import { ChatSession, type BridgeHandlers } from "./components/ChatSession";
import { useOpenTabs } from "./hooks/useOpenTabs";
import { useSplitView } from "./hooks/useSplitView";
import { useMcpConnection } from "./hooks/useMcpConnection";
import { getApiKey, saveApiKey, deleteApiKey } from "./lib/secrets";
import { getSetting, setSetting, listConversations, deleteConversation, type ConversationRow } from "./lib/db";
import { Button, Flex, Typography } from "antd";
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

export default function App() {
  const {
    serverUrl,
    setServerUrl,
    server,
    connecting,
    connectError,
    serverOptions,
    connect,
    connectFromBridge,
  } = useMcpConnection();

  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<"loading" | "stored" | "unsaved" | "empty">("loading");
  const [model, setModel] = useState("");

  useEffect(() => {
    installErrorCapture();
  }, []);

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

  useEffect(() => {
    getSetting("model").then((m) => m && setModel(m));
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
  const [railSection, setRailSection] = useState<RailSection | null>(null);

  const refreshConversations = useCallback(async () => {
    setConversations(await listConversations());
  }, []);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  const {
    tabs,
    activeKey,
    meta,
    ready,
    tabInfos,
    setActiveKey,
    handleMeta,
    newBlankTab,
    newChatInProject,
    openConversation,
    closeTab,
    removeConversation: removeConversationFromTabs,
  } = useOpenTabs(conversations);

  const tabKeys = useMemo(() => tabs.map((t) => String(t.id)), [tabs]);

  const split = useSplitView({ activeKey, setActiveKey, tabKeys });

  const focusKeyRef = useRef(split.focusKey);
  useEffect(() => {
    focusKeyRef.current = split.focusKey;
  }, [split.focusKey]);

  const splitCandidateItems = useMemo(
    () =>
      tabInfos
        .filter((t) => split.splitCandidates.includes(t.key))
        .map((t) => ({ key: t.key, label: t.label })),
    [tabInfos, split.splitCandidates],
  );

  const highlightedConvId = useMemo(() => {
    const t = tabs.find((x) => String(x.id) === split.focusKey);
    if (!t) return null;
    const key = String(t.id);
    return meta[key]?.conversationId ?? t.initialConversationId ?? null;
  }, [tabs, split.focusKey, meta]);

  const handleCloseTab = useCallback(
    (key: string) => {
      split.onTabClosed(key);
      closeTab(key);
    },
    [split, closeTab],
  );

  const handleOpenConversation = useCallback(
    (id: number) => {
      if (split.isSplit) split.exitSplit();
      openConversation(id);
    },
    [split, openConversation],
  );

  const toggleRail = useCallback((section: RailSection) => {
    setRailSection((cur) => (cur === section ? null : section));
  }, []);

  const bridgeRef = useRef<Map<string, BridgeHandlers>>(new Map());
  const registerBridge = useCallback((key: string, handlers: BridgeHandlers | null) => {
    if (handlers) bridgeRef.current.set(key, handlers);
    else bridgeRef.current.delete(key);
  }, []);

  const removeConversation = useCallback(
    async (id: number) => {
      await removeConversationFromTabs(id, deleteConversation, refreshConversations);
    },
    [removeConversationFromTabs, refreshConversations],
  );

  const activeHandlers = () => bridgeRef.current.get(focusKeyRef.current);
  useDebugBridge({
    connect: async (url) => {
      const info = await connectFromBridge(url);
      if (!info) return { error: "connect failed" };
      return { name: info.name, tools: [...info.tools.keys()] };
    },
    newchat: async () => {
      await newBlankTab();
      return { ok: true };
    },
    openform: async (spec) => (await activeHandlers()?.openform(spec)) ?? { error: "no active session" },
    send: async (text) => (await activeHandlers()?.send(text)) ?? { error: "no active session" },
    submit: async (values) => (await activeHandlers()?.submit(values)) ?? { error: "no active session" },
    cancel: async () => (await activeHandlers()?.cancel()) ?? { error: "no active session" },
    state: async () => (await activeHandlers()?.state()) ?? { error: "no active session" },
  });

  const toolCount = server ? server.tools.size : 0;

  if (!ready) {
    return null;
  }

  return (
    <div className="layout">
      <SideRail
        active={railSection}
        onSelect={toggleRail}
        badges={{ settings: keyStatus === "empty" || keyStatus === "unsaved" }}
      />

      {railSection && (
        <aside className="rail-panel">
          <Flex className="rail-panel-header" align="center" justify="space-between">
            <Typography.Title level={5} style={{ margin: 0 }}>
              {RAIL_TITLES[railSection]}
            </Typography.Title>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setRailSection(null)}
              aria-label="Close panel"
            />
          </Flex>
          {railSection === "history" && (
            <HistoryPanel
              conversations={conversations}
              activeId={highlightedConvId}
              onSelect={handleOpenConversation}
              onDelete={removeConversation}
            />
          )}
          {railSection === "projects" && (
            <ProjectsPanel
              conversations={conversations}
              activeId={highlightedConvId}
              onSelect={handleOpenConversation}
              onDelete={removeConversation}
              onNewInProject={(dir) => void newChatInProject(dir)}
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
            <Button type="primary" ghost icon={<PlusOutlined />} onClick={() => void newBlankTab()}>
              New chat
            </Button>
          </div>
        </header>

        <TabBar
          tabs={tabInfos}
          activeKey={split.focusKey}
          splitSecondaryKey={split.isSplit ? split.layout.secondaryKey : null}
          isSplit={split.isSplit}
          splitCandidates={splitCandidateItems}
          onSelect={split.onTabSelect}
          onClose={handleCloseTab}
          onAdd={() => void newBlankTab()}
          onEnterSplit={split.enterSplit}
          onExitSplit={() => split.exitSplit()}
        />

        <div className={`sessions${split.isSplit ? " is-split" : ""}`}>
          {split.isSplit && <div className="split-gutter" aria-hidden />}
          {tabs.map((t) => {
            const key = String(t.id);
            return (
              <ChatSession
                key={t.id}
                tabKey={key}
                visible={split.isVisible(key)}
                focused={split.focusKey === key}
                splitRole={split.splitRole(key)}
                onFocusPane={() => split.setFocusKey(key)}
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
            );
          })}
        </div>
      </main>
    </div>
  );
}
