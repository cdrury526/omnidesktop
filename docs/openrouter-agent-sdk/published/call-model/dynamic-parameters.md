> ## Documentation Index
>
> Fetch the complete documentation index at: [/docs/llms.txt](https://openrouter.ai/docs/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters#content-area)

## [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#basic-usage)  Basic Usage

Any parameter in `callModel` can be a function that computes its value based on conversation context. This enables adaptive behavior - changing models, adjusting temperature, or modifying instructions as the conversation evolves.Pass a function instead of a static value:

```
import { OpenRouter } from '@openrouter/agent';

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const result = openrouter.callModel({
  // Dynamic model selection based on turn count
  model: (ctx) => {
    return ctx.numberOfTurns > 3 ? 'openai/gpt-5.2' : 'openai/gpt-5-nano';
  },
  input: 'Hello!',
  tools: [myTool],
});
```

## [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#function-signature)  Function Signature

Parameter functions receive a `TurnContext` and return the parameter value:

```
type ParameterFunction<T> = (context: TurnContext) => T | Promise<T>;
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#turncontext)  TurnContext

| Property | Type | Description |
| --- | --- | --- |
| `numberOfTurns` | `number` | Current turn number (1-indexed) |
| `turnRequest` | `OpenResponsesRequest | undefined` | Current request object containing messages and model settings |
| `toolCall` | `OpenResponsesFunctionToolCall | undefined` | The specific tool call being executed |

## [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#async-functions)  Async Functions

Functions can be async for fetching external data:

```
const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',

  // Fetch user preferences from database
  temperature: async (ctx) => {
    const prefs = await fetchUserPreferences(userId);
    return prefs.preferredTemperature ?? 0.7;
  },

  // Load dynamic instructions
  instructions: async (ctx) => {
    const rules = await fetchBusinessRules();
    return `Follow these rules:\n${rules.join('\n')}`;
  },

  input: 'Hello!',
});
```

## [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#common-patterns)  Common Patterns

### [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#progressive-model-upgrade)  Progressive Model Upgrade

Start with a fast model, upgrade for complex tasks:

```
const result = openrouter.callModel({
  model: (ctx) => {
    // First few turns: fast model
    if (ctx.numberOfTurns <= 2) {
      return 'openai/gpt-5-nano';
    }

    // Complex conversations: capable model
    return 'openai/gpt-5.2';
  },
  input: 'Let me think through this problem...',
  tools: [analysisTool],
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#adaptive-temperature)  Adaptive Temperature

Adjust creativity based on context:

```
const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  temperature: (ctx) => {
    // Analyze recent messages for task type
    const lastMessage = JSON.stringify(ctx.turnRequest?.input).toLowerCase();

    if (lastMessage.includes('creative') || lastMessage.includes('brainstorm')) {
      return 1.0; // Creative tasks
    }
    if (lastMessage.includes('code') || lastMessage.includes('calculate')) {
      return 0.2; // Precise tasks
    }
    return 0.7; // Default
  },
  input: 'Write a creative story',
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#context-aware-instructions)  Context-Aware Instructions

Build instructions based on conversation state:

```
const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  instructions: (ctx) => {
    const base = 'You are a helpful assistant.';
    const turnInfo = `This is turn ${ctx.numberOfTurns} of the conversation.`;

    // Add context based on history length
    if (ctx.numberOfTurns > 5) {
      return `${base}\n${turnInfo}\nKeep responses concise - this is a long conversation.`;
    }

    return `${base}\n${turnInfo}`;
  },
  input: 'Continue helping me...',
  tools: [helpTool],
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#dynamic-max-tokens)  Dynamic Max Tokens

Adjust output length based on task:

```
const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  maxOutputTokens: (ctx) => {
    const lastMessage = JSON.stringify(ctx.turnRequest?.input).toLowerCase();

    if (lastMessage.includes('summarize') || lastMessage.includes('brief')) {
      return 200;
    }
    if (lastMessage.includes('detailed') || lastMessage.includes('explain')) {
      return 2000;
    }
    return 500;
  },
  input: 'Give me a detailed explanation',
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#feature-flags)  Feature Flags

Enable features dynamically:

```
const result = openrouter.callModel({
  model: 'anthropic/claude-sonnet-4.5',

  // Enable thinking for complex turns
  provider: async (ctx) => {
    const enableThinking = ctx.numberOfTurns > 2;

    return enableThinking ? {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 1000 },
      },
    } : undefined;
  },

  input: 'Solve this complex problem',
  tools: [analysisTool],
});
```

## [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#combining-with-tools)  Combining with Tools

Dynamic parameters work alongside tool execution:

```
const smartAssistant = openrouter.callModel({
  // Upgrade model if tools have been used
  model: (ctx) => {
    const hasToolUse = JSON.stringify(ctx.turnRequest?.input).includes('function_call');
    return hasToolUse ? 'anthropic/claude-sonnet-4.5' : 'openai/gpt-5-nano';
  },

  // Lower temperature after tool execution
  temperature: (ctx) => {
    return ctx.numberOfTurns > 1 ? 0.3 : 0.7;
  },

  input: 'Research and analyze this topic',
  tools: [searchTool, analysisTool],
});
```

## [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#execution-order)  Execution Order

Dynamic parameters are resolved at the start of each turn:

```
1. Resolve all parameter functions with current TurnContext
2. Build request with resolved values
3. Send to model
4. Execute tools (if any)
5. Check stop conditions
6. Update TurnContext for next turn
7. Repeat from step 1
```

## [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#error-handling)  Error Handling

Handle errors in async parameter functions:

```
const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',

  instructions: async (ctx) => {
    try {
      const rules = await fetchRules();
      return `Follow these rules: ${rules}`;
    } catch (error) {
      // Fallback on error
      console.error('Failed to fetch rules:', error);
      return 'You are a helpful assistant.';
    }
  },

  input: 'Hello!',
});
```

## [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#best-practices)  Best Practices

### [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#keep-functions-pure)  Keep Functions Pure

Avoid side effects in parameter functions:

```
// Good: Pure function
model: (ctx) => ctx.numberOfTurns > 3 ? 'gpt-4' : 'gpt-4o-mini',

// Avoid: Side effects
model: (ctx) => {
  logToDatabase(ctx); // Side effect
  return 'gpt-4';
},
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#cache-expensive-operations)  Cache Expensive Operations

Cache results for repeated calls:

```
let cachedRules: string | null = null;

const result = openrouter.callModel({
  instructions: async (ctx) => {
    if (!cachedRules) {
      cachedRules = await fetchExpensiveRules();
    }
    return cachedRules;
  },
  input: 'Hello!',
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#use-sensible-defaults)  Use Sensible Defaults

Always have fallback values:

```
model: (ctx) => {
  const preferredModel = getPreferredModel();
  return preferredModel ?? 'openai/gpt-5-nano'; // Default fallback
},
```

## [​](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters\#see-also)  See Also

- **[nextTurnParams](https://openrouter.ai/docs/agent-sdk/call-model/next-turn-params)** \- Tool-driven parameter modification
- **[Stop Conditions](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions)** \- Dynamic execution control
- **[Tools](https://openrouter.ai/docs/agent-sdk/call-model/tools)** \- Multi-turn orchestration

[API Reference](https://openrouter.ai/docs/agent-sdk/call-model/api-reference) [Next Turn Params](https://openrouter.ai/docs/agent-sdk/call-model/next-turn-params)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.