import { Modal } from "antd";
import type { ConversationItemType } from "@ant-design/x";

/** Per-item Conversations menu with a confirmed delete action. */
export function deleteConversationMenu(onDelete: (id: number) => void) {
  return (conversation: ConversationItemType) => ({
    items: [{ key: "delete", label: "Delete", danger: true }],
    onClick: ({ key }: { key: string }) => {
      if (key !== "delete") return;
      Modal.confirm({
        title: "Delete this conversation?",
        okText: "Delete",
        okButtonProps: { danger: true },
        onOk: () => onDelete(Number(conversation.key)),
      });
    },
  });
}
