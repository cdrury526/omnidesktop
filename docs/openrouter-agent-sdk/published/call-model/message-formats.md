> ## Documentation Index
>
> Fetch the complete documentation index at: [/docs/llms.txt](https://openrouter.ai/docs/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://openrouter.ai/docs/agent-sdk/call-model/message-formats#content-area)

## [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#openai-chat-format)  OpenAI Chat Format

### [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#fromchatmessages)  fromChatMessages()

Convert OpenAI chat-style messages to OpenResponses input:

```
import { OpenRouter, fromChatMessages } from '@openrouter/agent';

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// OpenAI chat format
const chatMessages = [\
  { role: 'system', content: 'You are a helpful assistant.' },\
  { role: 'user', content: 'Hello!' },\
  { role: 'assistant', content: 'Hi there! How can I help you?' },\
  { role: 'user', content: 'What is the weather like?' },\
];

const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: fromChatMessages(chatMessages),
});

const text = await result.getText();
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#tochatmessage)  toChatMessage()

Convert an OpenResponses response to chat message format:

```
import { toChatMessage } from '@openrouter/agent';

const result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: 'Hello!',
});

const response = await result.getResponse();
const chatMessage = toChatMessage(response);

// chatMessage is now: { role: 'assistant', content: '...' }
console.log(chatMessage.role);    // 'assistant'
console.log(chatMessage.content); // Response text
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#supported-message-types)  Supported Message Types

| Chat Role | Description |
| --- | --- |
| `system` | System instructions |
| `user` | User messages |
| `assistant` | Assistant responses |
| `developer` | Developer instructions |
| `tool` | Tool response messages |

### [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#tool-messages)  Tool Messages

Tool responses are converted to function call outputs:

```
const chatMessages = [\
  { role: 'user', content: 'What is the weather?' },\
  {\
    role: 'assistant',\
    content: null,\
    tool_calls: [{\
      id: 'call_123',\
      type: 'function',\
      function: { name: 'get_weather', arguments: '{"location":"Paris"}' },\
    }],\
  },\
  {\
    role: 'tool',\
    tool_call_id: 'call_123',\
    content: '{"temperature": 20}',\
  },\
];

const input = fromChatMessages(chatMessages);
```

## [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#anthropic-claude-format)  Anthropic Claude Format

### [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#fromclaudemessages)  fromClaudeMessages()

Convert Anthropic Claude-style messages to OpenResponses input:

```
import { OpenRouter, fromClaudeMessages } from '@openrouter/agent';

// Claude format
const claudeMessages = [\
  { role: 'user', content: 'Hello!' },\
  { role: 'assistant', content: 'Hi there!' },\
  { role: 'user', content: 'Tell me about TypeScript.' },\
];

const result = openrouter.callModel({
  model: 'anthropic/claude-sonnet-4.5',
  input: fromClaudeMessages(claudeMessages),
});
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#toclaudemessage)  toClaudeMessage()

Convert an OpenResponses response to Claude message format:

```
import { toClaudeMessage } from '@openrouter/agent';

const result = openrouter.callModel({
  model: 'anthropic/claude-sonnet-4.5',
  input: 'Hello!',
});

const response = await result.getResponse();
const claudeMessage = toClaudeMessage(response);

// Compatible with Anthropic SDK types
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#content-blocks)  Content Blocks

Claude’s content block format is supported:

```
const claudeMessages = [\
  {\
    role: 'user',\
    content: [\
      { type: 'text', text: 'What is in this image?' },\
      {\
        type: 'image',\
        source: {\
          type: 'url',\
          url: 'https://example.com/image.jpg',\
        },\
      },\
    ],\
  },\
];

const input = fromClaudeMessages(claudeMessages);
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#tool-use-blocks)  Tool Use Blocks

Claude’s tool use format is converted:

```
const claudeMessages = [\
  { role: 'user', content: 'What is the weather?' },\
  {\
    role: 'assistant',\
    content: [\
      {\
        type: 'tool_use',\
        id: 'tool_123',\
        name: 'get_weather',\
        input: { location: 'Paris' },\
      },\
    ],\
  },\
  {\
    role: 'user',\
    content: [\
      {\
        type: 'tool_result',\
        tool_use_id: 'tool_123',\
        content: '{"temperature": 20}',\
      },\
    ],\
  },\
];

const input = fromClaudeMessages(claudeMessages);
```

See all 26 lines

### [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#base64-images)  Base64 Images

Both URL and base64 images are supported:

```
const claudeMessages = [\
  {\
    role: 'user',\
    content: [\
      { type: 'text', text: 'Describe this image.' },\
      {\
        type: 'image',\
        source: {\
          type: 'base64',\
          media_type: 'image/png',\
          data: 'iVBORw0KGgo...',\
        },\
      },\
    ],\
  },\
];
```

### [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#limitations)  Limitations

Some Claude features are not preserved in conversion.
e.g. `is_error` flag on tool\_result blocksThese features are Claude-specific and not supported by OpenRouter.

## [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#migration-examples)  Migration Examples

### [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#from-openai-sdk)  From OpenAI SDK

```
// Before: OpenAI SDK
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [\
    { role: 'system', content: 'You are helpful.' },\
    { role: 'user', content: 'Hello!' },\
  ],
});

// After: OpenRouter SDK
import { OpenRouter, fromChatMessages } from '@openrouter/agent';

const openrouter = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const result = openrouter.callModel({
  model: 'openai/gpt-5.2',
  input: fromChatMessages([\
    { role: 'system', content: 'You are helpful.' },\
    { role: 'user', content: 'Hello!' },\
  ]),
});

const text = await result.getText();
```

See all 25 lines

### [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#from-anthropic-sdk)  From Anthropic SDK

```
// Before: Anthropic SDK
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();
const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [\
    { role: 'user', content: 'Hello!' },\
  ],
});

// After: OpenRouter SDK
import { OpenRouter, fromClaudeMessages } from '@openrouter/agent';

const openrouter = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const result = openrouter.callModel({
  model: 'anthropic/claude-sonnet-4.5',
  input: fromClaudeMessages([\
    { role: 'user', content: 'Hello!' },\
  ]),
  maxOutputTokens: 1024,
});

const text = await result.getText();
```

See all 25 lines

## [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#building-conversations)  Building Conversations

Accumulate messages across multiple calls:

```
import { fromChatMessages, toChatMessage } from '@openrouter/agent';

// Start with initial message
let messages = [\
  { role: 'system', content: 'You are a helpful assistant.' },\
  { role: 'user', content: 'Hello!' },\
];

// First call
let result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: fromChatMessages(messages),
});

let response = await result.getResponse();
let assistantMessage = toChatMessage(response);

// Add to history
messages.push(assistantMessage);
messages.push({ role: 'user', content: 'What can you help me with?' });

// Continue conversation
result = openrouter.callModel({
  model: 'openai/gpt-5-nano',
  input: fromChatMessages(messages),
});
```

See all 26 lines

## [​](https://openrouter.ai/docs/agent-sdk/call-model/message-formats\#next-steps)  Next Steps

- **[Text Generation](https://openrouter.ai/docs/agent-sdk/call-model/text-generation)** \- Input formats and parameters
- **[Tools](https://openrouter.ai/docs/agent-sdk/call-model/tools)** \- Add tool capabilities
- **[Streaming](https://openrouter.ai/docs/agent-sdk/call-model/streaming)** \- Stream format-converted responses

[Text Generation](https://openrouter.ai/docs/agent-sdk/call-model/text-generation) [Tools](https://openrouter.ai/docs/agent-sdk/call-model/tools)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.