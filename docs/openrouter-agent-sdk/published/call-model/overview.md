> ## Documentation Index
>
> Fetch the complete documentation index at: [/docs/llms.txt](https://openrouter.ai/docs/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://openrouter.ai/docs/agent-sdk/call-model/overview#content-area)

## [​](https://openrouter.ai/docs/agent-sdk/call-model/overview\#why-callmodel)  Why callModel?

- **Items-Based Model**: Built on OpenRouter’s Responses API with structured
items (messages, tool calls, reasoning) instead of raw message chunks
- **Multiple Consumption Patterns**: Get text, stream responses, or access
structured data - all from a single call
- **Automatic Tool Execution**: Define tools with Zod schemas and let the SDK
handle execution loops
- **Type Safety**: Full TypeScript inference for tool inputs, outputs, and
events
- **Format Compatibility**: Convert to/from OpenAI chat and Anthropic Claude
message formats
- **Streaming First**: Built on a reusable stream architecture that supports
concurrent consumers

## [​](https://openrouter.ai/docs/agent-sdk/call-model/overview\#quick-start)  Quick Start

```
import { OpenRouter } from '@openrouter/agent';

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'What is the capital of France?',
});

// Get text (simplest pattern)
const text = await result.getText();
console.log(text); // "The capital of France is Paris."
```

## [​](https://openrouter.ai/docs/agent-sdk/call-model/overview\#consumption-patterns)  Consumption Patterns

callModel returns a `ModelResult` object that provides multiple ways to consume
the response:

### [​](https://openrouter.ai/docs/agent-sdk/call-model/overview\#text-methods)  Text Methods

```
// Get just the text content
const text = await result.getText();

// Get the full response with usage data
const response = await result.getResponse();
console.log(response.usage); // { inputTokens, outputTokens, cachedTokens }
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/overview\#streaming-methods)  Streaming Methods

```
// Stream text deltas
for await (const delta of result.getTextStream()) {
  process.stdout.write(delta);
}

// Stream reasoning (for reasoning models)
for await (const delta of result.getReasoningStream()) {
  console.log('Reasoning:', delta);
}

// Stream complete items by ID (recommended)
for await (const item of result.getItemsStream()) {
  console.log('Item update:', item.type, item.id);
}

// Stream all events (including tool preliminary results)
for await (const event of result.getFullResponsesStream()) {
  console.log('Event:', event.type);
}
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/overview\#tool-methods)  Tool Methods

```
// Get all tool calls from the response
const toolCalls = await result.getToolCalls();

// Stream tool calls as they complete
for await (const toolCall of result.getToolCallsStream()) {
  console.log(`Tool: ${toolCall.name}`, toolCall.arguments);
}

// Stream tool deltas and preliminary results
for await (const event of result.getToolStream()) {
  if (event.type === 'delta') {
    process.stdout.write(event.content);
  } else if (event.type === 'preliminary_result') {
    console.log('Progress:', event.result);
  }
}
```

## [​](https://openrouter.ai/docs/agent-sdk/call-model/overview\#input-formats)  Input Formats

callModel accepts multiple input formats:

```
// Simple string
const result1 = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Hello!',
});

// Message array (OpenResponses format)
const result2 = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: [\
    { role: 'user', content: 'Hello!' },\
  ],
});

// With system instructions
const result3 = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  instructions: 'You are a helpful assistant.',
  input: 'Hello!',
});
```

## [​](https://openrouter.ai/docs/agent-sdk/call-model/overview\#what%E2%80%99s-next)  What’s Next?

Explore the guides to learn more about specific features:

- **[Working with Items](https://openrouter.ai/docs/agent-sdk/call-model/items)** \- Understand
the items-based streaming paradigm
- **[Text Generation](https://openrouter.ai/docs/agent-sdk/call-model/text-generation)** -
Input formats, model selection, and response handling
- **[Streaming](https://openrouter.ai/docs/agent-sdk/call-model/streaming)** \- All streaming
methods and patterns
- **[Tools](https://openrouter.ai/docs/agent-sdk/call-model/tools)** \- Creating typed tools
with Zod schemas and multi-turn orchestration
- **[nextTurnParams](https://openrouter.ai/docs/agent-sdk/call-model/next-turn-params)** -
Tool-driven context injection for skills and plugins
- **[Message Formats](https://openrouter.ai/docs/agent-sdk/call-model/message-formats)** -
Converting to/from OpenAI and Claude formats
- **[Dynamic Parameters](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters)**
\- Async functions for adaptive behavior
- **[Stop Conditions](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions)** -
Intelligent execution control
- **[API Reference](https://openrouter.ai/docs/agent-sdk/call-model/api-reference)** \- Complete
type definitions and method signatures

### [​](https://openrouter.ai/docs/agent-sdk/call-model/overview\#example-tools)  Example Tools

Ready-to-use tool implementations:

- **[Weather Tool](https://openrouter.ai/docs/agent-sdk/call-model/examples/weather-tool)** \- Basic API integration
- **[Skills Loader](https://openrouter.ai/docs/agent-sdk/call-model/examples/skills-loader)** \- Claude Code skills pattern

[Workspaces](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/workspaces) [Working with Items](https://openrouter.ai/docs/agent-sdk/call-model/items)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.