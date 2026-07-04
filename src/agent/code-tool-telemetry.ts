import { logEvent } from "../lib/events";

export type CodeToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorCode(message: string): string {
  if (/escapes working_dir/i.test(message)) return "path_escape";
  if (/not reachable|no such file|not found/i.test(message)) return "not_found";
  if (/not a directory/i.test(message)) return "not_directory";
  if (/not a file/i.test(message)) return "not_file";
  if (/too large/i.test(message)) return "too_large";
  if (/utf-?8/i.test(message)) return "not_utf8";
  if (/timed? out|timeout/i.test(message)) return "command_timeout";
  if (/failed to start|spawn/i.test(message)) return "spawn_failed";
  if (/command/i.test(message)) return "command_failed";
  return "unknown_error";
}

export async function executeCodeTool<T>(
  name: string,
  summary: Record<string, unknown>,
  run: () => Promise<T>,
  resultSummary: (result: T) => Record<string, unknown> = () => ({}),
): Promise<CodeToolResult<T>> {
  const startedAt = performance.now();
  logEvent({ source: "system", type: "code_tool.start", data: { name, ...summary } });
  try {
    const data = await run();
    logEvent({
      source: "system",
      type: "code_tool.end",
      data: {
        name,
        ...summary,
        ...resultSummary(data),
        ms: Math.round(performance.now() - startedAt),
      },
    });
    return { ok: true, data };
  } catch (error) {
    const message = errorMessage(error);
    const code = errorCode(message);
    logEvent({
      source: "system",
      type: "code_tool.error",
      data: {
        name,
        ...summary,
        error: message,
        code,
        ms: Math.round(performance.now() - startedAt),
      },
    });
    return { ok: false, error: message, code };
  }
}
