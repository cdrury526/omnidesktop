import type { ServerInfo } from "../mcp/host-bridge";

export interface UseAgentChatArgs {
  apiKey: string;
  model: string;
  server: ServerInfo | null;
  conversationId: number | null;
  setConversationId: (id: number | null) => void;
  /** Refresh the conversation list (recency) after a turn touches a chat. */
  onConversationsChanged: () => void;
  /** Surface a "need key/model" message in App's connection error banner. */
  setConnError: (msg: string | null) => void;
}

