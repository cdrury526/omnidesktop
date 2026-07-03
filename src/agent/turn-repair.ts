import { displayItemsFromState } from "./state-display";

const ACTION_INTENT_RE = /\b(i'?ll|i will|let me|i can|here'?s|going to|one moment|pop (it|that) up)\b/i;
const FORM_INTENT_RE = /\b(form|fill (it|this|that|in)|details|sign[ -]?up|sign you up|subscri|collect|fields?|below)\b/i;

export function describedButDidntCall(state: unknown): boolean {
  const items = displayItemsFromState(state);
  const last = items[items.length - 1];
  if (!last || last.kind !== "msg" || last.role !== "assistant") return false;
  return ACTION_INTENT_RE.test(last.content) && FORM_INTENT_RE.test(last.content);
}
