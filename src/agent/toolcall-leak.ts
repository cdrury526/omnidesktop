/**
 * Guard for models that stream raw tool-call templates as assistant text instead
 * of emitting structured tool calls.
 */
export class LeakedToolCallError extends Error {
  constructor() {
    super("The model streamed a raw tool-call template instead of calling the tool.");
    this.name = "LeakedToolCallError";
  }
}

// The fullwidth pipe opener (`<｜tool▁calls▁begin｜>`, `<｜DSML｜…>`) never appears
// in legitimate prose; the ASCII `<|tool…|` / `<|im_start|` markers are the
// other common leak.
export const LEAKED_TOOLCALL_RE = /<｜|<\|(?:tool|assistant|im_start|channel|dsml)/i;
