import { useEffect, useState } from "react";
import { Input, Modal } from "antd";
import type { ConversationRow } from "../../lib/db";

interface Props {
  conversation: ConversationRow | null;
  open: boolean;
  onCancel: () => void;
  onRename: (id: number, title: string) => Promise<void>;
}

export function ConversationRenameModal({ conversation, open, onCancel, onRename }: Props) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && conversation) setTitle(conversation.title || `Chat ${conversation.id}`);
  }, [conversation, open]);

  const trimmed = title.trim();

  async function submit() {
    if (!conversation || !trimmed) return;
    setSaving(true);
    try {
      await onRename(conversation.id, trimmed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Rename conversation"
      open={open}
      okText="Rename"
      confirmLoading={saving}
      okButtonProps={{ disabled: !trimmed }}
      onOk={() => void submit()}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Input
        autoFocus
        maxLength={80}
        showCount
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onPressEnter={() => void submit()}
        placeholder="Conversation title"
      />
    </Modal>
  );
}
