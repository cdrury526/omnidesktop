import { formatConversationTime } from "../../lib/formatConversationTime";

interface Props {
  title: string;
  updatedAt: string;
}

export function ConversationLabel({ title, updatedAt }: Props) {
  return (
    <span className="conversation-label">
      <span className="conversation-title">{title}</span>
      <span className="conversation-time">{formatConversationTime(updatedAt)}</span>
    </span>
  );
}
