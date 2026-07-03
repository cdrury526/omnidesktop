/**
 * Split-workspace layout: show two open tabs side-by-side while every tab
 * stays mounted (background streaming unchanged). `focusKey` is the pane that
 * receives keyboard/debug-bridge input; in single mode it tracks `activeKey`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSetting, setSetting } from "../lib/db";

const SPLIT_RATIO_SETTING = "split_ratio";
const DEFAULT_SPLIT_SIZES: [string, string] = ["50%", "50%"];
const MIN_RATIO = 20;
const MAX_RATIO = 80;

function clampRatio(n: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, Math.round(n)));
}

function sizesFromRatio(ratio: number): [string, string] {
  const first = clampRatio(ratio);
  return [`${first}%`, `${100 - first}%`];
}

function ratioFromSizes(sizes: (number | string)[]): number | null {
  const nums = sizes.map((s) => {
    if (typeof s === "number") return s;
    if (s.endsWith("%")) return Number.parseFloat(s);
    return Number.parseFloat(s);
  });
  if (nums.length < 2 || !Number.isFinite(nums[0]) || !Number.isFinite(nums[1])) return null;
  const total = nums[0] + nums[1];
  if (total <= 0) return null;
  return clampRatio((nums[0] / total) * 100);
}

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
  const [splitSizes, setSplitSizes] = useState<(number | string)[]>(DEFAULT_SPLIT_SIZES);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await getSetting(SPLIT_RATIO_SETTING);
      const ratio = raw == null ? null : Number(raw);
      if (!cancelled && ratio != null && Number.isFinite(ratio)) {
        setSplitSizes(sizesFromRatio(ratio));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const onResize = useCallback((sizes: (number | string)[]) => {
    setSplitSizes(sizes);
  }, []);

  const onResizeEnd = useCallback((sizes: (number | string)[]) => {
    setSplitSizes(sizes);
    const ratio = ratioFromSizes(sizes);
    if (ratio != null) void setSetting(SPLIT_RATIO_SETTING, String(ratio));
  }, []);

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
    splitSizes,
    onResize,
    onResizeEnd,
  };
}
