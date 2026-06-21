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
import { CloseOutlined, CodeOutlined, MessageOutlined } from "@ant-design/icons";
import { ConfigProvider, Tabs } from "antd";

export interface TabInfo {
  key: string;
  label: string;
  /** A code-mode session (folder-bound) vs. a plain chat. */
  code: boolean;
  busy: boolean;
}

interface Props {
  tabs: TabInfo[];
  activeKey: string;
  onSelect: (key: string) => void;
  onClose: (key: string) => void;
  onAdd: () => void;
}

export function TabBar({ tabs, activeKey, onSelect, onClose, onAdd }: Props) {
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
            label: (
              <span className="tab-label-wrap" title={t.label} data-tab-key={t.key}>
                <span className="tab-icon">{t.code ? <CodeOutlined /> : <MessageOutlined />}</span>
                <span className="tab-label">{t.label}</span>
                {t.busy && <span className="tab-busy" aria-label="Busy" />}
              </span>
            ),
          }))}
        />
      </ConfigProvider>
    </div>
  );
}
