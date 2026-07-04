For AI agents: a documentation index is available at the root level at /llms.txt. Append /llms.txt to any URL for a page-level index, or .md for the markdown version of any page.

The Agent SDK (`@openrouter/agent`) provides the primitives you need to build agentic applications on OpenRouter. Instead of manually wiring up conversation loops, tool dispatch, and state tracking, the Agent SDK handles all of that so you can focus on defining _what_ your agent does.

The Agent SDK is built to work alongside the [Client SDKs](https://openrouter.ai/docs/client-sdks/overview). Installing `@openrouter/agent` automatically includes the Client SDKs as well, but each package can work independently.

## When to use the Agent SDK

Choose the Agent SDK when you need **agentic behavior** — multi-step reasoning where the model calls tools, processes results, and decides what to do next:

- **Multi-turn agent loops** — `callModel` automatically loops until a stop condition is met
- **Tool definitions** — define tools with the `tool()` helper and the SDK executes them for you
- **Stop conditions** — control when the loop ends with `stepCountIs`, `hasToolCall`, `maxCost`, and more
- **Conversation state** — the SDK tracks messages, tool results, and context across turns
- **Streaming** — real-time token output within each agent step
- **Dynamic parameters** — change model, temperature, or tools between turns based on context

If you only need simple request/response calls to a model without agent loops, the [Client SDKs](https://openrouter.ai/docs/client-sdks/overview) are a lighter-weight option.

## Installation

npmpnpmyarn

```
npm install @openrouter/agent
```

## Quick example

```
import { callModel, tool } from '@openrouter/agent';
import { z } from 'zod';

const weatherTool = tool({
  name: 'get_weather',
  description: 'Get the current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
  }),
  execute: async ({ location }) => {
    return { temperature: 72, condition: 'sunny', location };
  },
});

const result = await callModel({
  model: 'anthropic/claude-sonnet-4',
  messages: [\
    { role: 'user', content: 'What is the weather in San Francisco?' },\
  ],
  tools: [weatherTool],
});

const text = await result.getText();
console.log(text);
```

The SDK sends the message to the model, receives a tool call, executes `get_weather`, feeds the result back, and returns the final response — all in one `callModel` invocation.

## Core concepts

### `callModel`

The main entry point. It runs an inference loop that:

1. Sends messages to the model
2. If the model returns tool calls, executes them automatically
3. Appends tool results to the conversation
4. Repeats until a stop condition is met or no more tool calls are made

See the [Call Model documentation](https://openrouter.ai/docs/agent-sdk/call-model) for the full API.

### Tools

Define tools with the `tool()` helper. Each tool has a name, description, Zod parameter schema, and an `execute` function. The SDK handles serialization, validation, and dispatch.

```
import { tool } from '@openrouter/agent';
import { z } from 'zod';

const searchTool = tool({
  name: 'search',
  description: 'Search the web',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    // Your search implementation
    return { results: ['...'] };
  },
});
```

### Stop conditions

Control when the agent loop terminates:

```
import { callModel, stepCountIs, maxCost } from '@openrouter/agent';

const result = await callModel({
  model: 'anthropic/claude-sonnet-4',
  messages: [{ role: 'user', content: 'Research this topic thoroughly' }],
  tools: [searchTool],
  stopWhen: [stepCountIs(10), maxCost(0.50)],
});
```

## Agent SDK vs Client SDKs

|  | Agent SDK | Client SDKs |
| --- | --- | --- |
| **Focus** | Agentic primitives — multi-turn loops, tools, stop conditions | Lean API client — mirrors the REST API with full type safety |
| **Use when** | You want built-in agent loops, tool execution, and state management | You want direct model calls and manage orchestration yourself |
| **Conversation state** | Managed for you via `callModel` | You manage it |
| **Tool execution** | Automatic with the `tool()` helper | You dispatch tool calls |
| **Languages** | TypeScript | TypeScript, Python, Go |

## Next steps

- [Call Model](https://openrouter.ai/docs/agent-sdk/call-model) — the complete `callModel` API reference
- [Tools](https://openrouter.ai/docs/agent-sdk/call-model/tools) — defining and using tools
- [Stop Conditions](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions) — controlling agent loop termination
- [Streaming](https://openrouter.ai/docs/agent-sdk/call-model/streaming) — real-time token output
- [DevTools](https://openrouter.ai/docs/agent-sdk/devtools) — telemetry capture and visualization for development
- [Migrating from @openrouter/sdk](https://openrouter.ai/docs/agent-sdk/agent-migration) — move agent imports to the standalone package

Ask AI

Assistant

Responses are generated using AI and may contain mistakes.

Hi, I'm an AI assistant with access to documentation and other content.

Tip: You can toggle this pane with

`⌘`

+

`/`