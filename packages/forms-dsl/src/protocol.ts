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
export const FORM_CANCEL_KEY = "omni.form/cancel";
export const FORM_DIRTY_KEY = "omni.form/dirty";

/** Shape the App sends on submit: `{ [FORM_SUBMIT_KEY]: true, values }`. */
export interface FormSubmitPayload {
  [FORM_SUBMIT_KEY]: true;
  values: Record<string, unknown>;
}

export function isFormSubmit(sc: unknown): sc is FormSubmitPayload {
  return !!sc && typeof sc === "object" && (sc as Record<string, unknown>)[FORM_SUBMIT_KEY] === true;
}

/** The App declined the form: `{ [FORM_CANCEL_KEY]: true }`. */
export function isFormCancel(sc: unknown): boolean {
  return !!sc && typeof sc === "object" && (sc as Record<string, unknown>)[FORM_CANCEL_KEY] === true;
}

/**
 * The App's "has the user entered anything yet" signal, so the host can decide
 * whether to confirm before cancelling. `{ [FORM_DIRTY_KEY]: boolean }`. The
 * host intercepts this (it never reaches the model).
 */
export function readFormDirty(sc: unknown): boolean | null {
  if (!sc || typeof sc !== "object" || !(FORM_DIRTY_KEY in sc)) return null;
  return Boolean((sc as Record<string, unknown>)[FORM_DIRTY_KEY]);
}
