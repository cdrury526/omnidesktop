/**
 * The left icon rail — the app's primary navigation. Collapsed to icons by
 * default; clicking an icon opens that section's panel beside the rail (clicking
 * the active icon again closes it). History/Projects/Settings are live;
 * Tools/Agents/Commands are placeholders for future work (disabled, tooltipped).
 *
 * The rail is app chrome (it spans all sessions); the panels it opens are
 * rendered by App next to it.
 */
import { Tooltip } from "antd";
import {
  HistoryOutlined,
  FolderOutlined,
  ToolOutlined,
  RobotOutlined,
  CodeOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";

export type RailSection =
  | "history"
  | "projects"
  | "tools"
  | "agents"
  | "commands"
  | "settings";

interface RailItem {
  key: RailSection;
  label: string;
  icon: ReactNode;
  /** Future sections render disabled with a "coming soon" hint. */
  soon?: boolean;
}

const TOP_ITEMS: RailItem[] = [
  { key: "history", label: "History", icon: <HistoryOutlined /> },
  { key: "projects", label: "Projects", icon: <FolderOutlined /> },
  { key: "tools", label: "Tools", icon: <ToolOutlined />, soon: true },
  { key: "agents", label: "Agents", icon: <RobotOutlined />, soon: true },
  { key: "commands", label: "Commands", icon: <CodeOutlined />, soon: true },
];

const BOTTOM_ITEMS: RailItem[] = [
  { key: "settings", label: "Settings", icon: <SettingOutlined /> },
];

interface Props {
  active: RailSection | null;
  onSelect: (section: RailSection) => void;
  /** Sections wanting attention (e.g. Settings when no API key/server yet). */
  badges?: Partial<Record<RailSection, boolean>>;
}

export function SideRail({ active, onSelect, badges }: Props) {
  const renderItem = (item: RailItem) => (
    <Tooltip
      key={item.key}
      placement="right"
      title={item.soon ? `${item.label} — coming soon` : item.label}
    >
      <button
        className={`rail-item ${active === item.key ? "active" : ""} ${item.soon ? "soon" : ""}`}
        onClick={() => !item.soon && onSelect(item.key)}
        disabled={item.soon}
        aria-label={item.label}
      >
        {item.icon}
        {badges?.[item.key] && <span className="rail-badge" />}
      </button>
    </Tooltip>
  );

  return (
    <nav className="side-rail">
      <div className="rail-group">{TOP_ITEMS.map(renderItem)}</div>
      <div className="rail-group rail-bottom">{BOTTOM_ITEMS.map(renderItem)}</div>
    </nav>
  );
}
