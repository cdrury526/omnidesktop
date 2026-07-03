import { displayItemsFromState, pendingHitlCall } from "../agent/runner";
import { getConversationState } from "../lib/db";

export async function bridgeTranscript(conversationId: number | null) {
  const state = conversationId != null ? await getConversationState(conversationId) : null;
  return {
    conversationId,
    pending: pendingHitlCall(state),
    items: displayItemsFromState(state),
  };
}

export async function bridgeResolutionTranscript(status: "resolved" | "cancelled", conversationId: number | null) {
  const state = conversationId != null ? await getConversationState(conversationId) : null;
  return {
    [status]: conversationId != null,
    pending: pendingHitlCall(state),
    items: displayItemsFromState(state),
  };
}

