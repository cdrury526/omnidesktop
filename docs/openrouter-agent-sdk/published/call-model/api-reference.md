> ## Documentation Index
>
> Fetch the complete documentation index at: [/docs/llms.txt](https://openrouter.ai/docs/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://openrouter.ai/docs/agent-sdk/call-model/api-reference#content-area)

## [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#callmodel)  callModel

```
function callModel(request: CallModelInput, options?: RequestOptions): ModelResult
```

Creates a response using the OpenResponses API with multiple consumption patterns.

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#callmodelinput)  CallModelInput

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `model` | `string | ((ctx: TurnContext) => string)` | Yes\* | Model ID (e.g., “openai/gpt-5-nano”) |
| `models` | `string[]` | Yes\* | Model fallback array |
| `input` | `OpenResponsesInput` | Yes | Input messages or string |
| `instructions` | `string | ((ctx: TurnContext) => string)` | No | System instructions |
| `tools` | `Tool[]` | No | Tools available to the model |
| `maxToolRounds` | `MaxToolRounds` | No | Tool execution limit (deprecated) |
| `stopWhen` | `StopWhen` | No | Stop conditions |
| `temperature` | `number | ((ctx: TurnContext) => number)` | No | Sampling temperature (0-2) |
| `maxOutputTokens` | `number | ((ctx: TurnContext) => number)` | No | Maximum tokens to generate |
| `topP` | `number` | No | Top-p sampling |
| `text` | `ResponseTextConfig` | No | Text format configuration |
| `provider` | `ProviderPreferences` | No | Provider routing and configuration |
| `topK` | `number` | No | Top-k sampling |
| `metadata` | `Record<string, string>` | No | Request metadata |
| `toolChoice` | `ToolChoice` | No | Tool choice configuration |
| `parallelToolCalls` | `boolean` | No | Enable parallel tool calling |
| `reasoning` | `ReasoningConfig` | No | Reasoning configuration |
| `promptCacheKey` | `string` | No | Cache key for prompt caching |
| `previousResponseId` | `string` | No | Context from previous response |
| `include` | `string[]` | No | Include extra fields in response |
| `background` | `boolean` | No | Run request in background |
| `safetyIdentifier` | `string` | No | User safety identifier |
| `serviceTier` | `string` | No | Service tier preference |
| `truncation` | `string` | No | Truncation mode |
| `plugins` | `Plugin[]` | No | Enabled plugins |
| `user` | `string` | No | End-user identifier |
| `sessionId` | `string` | No | Session identifier |
| `store` | `boolean` | No | Store request data |
| `context` | `ContextInput<ToolContextMap>` | No | Tool context keyed by tool name |

\*Either `model` or `models` is required.

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#providerpreferences)  ProviderPreferences

Configuration for routing and provider selection.

| Parameter | Type | Description |
| --- | --- | --- |
| `allowFallbacks` | `boolean` | Allow backup providers when primary is unavailable (default: true) |
| `requireParameters` | `boolean` | Only use providers that support all requested parameters |
| `dataCollection` | `"allow" | "deny"` | Data collection policy (allow/deny) |
| `order` | `string[]` | Custom provider routing order |
| `only` | `string[]` | Restrict to specific providers |
| `ignore` | `string[]` | Exclude specific providers |
| `quantizations` | `string[]` | Filter by quantization levels |
| `sort` | `string` | Load balancing strategy (e.g., “throughput”) |
| `maxPrice` | `object` | Maximum price limits |
| `preferredMinThroughput` | `number` | Minimum tokens per second preference |
| `preferredMaxLatency` | `number` | Maximum latency preference |

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#requestoptions)  RequestOptions

| Parameter | Type | Description |
| --- | --- | --- |
| `timeout` | `number` | Request timeout in milliseconds |
| `signal` | `AbortSignal` | Abort signal for cancellation |

* * *

## [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#modelresult)  ModelResult

Wrapper providing multiple consumption patterns for a response.

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#methods)  Methods

#### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#gettext)  getText()

```
getText(): Promise<string>
```

Get text content after tool execution completes.

#### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#getresponse)  getResponse()

```
getResponse(): Promise<OpenResponsesNonStreamingResponse>
```

Get full response with usage data (inputTokens, outputTokens, cachedTokens).

#### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#gettextstream)  getTextStream()

```
getTextStream(): AsyncIterableIterator<string>
```

Stream text deltas.

#### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#getreasoningstream)  getReasoningStream()

```
getReasoningStream(): AsyncIterableIterator<string>
```

Stream reasoning deltas (for reasoning models).

#### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#getnewmessagesstream)  getNewMessagesStream()

```
getNewMessagesStream(): AsyncIterableIterator<ResponsesOutputMessage | OpenResponsesFunctionCallOutput>
```

Stream cumulative message snapshots in OpenResponses format.

#### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#getfullresponsesstream)  getFullResponsesStream()

```
getFullResponsesStream(): AsyncIterableIterator<EnhancedResponseStreamEvent>
```

Stream all events including tool preliminary results.

#### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#gettoolcalls)  getToolCalls()

```
getToolCalls(): Promise<ParsedToolCall[]>
```

Get all tool calls from initial response.

#### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#gettoolcallsstream)  getToolCallsStream()

```
getToolCallsStream(): AsyncIterableIterator<ParsedToolCall>
```

Stream tool calls as they complete.

#### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#gettoolstream)  getToolStream()

```
getToolStream(): AsyncIterableIterator<ToolStreamEvent>
```

Stream tool deltas and preliminary results.

#### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#getcontextupdates)  getContextUpdates()

```
getContextUpdates(): AsyncGenerator<ToolContextMap<TTools>>
```

Stream context snapshots whenever a tool calls
`setContext()`. Completes when tool execution finishes.

#### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#cancel)  cancel()

```
cancel(): Promise<void>
```

Cancel the stream and all consumers.

* * *

## [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#tool-types)  Tool Types

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#tool)  tool()

```
function tool<TInput, TOutput>(config: ToolConfig): Tool
```

Create a typed tool with Zod schema validation.

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#toolconfig)  ToolConfig

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | Yes | Tool name |
| `description` | `string` | No | Tool description |
| `inputSchema` | `ZodObject` | Yes | Input parameter schema |
| `outputSchema` | `ZodType` | No | Output schema |
| `eventSchema` | `ZodType` | No | Event schema (triggers generator mode) |
| `contextSchema` | `ZodObject` | No | Context data this tool needs |
| `execute` | `function | false` | Yes\* | Execute function, or `false` for manual |
| `onToolCalled` | `function` | Yes\* | HITL hook — return value to auto-respond, `null` to pause |
| `onResponseReceived` | `function` | No | HITL hook — post-process caller-supplied result (HITL only) |
| `nextTurnParams` | `NextTurnParamsFunctions` | No | Parameters to modify next turn |

\\* Provide exactly one of `execute` or `onToolCalled`. Omitting both (with `execute: false`) makes the tool a manual tool.

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#tool-2)  Tool

Union type of all tool types:

```
type Tool =
  | ToolWithExecute<ZodObject, ZodType>
  | ToolWithGenerator<ZodObject, ZodType, ZodType>
  | ManualTool<ZodObject, ZodType>
  | HITLTool<ZodObject, ZodType>;
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#toolwithexecute)  ToolWithExecute

Regular tool with execute function:

```
interface ToolWithExecute<
  TInput, TOutput, TContext, TName
> {
  type: ToolType.Function;
  function: {
    name: TName;
    description?: string;
    inputSchema: TInput;
    outputSchema?: TOutput;
    contextSchema?: ZodObject;
    execute: (
      params: z.infer<TInput>,
      context: ToolExecuteContext<TName, TContext>,
    ) => Promise<z.infer<TOutput>>;
  };
}
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#toolwithgenerator)  ToolWithGenerator

Generator tool with eventSchema:

```
interface ToolWithGenerator<
  TInput, TEvent, TOutput, TContext, TName
> {
  type: ToolType.Function;
  function: {
    name: TName;
    description?: string;
    inputSchema: TInput;
    eventSchema: TEvent;
    outputSchema: TOutput;
    contextSchema?: ZodObject;
    execute: (
      params: z.infer<TInput>,
      context: ToolExecuteContext<TName, TContext>,
    ) => AsyncGenerator<z.infer<TEvent>>;
  };
}
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#manualtool)  ManualTool

Tool without execute function:

```
interface ManualTool<TInput, TOutput> {
  type: ToolType.Function;
  function: {
    name: string;
    description?: string;
    inputSchema: TInput;
    outputSchema?: TOutput;
  };
}
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#hitltool)  HITLTool

Human-in-the-loop tool with `onToolCalled` and optional `onResponseReceived` hooks. `outputSchema` is required — it validates both the hook’s non-null return value and the caller-supplied response delivered via `function_call_output`.

```
interface HITLToolFunction<
  TInput, TOutput, TContext, TName
> {
  name: TName;
  description?: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  contextSchema?: ZodObject;
  onToolCalled: (
    params: z.infer<TInput>,
    context?: ToolExecuteContext<TName, TContext>,
  ) => Promise<z.infer<TOutput> | null> | z.infer<TOutput> | null;
  onResponseReceived?: (
    rawResult: unknown,
    context?: ToolExecuteContext<TName, TContext>,
  ) => Promise<z.infer<TOutput>> | z.infer<TOutput>;
  toModelOutput?: ToModelOutputFunction<
    z.infer<TInput>,
    z.infer<TOutput>
  >;
}

type HITLTool<TInput, TOutput, TContext> = {
  type: ToolType.Function;
  function: HITLToolFunction<TInput, TOutput, TContext>;
};
```

See all 26 lines

Returning `null` from `onToolCalled` pauses the loop and sets the conversation status to `'awaiting_hitl'`. Throwing from `onToolCalled` is surfaced as a tool error of the form `{ error: ... }`. Throwing from `onResponseReceived` is surfaced as an error payload that includes the caller’s original output of the form `{ error: ..., originalOutput: ... }`.

* * *

## [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#tool-type-guards)  Tool Type Guards

```
function isManualTool(tool: Tool): tool is ManualTool;
function isHITLTool(tool: Tool): tool is HITLTool;
function isAutoResolvableTool(
  tool: Tool,
): tool is ToolWithExecute | ToolWithGenerator | HITLTool;
```

- `isManualTool` — no `execute` and no `onToolCalled`. Always pauses the loop.
- `isHITLTool` — has an `onToolCalled` function.
- `isAutoResolvableTool` — either has an `execute` function (regular/generator) or is a HITL tool. Returns `false` for manual and server tools.

* * *

## [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#context-types)  Context Types

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#turncontext)  TurnContext

```
interface TurnContext {
  toolCall?: OpenResponsesFunctionToolCall;
  numberOfTurns: number;
  turnRequest?: OpenResponsesRequest;
}
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#toolexecutecontext)  ToolExecuteContext

Flat context passed to tool execute functions.
Merges `TurnContext` fields with tool-specific context:

```
type ToolExecuteContext<TName, TContext> =
  TurnContext & {
    tools: {
      readonly [K in TName]: Readonly<TContext>;
    };
    setContext(partial: Partial<TContext>): void;
  };
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#toolcontextmap)  ToolContextMap

Context map for `callModel`’s `context` option,
keyed by tool name:

```
type ToolContextMap<T extends readonly Tool[]> = {
  [K in T[number] as K['function']['name']]:
    InferToolContext<K>;
};
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#contextinput)  ContextInput

Context can be static, a sync function,
or an async function:

```
type ContextInput<T> =
  | T
  | ((turn: TurnContext) => T)
  | ((turn: TurnContext) => Promise<T>);
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#nextturnparamscontext)  NextTurnParamsContext

```
interface NextTurnParamsContext {
  input: OpenResponsesInput;
  model: string;
  models: string[];
  temperature: number | null;
  maxOutputTokens: number | null;
  topP: number | null;
  topK?: number | undefined;
  instructions: string | null;
}
```

* * *

## [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#stream-event-types)  Stream Event Types

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#enhancedresponsestreamevent)  EnhancedResponseStreamEvent

```
type EnhancedResponseStreamEvent =
  | OpenResponsesStreamEvent
  | ToolPreliminaryResultEvent;
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#toolstreamevent)  ToolStreamEvent

```
type ToolStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'preliminary_result'; toolCallId: string; result: unknown };
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#parsedtoolcall)  ParsedToolCall

```
interface ParsedToolCall {
  id: string;
  name: string;
  arguments: unknown;
}
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#toolexecutionresult)  ToolExecutionResult

```
interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  result: unknown;
  preliminaryResults?: unknown[];
  error?: Error;
}
```

* * *

## [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#stop-conditions)  Stop Conditions

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#stopwhen)  StopWhen

```
type StopWhen =
  | StopCondition
  | StopCondition[];
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#stopcondition)  StopCondition

```
type StopCondition = (context: StopConditionContext) => boolean | Promise<boolean>;
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#stopconditioncontext)  StopConditionContext

```
interface StopConditionContext {
  steps: StepResult[];
}
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#stepresult)  StepResult

```
interface StepResult {
  stepType: 'initial' | 'continue';
  text: string;
  toolCalls: TypedToolCallUnion[];
  toolResults: ToolExecutionResultUnion[];
  response: OpenResponsesNonStreamingResponse;
  usage?: OpenResponsesUsage;
  finishReason?: string;
  warnings?: Warning[];
  experimental_providerMetadata?: Record<string, unknown>;
}
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#warning)  Warning

```
interface Warning {
  type: string;
  message: string;
}
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#built-in-helpers)  Built-in Helpers

| Function | Signature | Description |
| --- | --- | --- |
| `stepCountIs` | `(n: number) => StopCondition` | Stop after n steps |
| `hasToolCall` | `(name: string) => StopCondition` | Stop when tool is called |
| `maxTokensUsed` | `(n: number) => StopCondition` | Stop after n tokens |
| `maxCost` | `(amount: number) => StopCondition` | Stop after cost limit |
| `finishReasonIs` | `(reason: string) => StopCondition` | Stop on finish reason |

* * *

## [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#format-helpers)  Format Helpers

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#fromchatmessages)  fromChatMessages

```
function fromChatMessages(messages: Message[]): OpenResponsesInput
```

Convert OpenAI chat format to OpenResponses input.

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#tochatmessage)  toChatMessage

```
function toChatMessage(response: OpenResponsesNonStreamingResponse): AssistantMessage
```

Convert response to chat message format.

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#fromclaudemessages)  fromClaudeMessages

```
function fromClaudeMessages(messages: ClaudeMessageParam[]): OpenResponsesInput
```

Convert Anthropic Claude format to OpenResponses input.

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#toclaudemessage)  toClaudeMessage

```
function toClaudeMessage(response: OpenResponsesNonStreamingResponse): ClaudeMessage
```

Convert response to Claude message format.

* * *

## [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#type-utilities)  Type Utilities

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#infertoolinput)  InferToolInput

```
type InferToolInput<T> = T extends { function: { inputSchema: infer S } }
  ? S extends ZodType ? z.infer<S> : unknown
  : unknown;
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#infertooloutput)  InferToolOutput

```
type InferToolOutput<T> = T extends { function: { outputSchema: infer S } }
  ? S extends ZodType ? z.infer<S> : unknown
  : unknown;
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#infertoolevent)  InferToolEvent

```
type InferToolEvent<T> = T extends { function: { eventSchema: infer S } }
  ? S extends ZodType ? z.infer<S> : never
  : never;
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#typedtoolcall)  TypedToolCall

```
type TypedToolCall<T extends Tool> = {
  id: string;
  name: T extends { function: { name: infer N } } ? N : string;
  arguments: InferToolInput<T>;
};
```

* * *

## [​](https://openrouter.ai/docs/agent-sdk/call-model/api-reference\#exports)  Exports

```
// Agent client
export { OpenRouter } from '@openrouter/agent';

// Tool helpers
export {
  tool,
  ToolType,
  isManualTool,
  isHITLTool,
  isAutoResolvableTool,
} from '@openrouter/agent';

// Format helpers
export { fromChatMessages, toChatMessage, fromClaudeMessages, toClaudeMessage } from '@openrouter/agent';

// Stop condition helpers
export { stepCountIs, hasToolCall, maxTokensUsed, maxCost, finishReasonIs } from '@openrouter/agent';

// Context helpers
export {
  buildToolExecuteContext,
  ToolContextStore,
} from '@openrouter/agent';

// Types
export type {
  CallModelInput,
  ContextInput,
  Tool,
  ToolWithExecute,
  ToolWithGenerator,
  ManualTool,
  HITLTool,
  HITLToolFunction,
  ToolExecuteContext,
  ToolContextMap,
  TurnContext,
  ParsedToolCall,
  ToolExecutionResult,
  StopCondition,
  StopWhen,
  InferToolInput,
  InferToolOutput,
  InferToolEvent,
} from '@openrouter/agent';
```

See all 45 lines

[Working with Items](https://openrouter.ai/docs/agent-sdk/call-model/items) [Dynamic Parameters](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.