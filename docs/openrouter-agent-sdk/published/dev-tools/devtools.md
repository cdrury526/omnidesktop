> ## Documentation Index
>
> Fetch the complete documentation index at: [/docs/llms.txt](https://openrouter.ai/docs/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools#content-area)

The DevTools SDK and CLI are currently in pre-release status. DevTools is designed for development use only and should never be deployed in production environments.

The OpenRouter DevTools provide a comprehensive solution for SDK telemetry capture and visualization during development. Monitor your AI application’s requests, responses, token usage, and errors in real-time with a beautiful web interface.

## [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#why-use-devtools)  Why use DevTools?

Building with AI SDKs requires visibility into what’s happening under the hood. The OpenRouter DevTools give you complete insight into your SDK operations without adding complexity or impacting performance.**Two main components:**

1. **SDK Telemetry Hooks** \- Automatically capture all SDK operations in development
2. **DevTools Viewer** \- Beautiful web UI for visualizing captured telemetry data

## [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#key-features)  Key Features

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#sdk-devtools-viewer)  SDK DevTools Viewer

Launch a web-based interface to visualize your SDK telemetry:

- **Real-time run tracking** \- View all SDK operations (chat, embeddings, etc.) as they happen
- **Detailed step analysis** \- Inspect request/response data, timing, and errors for each step
- **Token usage insights** \- Track prompt and completion tokens across all requests
- **Error debugging** \- Easily identify and debug failed requests with full error details
- **Multi-run comparison** \- Compare different SDK runs side-by-side
- **Dark/Light mode** \- Full theme support with automatic system preference detection

![DevTools Interface](https://mintcdn.com/openrouter-d02e98a0/PSwwwiCqAD_BNeni/assets/sdk-devtools-dark.png?fit=max&auto=format&n=PSwwwiCqAD_BNeni&q=85&s=31e8a7d3861f46564eed7f30b6c8579b)

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#sdk-telemetry-hooks)  SDK Telemetry Hooks

Developer-friendly hooks that automatically capture:

- All chat completions with full request/response data
- Token usage and costs
- Timing information for performance analysis
- Errors and failure modes
- Tool/function calls
- Current directory, git branch, and model information

## [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#installation)  Installation

Install the DevTools package as a development dependency:

```
npm install @openrouter/devtools --save-dev
```

**Important:** DevTools is designed for development only. It will throw an error if `NODE_ENV === 'production'` to prevent accidental production deployment.

## [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#quick-start-sdk-hooks)  Quick Start - SDK Hooks

Integrate DevTools hooks into your SDK client to start capturing telemetry:

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#basic-usage)  Basic Usage

```
import { createOpenRouterDevtools } from '@openrouter/devtools';
import { OpenRouter } from '@openrouter/sdk';

const sdk = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  hooks: createOpenRouterDevtools()
});

// Now all SDK operations are automatically captured
const response = await sdk.chat.send({
  model: "openai/gpt-5",
  messages: [\
    { role: "user", content: "Explain quantum computing" }\
  ]
});
```

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#custom-configuration)  Custom Configuration

```
const sdk = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  hooks: createOpenRouterDevtools({
    storagePath: '.custom-path/generations.json',  // Default: '.devtools/openrouter-generations.json'
    serverUrl: 'http://localhost:5000/api/notify', // Default: 'http://localhost:4983/api/notify'
  })
});
```

## [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#quick-start-devtools-viewer)  Quick Start - DevTools Viewer

Launch the DevTools web interface to visualize captured telemetry:

```
openrouter devtools
```

This starts a local server on port 4983 and opens your browser to view:

- All SDK runs with timestamps and status
- Step-by-step request/response details
- Token usage and costs
- Error messages and stack traces
- Performance timing information

The viewer automatically refreshes when new telemetry data is captured.

## [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#how-it-works)  How It Works

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#telemetry-capture-flow)  Telemetry Capture Flow

1. SDK hooks intercept requests before they’re sent
2. Telemetry data is captured asynchronously (non-blocking)
3. Data is stored in `.devtools/openrouter-generations.json`
4. A notification is sent to the local DevTools server (if running)
5. The DevTools viewer updates in real-time

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#non-intrusive-design)  Non-Intrusive Design

- **Zero SDK impact** \- Telemetry capture is async and never blocks SDK operations
- **Graceful degradation** \- Errors in DevTools never break your SDK calls
- **Development-only** \- Throws error if used in production (`NODE_ENV === 'production'`)

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#storage-location)  Storage Location

By default, telemetry is stored in:

```
.devtools/openrouter-generations.json
```

This file contains:

- **Runs** \- Top-level tracking of SDK operations
- **Steps** \- Individual request/response pairs within each run
- **Metadata** \- Timestamps, status, token usage, errors

## [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#configuration-options)  Configuration Options

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#hook-configuration)  Hook Configuration

When calling `createOpenRouterDevtools()`, you can customize:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `storagePath` | `string` | `'.devtools/openrouter-generations.json'` | Where to store captured telemetry |
| `serverUrl` | `string` | `'http://localhost:4983/api/notify'` | DevTools server notification endpoint |

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#devtools-server-configuration)  DevTools Server Configuration

The DevTools viewer runs on port 4983 by default. This can be configured in your OpenRouter CLI configuration at `~/.openrouter/claude-code-proxy.json`:

```
{
  "DEVTOOLS_PORT": 4983
}
```

## [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#operations-captured)  Operations Captured

The DevTools hooks automatically capture these SDK operations:

- `chat.send()` \- Chat completions API calls
- `chat.createResponses()` \- Responses API calls
- `embeddings.create()` \- Embeddings API calls

All other SDK operations are currently ignored.

## [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#data-captured-per-step)  Data Captured Per Step

For each SDK operation, DevTools captures:**Request Data:**

- Model name
- Messages/prompts
- Parameters (temperature, max\_tokens, etc.)

**Response Data:**

- Generated content
- Token usage (prompt + completion tokens)
- Provider and model used
- Finish reason
- Tool calls (if any)

**Metadata:**

- Start and completion timestamps
- Duration in milliseconds
- Status (success, error, in\_progress)
- Error details (if failed)

## [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#safety-&-best-practices)  Safety & Best Practices

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#production-environment-protection)  Production Environment Protection

DevTools will throw an error if initialized when `NODE_ENV === 'production'`:

```
// This will throw an error in production
const sdk = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  hooks: createOpenRouterDevtools() // ERROR in production!
});
```

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#non-blocking-architecture)  Non-Blocking Architecture

- All telemetry capture happens asynchronously
- DevTools errors never propagate to your SDK calls
- Failed writes are logged but don’t break your application

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#error-handling)  Error Handling

DevTools failures are handled gracefully:

```
// If DevTools fails, your SDK call still works
try {
  await sdk.chat.send({ /* ... */ });
  // SDK call succeeds even if DevTools capture fails
} catch (error) {
  // Only SDK errors are thrown, never DevTools errors
}
```

## [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#troubleshooting)  Troubleshooting

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#port-already-in-use)  Port Already in Use

If port 4983 is already in use:

```
Error: listen EADDRINUSE: address already in use :::4983
```

**Solution:** Either stop the process using port 4983, or configure a different port in `~/.openrouter/claude-code-proxy.json`:

```
{
  "DEVTOOLS_PORT": 5000
}
```

Then update your hook configuration:

```
hooks: createOpenRouterDevtools({
  serverUrl: 'http://localhost:5000/api/notify'
})
```

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#storage-location-issues)  Storage Location Issues

If you can’t find the telemetry file:

1. Check the default location: `.devtools/openrouter-generations.json`
2. Ensure you have write permissions in your working directory
3. Check for custom `storagePath` configuration

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#devtools-viewer-not-updating)  DevTools Viewer Not Updating

If the viewer doesn’t show new requests:

1. Verify the DevTools server is running (`openrouter devtools`)
2. Check that `serverUrl` matches the DevTools server port
3. Ensure the telemetry file is being written (check `.devtools/` directory)
4. Try refreshing the browser manually

### [​](https://openrouter.ai/docs/agent-sdk/dev-tools/devtools\#common-setup-issues)  Common Setup Issues

**Issue:** DevTools package not found

```
Cannot find module '@openrouter/devtools'
```

**Solution:** Install the package:

```
npm install @openrouter/devtools --save-dev
```

* * *

**Issue:** Accidental production usage

```
Error: DevTools should not be used in production
```

**Solution:** Only initialize DevTools in development:

```
const hooks = process.env.NODE_ENV === 'development'
  ? createOpenRouterDevtools()
  : undefined;

const sdk = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  hooks
});
```

[Skills Loader](https://openrouter.ai/docs/agent-sdk/call-model/examples/skills-loader) [Migrating to @openrouter/agent](https://openrouter.ai/docs/agent-sdk/agent-migration)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.

![DevTools Interface](https://mintcdn.com/openrouter-d02e98a0/PSwwwiCqAD_BNeni/assets/sdk-devtools-dark.png?w=1100&fit=max&auto=format&n=PSwwwiCqAD_BNeni&q=85&s=e5f01aa4fd53c82d98132421d5cd9ac6)