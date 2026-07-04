import { displayItemsFromState, pendingApprovalCalls, pendingHitlCall } from "../agent/runner";
import { getConversationState } from "../lib/db";

export async function bridgeTranscript(conversationId: number | null) {
  const state = conversationId != null ? await getConversationState(conversationId) : null;
  return {
    conversationId,
    pending: pendingHitlCall(state),
    pendingApproval: pendingApprovalCalls(state),
    items: displayItemsFromState(state),
  };
}

export async function bridgeResolutionTranscript(
  status: "resolved" | "cancelled" | "approved" | "rejected",
  conversationId: number | null,
) {
  const state = conversationId != null ? await getConversationState(conversationId) : null;
  return {
    [status]: conversationId != null,
    pending: pendingHitlCall(state),
    pendingApproval: pendingApprovalCalls(state),
    items: displayItemsFromState(state),
  };
}

