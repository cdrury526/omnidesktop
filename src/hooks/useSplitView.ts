/**
 * Split-workspace layout: show two open tabs side-by-side while every tab
 * stays mounted (background streaming unchanged). `focusKey` is the pane that
 * receives keyboard/debug-bridge input; in single mode it tracks `activeKey`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

export interface SplitLayout {
  mode: "single" | "split";
  /** Left pane tab key when split; focused tab in single mode. */
  primaryKey: string;
  /** Right pane tab key — only set in split mode. */
  secondaryKey: string | null;
  /** Pane targeted by bridge / primary interaction. */
  focusKey: string;
}

interface Args {
  activeKey: string;
  setActiveKey: (key: string) => void;
  tabKeys: string[];
}

export function useSplitView({ activeKey, setActiveKey, tabKeys }: Args) {
  const [layout, setLayout] = useState<SplitLayout>(() => ({
    mode: "single",
    primaryKey: activeKey,
    secondaryKey: null,
    focusKey: activeKey,
  }));

  // Keep primary/focus aligned when the shell picks a new active tab in single mode.
  useEffect(() => {
    if (!activeKey) return;
    setLayout((cur) => {
      if (cur.mode === "split") return cur;
      if (cur.primaryKey === activeKey && cur.focusKey === activeKey) return cur;
      return { mode: "single", primaryKey: activeKey, secondaryKey: null, focusKey: activeKey };
    });
  }, [activeKey]);

  const isSplit = layout.mode === "split";

  const isVisible = useCallback(
    (key: string) => {
      if (layout.mode === "single") return key === activeKey;
      return key === layout.primaryKey || key === layout.secondaryKey;
    },
    [layout, activeKey],
  );

  const splitRole = useCallback(
    (key: string): "primary" | "secondary" | null => {
      if (layout.mode !== "split") return null;
      if (key === layout.primaryKey) return "primary";
      if (key === layout.secondaryKey) return "secondary";
      return null;
    },
    [layout],
  );

  const setFocusKey = useCallback((key: string) => {
    setLayout((cur) => ({ ...cur, focusKey: key }));
  }, []);

  const enterSplit = useCallback(
    (secondaryKey?: string) => {
      const primary = activeKey || layout.primaryKey;
      if (!primary) return;
      const others = tabKeys.filter((k) => k !== primary);
      const secondary = secondaryKey ?? others[0];
      if (!secondary) return;
      setLayout({
        mode: "split",
        primaryKey: primary,
        secondaryKey: secondary,
        focusKey: primary,
      });
    },
    [activeKey, layout.primaryKey, tabKeys],
  );

  const exitSplit = useCallback(
    (focus?: string) => {
      const key = focus ?? layout.focusKey ?? layout.primaryKey ?? activeKey;
      setLayout({
        mode: "single",
        primaryKey: key,
        secondaryKey: null,
        focusKey: key,
      });
      setActiveKey(key);
    },
    [layout.focusKey, layout.primaryKey, activeKey, setActiveKey],
  );

  /** Tab strip click — focus an open split pane or leave split for a third tab. */
  const onTabSelect = useCallback(
    (key: string) => {
      if (layout.mode === "split") {
        if (key === layout.primaryKey || key === layout.secondaryKey) {
          setFocusKey(key);
          return;
        }
        exitSplit(key);
        return;
      }
      setActiveKey(key);
    },
    [layout, setFocusKey, exitSplit, setActiveKey],
  );

  /** When a tab closes, collapse split if it held a visible pane. */
  const onTabClosed = useCallback(
    (closedKey: string) => {
      if (layout.mode !== "split") return;
      if (closedKey !== layout.primaryKey && closedKey !== layout.secondaryKey) return;
      const survivor =
        closedKey === layout.primaryKey ? layout.secondaryKey : layout.primaryKey;
      if (survivor) exitSplit(survivor);
      else exitSplit(activeKey);
    },
    [layout, exitSplit, activeKey],
  );

  const splitCandidates = useMemo(
    () => tabKeys.filter((k) => k !== activeKey),
    [tabKeys, activeKey],
  );

  return {
    layout,
    isSplit,
    isVisible,
    splitRole,
    focusKey: layout.focusKey,
    setFocusKey,
    enterSplit,
    exitSplit,
    onTabSelect,
    onTabClosed,
    splitCandidates,
  };
}
