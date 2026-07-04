> ## Documentation Index
>
> Fetch the complete documentation index at: [/docs/llms.txt](https://openrouter.ai/docs/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions#content-area)

## [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#basic-usage)  Basic Usage

```
import { OpenRouter, stepCountIs } from '@openrouter/agent';

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Research this topic thoroughly',
  tools: [searchTool, analysisTool],
  stopWhen: stepCountIs(5), // Stop after 5 steps
});
```

## [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#built-in-stop-conditions)  Built-in Stop Conditions

### [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#stepcountis-n)  stepCountIs(n)

Stop after a specific number of steps:

```
import { stepCountIs } from '@openrouter/agent';

const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Analyze this data',
  tools: [analysisTool],
  stopWhen: stepCountIs(10), // Stop after 10 steps
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#hastoolcall-name)  hasToolCall(name)

Stop when a specific tool is called:

```
import { hasToolCall } from '@openrouter/agent';

const finishTool = tool({
  name: 'finish',
  description: 'Call this when the task is complete',
  inputSchema: z.object({
    summary: z.string(),
  }),
  execute: async (params) => ({ done: true }),
});

const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Research until you have enough information, then call finish',
  tools: [searchTool, finishTool],
  stopWhen: hasToolCall('finish'), // Stop when finish tool is called
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#maxtokensused-n)  maxTokensUsed(n)

Stop after using a certain number of tokens:

```
import { maxTokensUsed } from '@openrouter/agent';

const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Generate content',
  tools: [writingTool],
  stopWhen: maxTokensUsed(5000), // Stop after 5000 total tokens
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#maxcost-amount)  maxCost(amount)

Stop after reaching a cost threshold:

```
import { maxCost } from '@openrouter/agent';

const result = openrouter.callModel({
  model: 'openai/gpt-5.2',
  input: 'Perform extensive analysis',
  tools: [analysisTool],
  stopWhen: maxCost(1.00), // Stop after $1.00 spent
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#finishreasonis-reason)  finishReasonIs(reason)

Stop on a specific finish reason:

```
import { finishReasonIs } from '@openrouter/agent';

const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Complete this task',
  tools: [taskTool],
  stopWhen: finishReasonIs('stop'), // Stop when model finishes naturally
});
```

## [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#combining-conditions)  Combining Conditions

Pass an array to stop on any condition:

```
import { stepCountIs, hasToolCall, maxCost } from '@openrouter/agent';

const result = openrouter.callModel({
  model: 'openai/gpt-5.2',
  input: 'Research thoroughly but stay within budget',
  tools: [searchTool, finishTool],
  stopWhen: [\
    stepCountIs(10),        // Maximum 10 steps\
    maxCost(0.50),          // Maximum $0.50\
    hasToolCall('finish'),  // Or when finish is called\
  ],
});
```

Execution stops when **any** condition is met.

## [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#custom-stop-conditions)  Custom Stop Conditions

Create custom conditions with a function:

```
const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Process data',
  tools: [processTool],
  stopWhen: ({ steps }) => {
    // Stop after 20 steps
    if (steps.length >= 20) return true;

    // Stop if last step had no tool calls
    const lastStep = steps[steps.length - 1];
    if (lastStep && !lastStep.toolCalls?.length) return true;

    // Continue otherwise
    return false;
  },
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#stopconditioncontext)  StopConditionContext

Custom functions receive:

| Property | Type | Description |
| --- | --- | --- |
| `steps` | `StepResult[]` | All completed steps including results and usage |

### [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#stepresult)  StepResult

Each step contains:

```
interface StepResult {
  response: Response;
  toolCalls?: ParsedToolCall[];
  toolResults?: ToolExecutionResult[];
  tokens: {
    input: number;
    output: number;
    cached: number;
  };
  cost: number;
}
```

## [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#advanced-patterns)  Advanced Patterns

### [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#time-based-stopping)  Time-Based Stopping

Stop after a time limit:

```
const startTime = Date.now();
const maxDuration = 30000; // 30 seconds

const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Work on this task',
  tools: [workTool],
  stopWhen: () => {
    return Date.now() - startTime > maxDuration;
  },
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#content-based-stopping)  Content-Based Stopping

Stop based on response content:

```
const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Search until you find the answer',
  tools: [searchTool],
  stopWhen: ({ steps }) => {
    const lastStep = steps[steps.length - 1];
    if (!lastStep) return false;

    // Check if response contains certain keywords
    const content = JSON.stringify(lastStep.response);
    return content.includes('ANSWER FOUND') || content.includes('TASK COMPLETE');
  },
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#quality-based-stopping)  Quality-Based Stopping

Stop when results meet quality threshold:

```
const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Improve this text until it scores above 0.9',
  tools: [improverTool, scorerTool],
  stopWhen: ({ steps }) => {
    // Look for score in tool results
    for (const step of steps) {
      for (const result of step.toolResults ?? []) {
        if (result.toolName === 'scorer' && result.result?.score > 0.9) {
          return true;
        }
      }
    }
    return false;
  },
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#combination-with-early-exit)  Combination with Early Exit

Combine conditions for complex logic:

```
import { stepCountIs, maxCost } from '@openrouter/agent';

const result = openrouter.callModel({
  model: 'openai/gpt-5.2',
  input: 'Complex research task',
  tools: [searchTool, analysisTool, summarizeTool],
  stopWhen: [\
    // Hard limits\
    stepCountIs(50),\
    maxCost(5.00),\
\
    // Custom success condition\
    ({ steps }) => {\
      const lastStep = steps[steps.length - 1];\
      const hasSummary = lastStep?.toolCalls?.some(\
        tc => tc.name === 'summarize'\
      );\
      return hasSummary;\
    },\
  ],
});
```

See all 21 lines

## [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#migration-from-maxtoolrounds)  Migration from maxToolRounds

If you were using `maxToolRounds`, migrate to `stopWhen`:

```
// Before: maxToolRounds
const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Hello',
  tools: [myTool],
  maxToolRounds: 5,
});

// After: stopWhen
import { stepCountIs } from '@openrouter/agent';

const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Hello',
  tools: [myTool],
  stopWhen: stepCountIs(5),
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#default-behavior)  Default Behavior

If `stopWhen` is not specified, the default is `stepCountIs(5)`.

## [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#best-practices)  Best Practices

### [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#always-set-limits)  Always Set Limits

Always include a hard limit to prevent runaway execution:

```
stopWhen: [\
  stepCountIs(100),    // Hard limit\
  maxCost(10.00),      // Budget limit\
  customCondition,     // Your logic\
],
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#log-stop-reasons)  Log Stop Reasons

Track why execution stopped:

```
const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Task',
  tools: [taskTool],
  stopWhen: ({ steps }) => {
    if (steps.length >= 10) {
      console.log('Stopped: step limit');
      return true;
    }
    const totalCost = steps.reduce((sum, step) => sum + (step.cost ?? 0), 0);
    if (totalCost >= 1.00) {
      console.log('Stopped: cost limit');
      return true;
    }
    return false;
  },
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#test-conditions)  Test Conditions

Verify conditions work as expected:

```
// Test with low limits first
const testResult = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Test task',
  tools: [testTool],
  stopWhen: stepCountIs(2), // Low limit for testing
});
```

## [​](https://openrouter.ai/docs/agent-sdk/call-model/stop-conditions\#see-also)  See Also

- **[Tools](https://openrouter.ai/docs/agent-sdk/call-model/tools)** \- Multi-turn orchestration
- **[Dynamic Parameters](https://openrouter.ai/docs/agent-sdk/call-model/dynamic-parameters)** \- Adaptive behavior
- **[nextTurnParams](https://openrouter.ai/docs/agent-sdk/call-model/next-turn-params)** \- Tool-driven modifications

[Next Turn Params](https://openrouter.ai/docs/agent-sdk/call-model/next-turn-params) [Streaming](https://openrouter.ai/docs/agent-sdk/call-model/streaming)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.