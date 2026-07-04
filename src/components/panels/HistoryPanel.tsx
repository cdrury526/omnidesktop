/**
 * History panel (opened from the rail's History icon). A flat, searchable list
 * of every conversation, newest first. Replaces the old left Drawer — rendered
 * inline beside the rail so it sits in the layout instead of overlaying it.
 */
import { useMemo, useState } from "react";
import { Conversations, type ConversationItemType } from "@ant-design/x";
import { Empty, Input } from "antd";
import { MessageOutlined } from "@ant-design/icons";
import type { ConversationRow } from "../../lib/db";
import { ConversationLabel } from "./ConversationLabel";
import { ConversationRenameModal } from "./ConversationRenameModal";
import { conversationMenu } from "./conversationMenu";

interface Props {
  conversations: ConversationRow[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onRename: (id: number, title: string) => Promise<void>;
  onDelete: (id: number) => void;
}

function toItem(c: ConversationRow): ConversationItemType {
  const title = c.title || `Chat ${c.id}`;
  return {
    key: String(c.id),
    label: <ConversationLabel title={title} updatedAt={c.updated_at} />,
    icon: <MessageOutlined />,
    "aria-label": title,
    "data-conversation-id": c.id,
  };
}

export function HistoryPanel({ conversations, activeId, onSelect, onRename, onDelete }: Props) {
  const [query, setQuery] = useState("");
  const [renameId, setRenameId] = useState<number | null>(null);
  const renameTarget = useMemo(
    () => conversations.find((c) => c.id === renameId) ?? null,
    [conversations, renameId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      (c.title ?? `chat ${c.id}`).toLowerCase().includes(q),
    );
  }, [conversations, query]);

  const items = useMemo(() => filtered.map(toItem), [filtered]);

  return (
    <div className="panel-body">
      <Input.Search
        allowClear
        enterButton={false}
        placeholder="Search conversations…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onSearch={setQuery}
      />
      {items.length === 0 ? (
        <Empty
          description={query ? "No matches" : "No conversations yet"}
          style={{ marginTop: 32 }}
        />
      ) : (
        <Conversations
          className="panel-conversations"
          items={items}
          activeKey={activeId != null ? String(activeId) : undefined}
          onActiveChange={(key) => onSelect(Number(key))}
          menu={conversationMenu({ onRename: setRenameId, onDelete })}
        />
      )}
      <ConversationRenameModal
        open={!!renameTarget}
        conversation={renameTarget}
        onCancel={() => setRenameId(null)}
        onRename={async (id, title) => {
          await onRename(id, title);
          setRenameId(null);
        }}
      />
    </div>
  );
}
