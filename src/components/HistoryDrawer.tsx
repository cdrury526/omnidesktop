import { useMemo, useState } from "react";
import { Button, Drawer, Empty, Input, List, Popconfirm } from "antd";
import {
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ConversationRow } from "../lib/db";

export interface HistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  conversations: ConversationRow[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
}

export function HistoryDrawer({
  open,
  onClose,
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: HistoryDrawerProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      (c.title ?? `chat ${c.id}`).toLowerCase().includes(q),
    );
  }, [conversations, query]);

  return (
    <Drawer
      title="Conversations"
      placement="left"
      width={320}
      open={open}
      onClose={onClose}
      styles={{ body: { padding: 12, display: "flex", flexDirection: "column", gap: 10 } }}
    >
      <Button type="primary" icon={<PlusOutlined />} block onClick={onNew}>
        New chat
      </Button>

      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Search conversations…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <Empty
          description={query ? "No matches" : "No conversations yet"}
          style={{ marginTop: 32 }}
        />
      ) : (
        <List
          size="small"
          dataSource={filtered}
          style={{ overflowY: "auto" }}
          renderItem={(c) => (
            <List.Item
              onClick={() => onSelect(c.id)}
              className={`history-item ${c.id === activeId ? "active" : ""}`}
              actions={[
                <Popconfirm
                  key="del"
                  title="Delete this conversation?"
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    onDelete(c.id);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <DeleteOutlined
                    onClick={(e) => e.stopPropagation()}
                    className="history-del"
                  />
                </Popconfirm>,
              ]}
            >
              <span className="history-title">{c.title || `Chat ${c.id}`}</span>
            </List.Item>
          )}
        />
      )}
    </Drawer>
  );
}
