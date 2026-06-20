/**
 * The small contract that lets the host recognize an interactive tool and its
 * submission, shared so the server and host can't drift.
 *
 * - `INTERACTIVE_TOOL_META`: a truthy key under a tool's `_meta` marks it as one
 *   whose *real* result is the user's input — the host runs it as a HITL tool
 *   (pause on call, resume on submit) rather than returning the immediate MCP
 *   result. Plain MCP App tools (no marker) keep their current display behavior.
 *
 * - `FORM_SUBMIT_KEY`: the key the App sets on its `updateModelContext`
 *   `structuredContent` to signal "the user submitted"; the payload's `values`
 *   become the tool result. Any other context update is treated as passive.
 */
export const INTERACTIVE_TOOL_META = "omni.io/awaits-input";
export const FORM_SUBMIT_KEY = "omni.form/submit";

/** Shape the App sends on submit: `{ [FORM_SUBMIT_KEY]: true, values }`. */
export interface FormSubmitPayload {
  [FORM_SUBMIT_KEY]: true;
  values: Record<string, unknown>;
}

export function isFormSubmit(sc: unknown): sc is FormSubmitPayload {
  return !!sc && typeof sc === "object" && (sc as Record<string, unknown>)[FORM_SUBMIT_KEY] === true;
}
