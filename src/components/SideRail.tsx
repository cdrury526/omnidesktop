/**
 * The left icon rail — the app's primary navigation. Collapsed to icons by
 * default; clicking an icon opens that section's panel beside the rail (clicking
 * the active icon again closes it). History/Projects/Settings are live;
 * Tools/Agents/Commands are placeholders for future work (disabled, tooltipped).
 *
 * The rail is app chrome (it spans all sessions); the panels it opens are
 * rendered by App next to it.
 */
import { Badge, Menu, type MenuProps } from "antd";
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

function railIcon(icon: ReactNode, badge?: boolean) {
  const node = <span className="rail-menu-icon">{icon}</span>;
  return badge ? (
    <Badge dot className="rail-badge-wrap">
      {node}
    </Badge>
  ) : (
    node
  );
}

function toMenuItems(
  items: RailItem[],
  badges?: Partial<Record<RailSection, boolean>>,
): MenuProps["items"] {
  return items.map((item) => ({
    key: item.key,
    icon: railIcon(item.icon, badges?.[item.key]),
    label: item.label,
    title: item.soon ? `${item.label} — coming soon` : item.label,
    disabled: item.soon,
    className: item.soon ? "rail-menu-item soon" : "rail-menu-item",
    "data-rail-section": item.key,
    "aria-label": item.label,
  }));
}

export function SideRail({ active, onSelect, badges }: Props) {
  const selectedKeys = active ? [active] : [];
  const onClick: MenuProps["onClick"] = ({ key }) => onSelect(key as RailSection);

  return (
    <nav className="side-rail" aria-label="Main navigation">
      <Menu
        className="side-rail-menu"
        mode="inline"
        inlineCollapsed
        selectable
        selectedKeys={selectedKeys}
        items={toMenuItems(TOP_ITEMS, badges)}
        onClick={onClick}
      />
      <Menu
        className="side-rail-menu side-rail-menu-bottom"
        mode="inline"
        inlineCollapsed
        selectable
        selectedKeys={selectedKeys}
        items={toMenuItems(BOTTOM_ITEMS, badges)}
        onClick={onClick}
      />
    </nav>
  );
}
