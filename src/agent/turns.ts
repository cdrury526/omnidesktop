import { OpenRouter, stepCountIs } from "@openrouter/agent";
import { HTTPClient } from "@openrouter/sdk";
import { appFetch } from "../lib/tauri-fetch";
import { LeakedToolCallError, LEAKED_TOOLCALL_RE } from "./toolcall-leak";
import type { AgentTools } from "./build-tools";
import { mergeTurnResponse, type TurnTelemetry } from "./telemetry";

const SYSTEM_PROMPT =
  "You are a helpful desktop assistant running in a native app. You can call " +
  "tools provided by connected MCP servers. Some tools open an interactive UI " +
  "panel beside the chat (forms, dropdowns, pickers).\n\n" +
  "CRITICAL RULE: when you need structured input from the user — anything you'd " +
  "otherwise collect by listing questions — you MUST call the appropriate tool " +
  "(e.g. `request_user_input`) in the SAME turn. Do NOT describe a form, say " +
  "you'll show one, or list the fields in prose: actually emit the tool call. " +
  "Describing instead of calling is a failure.\n\n" +
  "Example — user: \"sign me up\" → you immediately call request_user_input with " +
  "the fields (name, email, plan, …). You do not write \"Sure, let me pull up a " +
  "form\"; you call the tool.\n\n" +
  "After a form opens, briefly tell the user to fill it in — never invent their " +
  "answers; you receive the submitted values as the tool result. If a result " +
  "says the user cancelled, acknowledge briefly and move on.";

function instructionsFor(workingDir?: string): string {
  if (!workingDir) return SYSTEM_PROMPT;
  return (
    SYSTEM_PROMPT +
    "\n\n## Code mode\n" +
    "You are in code mode for a software project. The working folder for this " +
    `session is \`${workingDir}\`. Treat it as the project root: when the user ` +
    'says "the project", "this repo", or names files without an absolute path, ' +
    "resolve them relative to that folder. You can list directories and read " +
    "UTF-8 text files through the available Code mode tools. You cannot write " +
    "files or run commands yet, so do not claim to have modified files or " +
    "executed commands."
  );
}

export interface StateStore {
  load: () => Promise<unknown | null>;
  save: (state: unknown) => Promise<void>;
}

function makeClient(apiKey: string): OpenRouter {
  return new OpenRouter({
    apiKey,
    httpClient: new HTTPClient({ fetcher: appFetch as never }),
  });
}

function wireAbort(result: { cancel: () => Promise<void> }, signal?: AbortSignal): void {
  if (!signal) return;
  if (signal.aborted) void result.cancel();
  else signal.addEventListener("abort", () => void result.cancel(), { once: true });
}

async function streamText(
  result: { getTextStream: () => AsyncIterable<string>; cancel?: () => Promise<void> },
  onTextDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  let full = "";
  try {
    for await (const delta of result.getTextStream()) {
      full += delta;
      onTextDelta(delta);
      if (LEAKED_TOOLCALL_RE.test(full)) {
        await result.cancel?.().catch(() => {});
        throw new LeakedToolCallError();
      }
    }
  } catch (e) {
    if (e instanceof LeakedToolCallError) throw e;
    if (signal?.aborted) return full;
    throw e;
  }
  return full;
}

async function captureTelemetry(
  result: { getResponse?: () => Promise<unknown> },
  telemetry?: TurnTelemetry,
  signal?: AbortSignal,
): Promise<void> {
  if (!telemetry || signal?.aborted) return;
  try {
    mergeTurnResponse(telemetry, await result.getResponse?.());
  } catch {
    // Best-effort only; HITL pauses have no final response.
  }
}

export interface RunTurnArgs {
  apiKey: string;
  model: string;
  userText: string;
  state: StateStore;
  tools: AgentTools;
  onTextDelta: (delta: string) => void;
  signal?: AbortSignal;
  workingDir?: string;
  telemetry?: TurnTelemetry;
}

export async function runTurn({
  apiKey,
  model,
  userText,
  state,
  tools,
  onTextDelta,
  signal,
  workingDir,
  telemetry,
}: RunTurnArgs): Promise<string> {
  const result = makeClient(apiKey).callModel({
    model,
    instructions: instructionsFor(workingDir),
    input: [{ role: "user", content: userText }] as never,
    state: state as never,
    tools,
    stopWhen: stepCountIs(8),
    allowFinalResponse: true,
  });
  wireAbort(result, signal);
  const text = await streamText(result, onTextDelta, signal);
  await captureTelemetry(result, telemetry, signal);
  return text;
}

export interface OpenFormArgs {
  apiKey: string;
  model: string;
  spec: unknown;
  toolName?: string;
  state: StateStore;
  tools: AgentTools;
  onTextDelta: (delta: string) => void;
}

export async function openForm({
  apiKey,
  model,
  spec,
  toolName = "request_user_input",
  state,
  tools,
  onTextDelta,
}: OpenFormArgs): Promise<string> {
  const result = makeClient(apiKey).callModel({
    model,
    instructions: SYSTEM_PROMPT,
    input: [
      {
        role: "user",
        content:
          `Call the \`${toolName}\` tool now with exactly these arguments ` +
          `(verbatim JSON, do not change them): ${JSON.stringify(spec)}`,
      },
    ] as never,
    state: state as never,
    tools,
    toolChoice: { type: "function", name: toolName } as never,
    stopWhen: stepCountIs(2),
  });
  return streamText(result, onTextDelta);
}

export interface RepairArgs {
  apiKey: string;
  model: string;
  toolName?: string;
  state: StateStore;
  tools: AgentTools;
  onTextDelta: (delta: string) => void;
  signal?: AbortSignal;
  workingDir?: string;
  telemetry?: TurnTelemetry;
}

export async function repairToolCall({
  apiKey,
  model,
  toolName = "request_user_input",
  state,
  tools,
  onTextDelta,
  signal,
  workingDir,
  telemetry,
}: RepairArgs): Promise<string> {
  const result = makeClient(apiKey).callModel({
    model,
    instructions: instructionsFor(workingDir),
    input: [
      {
        role: "developer",
        content: `You described showing a form but did not call the tool. Call \`${toolName}\` now with the fields you described.`,
      },
    ] as never,
    state: state as never,
    tools,
    toolChoice: { type: "function", name: toolName } as never,
    stopWhen: stepCountIs(2),
  });
  wireAbort(result, signal);
  const text = await streamText(result, onTextDelta, signal);
  await captureTelemetry(result, telemetry, signal);
  return text;
}

export interface ResumeTurnArgs {
  apiKey: string;
  model: string;
  callId: string;
  output: unknown;
  state: StateStore;
  tools: AgentTools;
  onTextDelta: (delta: string) => void;
  signal?: AbortSignal;
  workingDir?: string;
  telemetry?: TurnTelemetry;
}

export async function resumeTurn({
  apiKey,
  model,
  callId,
  output,
  state,
  tools,
  onTextDelta,
  signal,
  workingDir,
  telemetry,
}: ResumeTurnArgs): Promise<string> {
  const result = makeClient(apiKey).callModel({
    model,
    instructions: instructionsFor(workingDir),
    input: [
      { type: "function_call_output", callId, output: JSON.stringify(output) },
    ] as never,
    state: state as never,
    tools,
    stopWhen: stepCountIs(8),
    allowFinalResponse: true,
  });
  wireAbort(result, signal);
  const text = await streamText(result, onTextDelta, signal);
  await captureTelemetry(result, telemetry, signal);
  return text;
}

export interface ResumeApprovalArgs {
  apiKey: string;
  model: string;
  approveToolCalls: string[];
  rejectToolCalls?: string[];
  state: StateStore;
  tools: AgentTools;
  onTextDelta: (delta: string) => void;
  signal?: AbortSignal;
  workingDir?: string;
  telemetry?: TurnTelemetry;
}

/** Resume from SDK `awaiting_approval` via approveToolCalls / rejectToolCalls. */
export async function resumeApprovalTurn({
  apiKey,
  model,
  approveToolCalls,
  rejectToolCalls = [],
  state,
  tools,
  onTextDelta,
  signal,
  workingDir,
  telemetry,
}: ResumeApprovalArgs): Promise<string> {
  const result = makeClient(apiKey).callModel({
    model,
    instructions: instructionsFor(workingDir),
    input: [] as never,
    state: state as never,
    tools,
    approveToolCalls,
    rejectToolCalls,
    stopWhen: stepCountIs(8),
    allowFinalResponse: true,
  });
  wireAbort(result, signal);
  const text = await streamText(result, onTextDelta, signal);
  await captureTelemetry(result, telemetry, signal);
  return text;
}
