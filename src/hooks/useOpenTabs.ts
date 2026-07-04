/**
 * Open-tab state backed by the `tabs` table. Each tab row maps 1:1 to a mounted
 * ChatSession; the tab's DB id is the React key so the bar survives restarts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TabInfo } from "../components/TabBar";
import type { SessionMeta } from "../components/ChatSession";
import type { ConversationRow } from "../lib/db";
import {
  createTab,
  deleteTab,
  getActiveTabId,
  listConversations,
  listTabs,
  setActiveTabId,
  updateTabConversation,
} from "../lib/db";

export interface OpenTab {
  /** DB primary key — also the React/TabBar key (`String(id)`). */
  id: number;
  initialConversationId: number | null;
  initialWorkingDir?: string | null;
}

function folderName(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function rowToTab(r: { id: number; conversation_id: number | null; working_dir: string | null }): OpenTab {
  return {
    id: r.id,
    initialConversationId: r.conversation_id,
    initialWorkingDir: r.working_dir,
  };
}

export function useOpenTabs(conversations: ConversationRow[]) {
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeKey, setActiveKeyState] = useState("");
  const [meta, setMeta] = useState<Record<string, SessionMeta>>({});
  const [ready, setReady] = useState(false);
  const activeKeyRef = useRef(activeKey);
  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  // Restore open tabs from the DB once on mount.
  useEffect(() => {
    (async () => {
      let rows = await listTabs();
      if (rows.length === 0) {
        const convs = await listConversations();
        await createTab(convs[0]?.id ?? null, null);
        rows = await listTabs();
      }
      const restored = rows.map(rowToTab);
      setTabs(restored);
      const savedActive = await getActiveTabId();
      const keys = new Set(restored.map((t) => String(t.id)));
      const pick =
        savedActive != null && keys.has(String(savedActive))
          ? String(savedActive)
          : String(restored[0].id);
      setActiveKeyState(pick);
      setReady(true);
    })();
  }, []);

  const setActiveKey = useCallback((key: string) => {
    setActiveKeyState(key);
    void setActiveTabId(Number(key));
  }, []);

  const handleMeta = useCallback((key: string, m: SessionMeta) => {
    setMeta((prev) => {
      const cur = prev[key];
      if (
        cur &&
        cur.conversationId === m.conversationId &&
        cur.workingDir === m.workingDir &&
        cur.codeMode === m.codeMode &&
        cur.busy === m.busy &&
        cur.folderMissing === m.folderMissing
      ) {
        return prev;
      }
      return { ...prev, [key]: m };
    });
    if (m.conversationId != null) {
      void updateTabConversation(Number(key), m.conversationId);
    }
  }, []);

  const convIdOfTab = useCallback(
    (t: OpenTab) => meta[String(t.id)]?.conversationId ?? t.initialConversationId,
    [meta],
  );

  const newBlankTab = useCallback(async () => {
    const id = await createTab(null, null);
    const tab: OpenTab = { id, initialConversationId: null };
    setTabs((prev) => [...prev, tab]);
    setActiveKey(String(id));
    return id;
  }, [setActiveKey]);

  const newChatInProject = useCallback(
    async (dir: string) => {
      const id = await createTab(null, dir);
      const tab: OpenTab = { id, initialConversationId: null, initialWorkingDir: dir };
      setTabs((prev) => [...prev, tab]);
      setActiveKey(String(id));
      return id;
    },
    [setActiveKey],
  );

  const closeTabs = useCallback(
    async (keys: string[]) => {
      if (keys.length === 0) return;
      const kill = new Set(keys);
      setMeta((m) => {
        const c = { ...m };
        keys.forEach((k) => delete c[k]);
        return c;
      });
      await Promise.all(keys.map((k) => deleteTab(Number(k))));
      const next = tabs.filter((t) => !kill.has(String(t.id)));
      if (next.length === 0) {
        const id = await createTab(null, null);
        const tab: OpenTab = { id, initialConversationId: null };
        setTabs([tab]);
        setActiveKey(String(id));
        return;
      }
      setTabs(next);
      if (kill.has(activeKey)) {
        const idx = tabs.findIndex((t) => String(t.id) === activeKey);
        const neighbor = next[Math.min(idx, next.length - 1)] ?? next[0];
        setActiveKey(String(neighbor.id));
      }
    },
    [tabs, activeKey, setActiveKey],
  );

  const closeTab = useCallback((key: string) => void closeTabs([key]), [closeTabs]);

  const openConversation = useCallback(
    (id: number) => {
      const existing = tabs.find((t) => convIdOfTab(t) === id);
      if (existing) {
        setActiveKey(String(existing.id));
        return;
      }
      void (async () => {
        const tabId = await createTab(id, null);
        const tab: OpenTab = { id: tabId, initialConversationId: id };
        setTabs((prev) => [...prev, tab]);
        setActiveKey(String(tabId));
      })();
    },
    [tabs, convIdOfTab, setActiveKey],
  );

  const removeConversation = useCallback(
    async (id: number, deleteConversation: (id: number) => Promise<void>, refresh: () => Promise<void>) => {
      await deleteConversation(id);
      const doomed = tabs.filter((t) => convIdOfTab(t) === id).map((t) => String(t.id));
      await closeTabs(doomed);
      await refresh();
    },
    [tabs, convIdOfTab, closeTabs],
  );

  const tabInfos = useMemo<TabInfo[]>(
    () =>
      tabs.map((t) => {
        const key = String(t.id);
        const m = meta[key];
        const convId = m?.conversationId ?? t.initialConversationId;
        const wd = m?.workingDir ?? t.initialWorkingDir ?? null;
        const label = wd
          ? folderName(wd)
          : convId != null
            ? conversations.find((c) => c.id === convId)?.title || `Chat ${convId}`
            : "New chat";
        return { key, label, code: !!wd, busy: !!m?.busy, folderMissing: !!m?.folderMissing };
      }),
    [tabs, meta, conversations],
  );

  const activeConvId = useMemo(() => {
    const t = tabs.find((x) => String(x.id) === activeKey);
    return t ? convIdOfTab(t) : null;
  }, [tabs, activeKey, convIdOfTab]);

  return {
    tabs,
    activeKey,
    activeKeyRef,
    meta,
    ready,
    tabInfos,
    activeConvId,
    setActiveKey,
    handleMeta,
    newBlankTab,
    newChatInProject,
    openConversation,
    closeTab,
    closeTabs,
    removeConversation,
  };
}
