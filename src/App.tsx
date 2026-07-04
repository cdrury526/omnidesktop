import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebugBridge } from "./lib/debug-bridge";
import { installErrorCapture } from "./lib/events";
import { SideRail, type RailSection } from "./components/SideRail";
import { HistoryPanel } from "./components/panels/HistoryPanel";
import { ProjectsPanel } from "./components/panels/ProjectsPanel";
import { SettingsPanel } from "./components/panels/SettingsPanel";
import { ToolsPanel } from "./components/panels/ToolsPanel";
import { TabBar } from "./components/TabBar";
import { ChatSession, type BridgeHandlers } from "./components/ChatSession";
import { useOpenTabs } from "./hooks/useOpenTabs";
import { useSplitView } from "./hooks/useSplitView";
import { useMcpConnection } from "./hooks/useMcpConnection";
import { getApiKey, saveApiKey, deleteApiKey } from "./lib/secrets";
import {
  getSetting,
  setSetting,
  listConversations,
  deleteConversation,
  renameConversation,
  setToolEnabled,
  toolEnabledMap,
  type ConversationRow,
  type ToolRegistryRow,
} from "./lib/db";
import { loadActiveToolRegistry, syncToolRegistry } from "./lib/tool-registry";
import { getToolUsageReport } from "./lib/tool-usage";
import { Button, Flex, Splitter, Typography } from "antd";
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
  const [toolRegistry, setToolRegistry] = useState<ToolRegistryRow[]>([]);
  const [railSection, setRailSection] = useState<RailSection | null>(null);

  const refreshConversations = useCallback(async () => {
    setConversations(await listConversations());
  }, []);

  const refreshToolRegistry = useCallback(async () => {
    setToolRegistry(await loadActiveToolRegistry(server?.url ?? null));
  }, [server?.url]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    void refreshToolRegistry();
  }, [refreshToolRegistry]);

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

  const toolPolicies = useMemo(() => toolEnabledMap(toolRegistry), [toolRegistry]);

  const syncKnownTools = useCallback(async () => {
    await syncToolRegistry(server);
    setToolRegistry(await loadActiveToolRegistry(server?.url ?? null));
  }, [server]);

  useEffect(() => {
    void syncKnownTools();
  }, [syncKnownTools]);

  const toggleTool = useCallback(
    async (tool: ToolRegistryRow, enabled: boolean) => {
      await setToolEnabled(tool.source, tool.source_id, tool.name, enabled);
      setToolRegistry((rows) =>
        rows.map((r) => (r.id === tool.id ? { ...r, enabled: enabled ? 1 : 0 } : r)),
      );
    },
    [],
  );

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

  const renameConversationTitle = useCallback(
    async (id: number, title: string) => {
      await renameConversation(id, title);
      await refreshConversations();
    },
    [refreshConversations],
  );

  const activeHandlers = () => bridgeRef.current.get(focusKeyRef.current);
  useDebugBridge({
    connect: async (url) => {
      const info = await connectFromBridge(url);
      if (!info) return { error: "connect failed" };
      return { name: info.name, tools: [...info.tools.keys()] };
    },
    newchat: async () => {
      const tabId = await newBlankTab();
      return { ok: true, tabId };
    },
    projectchat: async ({ workingDir, model: nextModel }) => {
      if (!workingDir) return { error: "workingDir is required" };
      if (nextModel) onModelChange(nextModel);
      const tabId = await newChatInProject(workingDir);
      return { ok: true, tabId, workingDir, model: nextModel ?? model };
    },
    setmodel: async (nextModel) => {
      if (!nextModel) return { error: "model is required" };
      onModelChange(nextModel);
      return { ok: true, model: nextModel };
    },
    codemode: async (params) => (await activeHandlers()?.codemode(params)) ?? { error: "no active session" },
    openform: async (spec) => (await activeHandlers()?.openform(spec)) ?? { error: "no active session" },
    send: async (text) => (await activeHandlers()?.send(text)) ?? { error: "no active session" },
    submit: async (values) => (await activeHandlers()?.submit(values)) ?? { error: "no active session" },
    cancel: async () => (await activeHandlers()?.cancel()) ?? { error: "no active session" },
    approve: async (callIds) => (await activeHandlers()?.approve(callIds)) ?? { error: "no active session" },
    reject: async (callIds) => (await activeHandlers()?.reject(callIds)) ?? { error: "no active session" },
    state: async () => (await activeHandlers()?.state()) ?? { error: "no active session" },
    toolusage: async (params) => getToolUsageReport(params),
  });

  const toolCount = server ? server.tools.size : 0;

  if (!ready) {
    return null;
  }

  const renderSession = (t: (typeof tabs)[number]) => {
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
        toolPolicies={toolPolicies}
        onConversationsChanged={refreshConversations}
        initialConversationId={t.initialConversationId}
        initialWorkingDir={t.initialWorkingDir}
        onMeta={handleMeta}
        registerBridge={registerBridge}
      />
    );
  };

  const primaryTab = split.isSplit
    ? tabs.find((t) => String(t.id) === split.layout.primaryKey)
    : null;
  const secondaryTab = split.isSplit
    ? tabs.find((t) => String(t.id) === split.layout.secondaryKey)
    : null;
  const hiddenSplitTabs = split.isSplit
    ? tabs.filter((t) => {
        const key = String(t.id);
        return key !== split.layout.primaryKey && key !== split.layout.secondaryKey;
      })
    : [];

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
              onRename={renameConversationTitle}
              onDelete={removeConversation}
            />
          )}
          {railSection === "projects" && (
            <ProjectsPanel
              conversations={conversations}
              activeId={highlightedConvId}
              onSelect={handleOpenConversation}
              onRename={renameConversationTitle}
              onDelete={removeConversation}
              onNewInProject={(dir) => void newChatInProject(dir)}
            />
          )}
          {railSection === "tools" && (
            <ToolsPanel tools={toolRegistry} onToggle={(tool, enabled) => void toggleTool(tool, enabled)} />
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
          {split.isSplit && primaryTab && secondaryTab ? (
            <>
              <Splitter
                className="workspace-splitter"
                onResize={split.onResize}
                onResizeEnd={split.onResizeEnd}
              >
                <Splitter.Panel size={split.splitSizes[0]} min={280}>
                  <div className="split-pane-content">{renderSession(primaryTab)}</div>
                </Splitter.Panel>
                <Splitter.Panel size={split.splitSizes[1]} min={280}>
                  <div className="split-pane-content">{renderSession(secondaryTab)}</div>
                </Splitter.Panel>
              </Splitter>
              <div className="session-hidden-stage" aria-hidden>
                {hiddenSplitTabs.map(renderSession)}
              </div>
            </>
          ) : (
            tabs.map(renderSession)
          )}
        </div>
      </main>
    </div>
  );
}
