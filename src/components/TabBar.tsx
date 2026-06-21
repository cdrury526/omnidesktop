/**
 * The open-sessions tab bar — VS Code-style flat tabs across the top of the
 * workspace. Active tab is white with an indigo underline; inactive tabs are
 * grey with the close affordance on hover. A `+` opens a fresh chat. Each tab is
 * one mounted ChatSession; the busy dot shows a tab whose turn is still running
 * (including in the background).
 */
import { CodeOutlined, MessageOutlined, PlusOutlined, CloseOutlined } from "@ant-design/icons";

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
      <div className="tab-strip">
        {tabs.map((t) => (
          <div
            key={t.key}
            className={`tab ${t.key === activeKey ? "active" : ""}`}
            onClick={() => onSelect(t.key)}
            title={t.label}
          >
            <span className="tab-icon">{t.code ? <CodeOutlined /> : <MessageOutlined />}</span>
            <span className="tab-label">{t.label}</span>
            {t.busy && <span className="tab-busy" />}
            <button
              className="tab-close"
              aria-label="Close tab"
              onClick={(e) => {
                e.stopPropagation();
                onClose(t.key);
              }}
            >
              <CloseOutlined />
            </button>
            {t.key === activeKey && <div className="tab-underline" />}
          </div>
        ))}
      </div>
      <button className="tab-add" aria-label="New tab" onClick={onAdd}>
        <PlusOutlined />
      </button>
    </div>
  );
}
