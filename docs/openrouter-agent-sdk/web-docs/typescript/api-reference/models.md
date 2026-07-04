> ## Documentation Index
>
> Fetch the complete documentation index at: [/docs/llms.txt](https://openrouter.ai/docs/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models#content-area)

The TypeScript SDK and docs are currently in beta.
Report issues on [GitHub](https://github.com/OpenRouterTeam/typescript-sdk/issues).

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#overview)  Overview

Model information endpoints

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#available-operations)  Available Operations

- [list](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models#list) \- List all models and their properties
- [count](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models#count) \- Get total count of available models
- [listForUser](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models#listforuser) \- List models filtered by user provider preferences, privacy settings, and guardrails

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#list)  list

List all models and their properties

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#example-usage)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.models.list();

  console.log(result);
}

run();
```

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#standalone-function)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { modelsList } from "@openrouter/sdk/funcs/modelsList.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await modelsList(openRouter);
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("modelsList failed:", res.error);
  }
}

run();
```

See all 23 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#parameters)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.GetModelsRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/getmodelsrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#response)  Response

**Promise< [models.ModelsListResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models/modelslistresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#errors)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.BadRequestResponseError | 400 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#count)  count

Get total count of available models

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#example-usage-2)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.models.count();

  console.log(result);
}

run();
```

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#standalone-function-2)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { modelsCount } from "@openrouter/sdk/funcs/modelsCount.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await modelsCount(openRouter);
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("modelsCount failed:", res.error);
  }
}

run();
```

See all 23 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#parameters-2)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.ListModelsCountRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/listmodelscountrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#response-2)  Response

**Promise< [models.ModelsCountResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models/modelscountresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#errors-2)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.BadRequestResponseError | 400 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#listforuser)  listForUser

List models filtered by user provider preferences, [privacy settings](https://openrouter.ai/docs/guides/privacy/provider-logging), and [guardrails](https://openrouter.ai/docs/guides/features/guardrails). If requesting through `eu.openrouter.ai/api/v1/...` the results will be filtered to models that satisfy [EU in-region routing](https://openrouter.ai/docs/guides/privacy/provider-logging#enterprise-eu-in-region-routing).

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#example-usage-3)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
});

async function run() {
  const result = await openRouter.models.listForUser({
    bearer: process.env["OPENROUTER_BEARER"] ?? "",
  });

  console.log(result);
}

run();
```

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#standalone-function-3)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { modelsListForUser } from "@openrouter/sdk/funcs/modelsListForUser.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
});

async function run() {
  const res = await modelsListForUser(openRouter, {
    bearer: process.env["OPENROUTER_BEARER"] ?? "",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("modelsListForUser failed:", res.error);
  }
}

run();
```

See all 24 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#parameters-3)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.ListModelsUserRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/listmodelsuserrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `security` | [operations.ListModelsUserSecurity](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/listmodelsusersecurity) | :heavy\_check\_mark: | The security requirements to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#response-3)  Response

**Promise< [models.ModelsListResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models/modelslistresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models\#errors-3)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.UnauthorizedResponseError | 401 | application/json |
| errors.NotFoundResponseError | 404 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

[Guardrails](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails) [OAuth](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.