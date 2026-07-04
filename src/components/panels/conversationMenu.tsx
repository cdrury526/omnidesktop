import { Modal } from "antd";
import type { ConversationItemType } from "@ant-design/x";

interface ConversationMenuActions {
  onRename: (id: number) => void;
  onDelete: (id: number) => void;
}

/** Per-item Conversations menu with rename and confirmed delete actions. */
export function conversationMenu({ onRename, onDelete }: ConversationMenuActions) {
  return (conversation: ConversationItemType) => ({
    items: [
      { key: "rename", label: "Rename" },
      { key: "delete", label: "Delete", danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      const id = Number(conversation.key);
      if (key === "rename") {
        onRename(id);
        return;
      }
      if (key !== "delete") return;
      Modal.confirm({
        title: "Delete this conversation?",
        okText: "Delete",
        okButtonProps: { danger: true },
        onOk: () => onDelete(id),
      });
    },
  });
}
