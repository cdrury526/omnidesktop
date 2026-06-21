/**
 * The open-sessions tab bar — VS Code-style flat tabs across the top of the
 * workspace. Active tab is white with an indigo underline; inactive tabs are
 * grey with the close affordance on hover. A `+` opens a fresh chat. Each tab is
 * one mounted ChatSession; the busy dot shows a tab whose turn is still running
 * (including in the background).
 *
 * Uses antd `Tabs` as a pure tab strip — session content is rendered separately
 * in App.tsx so hidden tabs stay mounted and keep streaming.
 */
import {
  CloseOutlined,
  CodeOutlined,
  MergeCellsOutlined,
  MessageOutlined,
  SplitCellsOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Button, ConfigProvider, Dropdown, Tabs, Tooltip } from "antd";

export interface TabInfo {
  key: string;
  label: string;
  /** A code-mode session (folder-bound) vs. a plain chat. */
  code: boolean;
  busy: boolean;
  /** Bound folder no longer exists on disk — tab is read-only. */
  folderMissing?: boolean;
}

interface Props {
  tabs: TabInfo[];
  /** Focused tab (antd active indicator). */
  activeKey: string;
  splitSecondaryKey: string | null;
  isSplit: boolean;
  splitCandidates: { key: string; label: string }[];
  onSelect: (key: string) => void;
  onClose: (key: string) => void;
  onAdd: () => void;
  onEnterSplit: (secondaryKey?: string) => void;
  onExitSplit: () => void;
}

export function TabBar({
  tabs,
  activeKey,
  splitSecondaryKey,
  isSplit,
  splitCandidates,
  onSelect,
  onClose,
  onAdd,
  onEnterSplit,
  onExitSplit,
}: Props) {
  const splitMenu =
    splitCandidates.length > 1
      ? {
          items: splitCandidates.map((c) => ({
            key: c.key,
            label: c.label,
            onClick: () => onEnterSplit(c.key),
          })),
        }
      : undefined;

  return (
    <div className="tab-bar">
      <ConfigProvider
        theme={{
          components: {
            Tabs: {
              cardGutter: 0,
              cardBg: "transparent",
              cardHeight: 38,
              cardPadding: "0 12px",
              borderRadiusLG: 0,
            },
          },
        }}
      >
        <Tabs
          className="tab-bar-tabs"
          type="editable-card"
          size="small"
          activeKey={activeKey}
          onChange={onSelect}
          onEdit={(targetKey, action) => {
            if (action === "add") onAdd();
            else if (typeof targetKey === "string") onClose(targetKey);
          }}
          removeIcon={<CloseOutlined />}
          items={tabs.map((t) => ({
            key: t.key,
            className:
              isSplit && t.key === splitSecondaryKey ? "split-pane-secondary" : undefined,
            label: (
              <span className="tab-label-wrap" title={t.label} data-tab-key={t.key}>
                <span className="tab-icon">{t.code ? <CodeOutlined /> : <MessageOutlined />}</span>
                <span className="tab-label">{t.label}</span>
                {t.folderMissing && (
                  <WarningOutlined className="tab-folder-missing" aria-label="Project folder missing" />
                )}
                {t.busy && <span className="tab-busy" aria-label="Busy" />}
              </span>
            ),
          }))}
        />
      </ConfigProvider>

      <div className="tab-bar-actions">
        {isSplit ? (
          <Tooltip title="Close split view">
            <Button
              type="text"
              size="small"
              icon={<MergeCellsOutlined />}
              aria-label="Close split view"
              onClick={onExitSplit}
            />
          </Tooltip>
        ) : (
          <Dropdown menu={splitMenu} trigger={["click"]} disabled={splitCandidates.length === 0}>
            <Tooltip title={splitCandidates.length === 0 ? "Open another tab to split" : "Split editor"}>
              <Button
                type="text"
                size="small"
                icon={<SplitCellsOutlined />}
                aria-label="Split editor"
                disabled={splitCandidates.length === 0}
                onClick={() => {
                  if (splitCandidates.length === 1) onEnterSplit(splitCandidates[0].key);
                }}
              />
            </Tooltip>
          </Dropdown>
        )}
      </div>
    </div>
  );
}
