> ## Documentation Index
>
> Fetch the complete documentation index at: [/docs/llms.txt](https://openrouter.ai/docs/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails#content-area)

The TypeScript SDK and docs are currently in beta.
Report issues on [GitHub](https://github.com/OpenRouterTeam/typescript-sdk/issues).

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#overview)  Overview

Guardrails endpoints

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#available-operations)  Available Operations

- [list](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails#list) \- List guardrails
- [create](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails#create) \- Create a guardrail
- [delete](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails#delete) \- Delete a guardrail
- [get](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails#get) \- Get a guardrail
- [update](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails#update) \- Update a guardrail
- [listGuardrailKeyAssignments](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails#listguardrailkeyassignments) \- List key assignments for a guardrail
- [bulkAssignKeys](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails#bulkassignkeys) \- Bulk assign keys to a guardrail
- [bulkUnassignKeys](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails#bulkunassignkeys) \- Bulk unassign keys from a guardrail
- [listGuardrailMemberAssignments](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails#listguardrailmemberassignments) \- List member assignments for a guardrail
- [bulkAssignMembers](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails#bulkassignmembers) \- Bulk assign members to a guardrail
- [bulkUnassignMembers](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails#bulkunassignmembers) \- Bulk unassign members from a guardrail
- [listKeyAssignments](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails#listkeyassignments) \- List all key assignments
- [listMemberAssignments](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails#listmemberassignments) \- List all member assignments

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#list)  list

List all guardrails for the authenticated user. [Management key](https://openrouter.ai/docs/guides/overview/auth/management-api-keys) required.

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#example-usage)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.guardrails.list();

  for await (const page of result) {
    console.log(page);
  }
}

run();
```

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#standalone-function)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { guardrailsList } from "@openrouter/sdk/funcs/guardrailsList.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await guardrailsList(openRouter);
  if (res.ok) {
    const { value: result } = res;
    for await (const page of result) {
    console.log(page);
  }
  } else {
    console.log("guardrailsList failed:", res.error);
  }
}

run();
```

See all 25 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#parameters)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.ListGuardrailsRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/listguardrailsrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#response)  Response

**Promise< [operations.ListGuardrailsResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/listguardrailsresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#errors)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.UnauthorizedResponseError | 401 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#create)  create

Create a new guardrail for the authenticated user. [Management key](https://openrouter.ai/docs/guides/overview/auth/management-api-keys) required.

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#example-usage-2)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.guardrails.create({
    createGuardrailRequest: {
      allowedModels: null,
      allowedProviders: [\
        "openai",\
        "anthropic",\
        "deepseek",\
      ],
      description: "A guardrail for limiting API usage",
      enforceZdrAnthropic: true,
      enforceZdrGoogle: false,
      enforceZdrOpenai: true,
      enforceZdrOther: false,
      ignoredModels: null,
      ignoredProviders: null,
      limitUsd: 50,
      name: "My New Guardrail",
      resetInterval: "monthly",
    },
  });

  console.log(result);
}

run();
```

See all 35 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#standalone-function-2)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { guardrailsCreate } from "@openrouter/sdk/funcs/guardrailsCreate.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await guardrailsCreate(openRouter, {
    createGuardrailRequest: {
      allowedModels: null,
      allowedProviders: [\
        "openai",\
        "anthropic",\
        "deepseek",\
      ],
      description: "A guardrail for limiting API usage",
      enforceZdrAnthropic: true,
      enforceZdrGoogle: false,
      enforceZdrOpenai: true,
      enforceZdrOther: false,
      ignoredModels: null,
      ignoredProviders: null,
      limitUsd: 50,
      name: "My New Guardrail",
      resetInterval: "monthly",
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("guardrailsCreate failed:", res.error);
  }
}

run();
```

See all 42 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#parameters-2)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.CreateGuardrailRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/createguardrailrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#response-2)  Response

**Promise< [models.CreateGuardrailResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models/createguardrailresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#errors-2)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.BadRequestResponseError | 400 | application/json |
| errors.UnauthorizedResponseError | 401 | application/json |
| errors.ForbiddenResponseError | 403 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#delete)  delete

Delete an existing guardrail. [Management key](https://openrouter.ai/docs/guides/overview/auth/management-api-keys) required.

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#example-usage-3)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.guardrails.delete({
    id: "550e8400-e29b-41d4-a716-446655440000",
  });

  console.log(result);
}

run();
```

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#standalone-function-3)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { guardrailsDelete } from "@openrouter/sdk/funcs/guardrailsDelete.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await guardrailsDelete(openRouter, {
    id: "550e8400-e29b-41d4-a716-446655440000",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("guardrailsDelete failed:", res.error);
  }
}

run();
```

See all 25 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#parameters-3)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.DeleteGuardrailRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/deleteguardrailrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#response-3)  Response

**Promise< [models.DeleteGuardrailResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models/deleteguardrailresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#errors-3)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.UnauthorizedResponseError | 401 | application/json |
| errors.NotFoundResponseError | 404 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#get)  get

Get a single guardrail by ID. [Management key](https://openrouter.ai/docs/guides/overview/auth/management-api-keys) required.

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#example-usage-4)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.guardrails.get({
    id: "550e8400-e29b-41d4-a716-446655440000",
  });

  console.log(result);
}

run();
```

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#standalone-function-4)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { guardrailsGet } from "@openrouter/sdk/funcs/guardrailsGet.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await guardrailsGet(openRouter, {
    id: "550e8400-e29b-41d4-a716-446655440000",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("guardrailsGet failed:", res.error);
  }
}

run();
```

See all 25 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#parameters-4)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.GetGuardrailRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/getguardrailrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#response-4)  Response

**Promise< [models.GetGuardrailResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models/getguardrailresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#errors-4)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.UnauthorizedResponseError | 401 | application/json |
| errors.NotFoundResponseError | 404 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#update)  update

Update an existing guardrail. [Management key](https://openrouter.ai/docs/guides/overview/auth/management-api-keys) required.

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#example-usage-5)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.guardrails.update({
    id: "550e8400-e29b-41d4-a716-446655440000",
    updateGuardrailRequest: {
      description: "Updated description",
      limitUsd: 75,
      name: "Updated Guardrail Name",
      resetInterval: "weekly",
    },
  });

  console.log(result);
}

run();
```

See all 24 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#standalone-function-5)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { guardrailsUpdate } from "@openrouter/sdk/funcs/guardrailsUpdate.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await guardrailsUpdate(openRouter, {
    id: "550e8400-e29b-41d4-a716-446655440000",
    updateGuardrailRequest: {
      description: "Updated description",
      limitUsd: 75,
      name: "Updated Guardrail Name",
      resetInterval: "weekly",
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("guardrailsUpdate failed:", res.error);
  }
}

run();
```

See all 31 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#parameters-5)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.UpdateGuardrailRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/updateguardrailrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#response-5)  Response

**Promise< [models.UpdateGuardrailResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models/updateguardrailresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#errors-5)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.BadRequestResponseError | 400 | application/json |
| errors.UnauthorizedResponseError | 401 | application/json |
| errors.NotFoundResponseError | 404 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#listguardrailkeyassignments)  listGuardrailKeyAssignments

List all API key assignments for a specific guardrail. [Management key](https://openrouter.ai/docs/guides/overview/auth/management-api-keys) required.

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#example-usage-6)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.guardrails.listGuardrailKeyAssignments({
    id: "550e8400-e29b-41d4-a716-446655440000",
  });

  for await (const page of result) {
    console.log(page);
  }
}

run();
```

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#standalone-function-6)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { guardrailsListGuardrailKeyAssignments } from "@openrouter/sdk/funcs/guardrailsListGuardrailKeyAssignments.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await guardrailsListGuardrailKeyAssignments(openRouter, {
    id: "550e8400-e29b-41d4-a716-446655440000",
  });
  if (res.ok) {
    const { value: result } = res;
    for await (const page of result) {
    console.log(page);
  }
  } else {
    console.log("guardrailsListGuardrailKeyAssignments failed:", res.error);
  }
}

run();
```

See all 27 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#parameters-6)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.ListGuardrailKeyAssignmentsRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/listguardrailkeyassignmentsrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#response-6)  Response

**Promise< [operations.ListGuardrailKeyAssignmentsResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/listguardrailkeyassignmentsresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#errors-6)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.UnauthorizedResponseError | 401 | application/json |
| errors.NotFoundResponseError | 404 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#bulkassignkeys)  bulkAssignKeys

Assign multiple API keys to a specific guardrail. [Management key](https://openrouter.ai/docs/guides/overview/auth/management-api-keys) required.

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#example-usage-7)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.guardrails.bulkAssignKeys({
    id: "550e8400-e29b-41d4-a716-446655440000",
    bulkAssignKeysRequest: {
      keyHashes: [\
        "c56454edb818d6b14bc0d61c46025f1450b0f4012d12304ab40aacb519fcbc93",\
      ],
    },
  });

  console.log(result);
}

run();
```

See all 23 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#standalone-function-7)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { guardrailsBulkAssignKeys } from "@openrouter/sdk/funcs/guardrailsBulkAssignKeys.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await guardrailsBulkAssignKeys(openRouter, {
    id: "550e8400-e29b-41d4-a716-446655440000",
    bulkAssignKeysRequest: {
      keyHashes: [\
        "c56454edb818d6b14bc0d61c46025f1450b0f4012d12304ab40aacb519fcbc93",\
      ],
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("guardrailsBulkAssignKeys failed:", res.error);
  }
}

run();
```

See all 30 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#parameters-7)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.BulkAssignKeysToGuardrailRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/bulkassignkeystoguardrailrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#response-7)  Response

**Promise< [models.BulkAssignKeysResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models/bulkassignkeysresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#errors-7)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.BadRequestResponseError | 400 | application/json |
| errors.UnauthorizedResponseError | 401 | application/json |
| errors.NotFoundResponseError | 404 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#bulkunassignkeys)  bulkUnassignKeys

Unassign multiple API keys from a specific guardrail. [Management key](https://openrouter.ai/docs/guides/overview/auth/management-api-keys) required.

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#example-usage-8)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.guardrails.bulkUnassignKeys({
    id: "550e8400-e29b-41d4-a716-446655440000",
    bulkUnassignKeysRequest: {
      keyHashes: [\
        "c56454edb818d6b14bc0d61c46025f1450b0f4012d12304ab40aacb519fcbc93",\
      ],
    },
  });

  console.log(result);
}

run();
```

See all 23 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#standalone-function-8)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { guardrailsBulkUnassignKeys } from "@openrouter/sdk/funcs/guardrailsBulkUnassignKeys.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await guardrailsBulkUnassignKeys(openRouter, {
    id: "550e8400-e29b-41d4-a716-446655440000",
    bulkUnassignKeysRequest: {
      keyHashes: [\
        "c56454edb818d6b14bc0d61c46025f1450b0f4012d12304ab40aacb519fcbc93",\
      ],
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("guardrailsBulkUnassignKeys failed:", res.error);
  }
}

run();
```

See all 30 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#parameters-8)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.BulkUnassignKeysFromGuardrailRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/bulkunassignkeysfromguardrailrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#response-8)  Response

**Promise< [models.BulkUnassignKeysResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models/bulkunassignkeysresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#errors-8)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.BadRequestResponseError | 400 | application/json |
| errors.UnauthorizedResponseError | 401 | application/json |
| errors.NotFoundResponseError | 404 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#listguardrailmemberassignments)  listGuardrailMemberAssignments

List all organization member assignments for a specific guardrail. [Management key](https://openrouter.ai/docs/guides/overview/auth/management-api-keys) required.

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#example-usage-9)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.guardrails.listGuardrailMemberAssignments({
    id: "550e8400-e29b-41d4-a716-446655440000",
  });

  for await (const page of result) {
    console.log(page);
  }
}

run();
```

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#standalone-function-9)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { guardrailsListGuardrailMemberAssignments } from "@openrouter/sdk/funcs/guardrailsListGuardrailMemberAssignments.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await guardrailsListGuardrailMemberAssignments(openRouter, {
    id: "550e8400-e29b-41d4-a716-446655440000",
  });
  if (res.ok) {
    const { value: result } = res;
    for await (const page of result) {
    console.log(page);
  }
  } else {
    console.log("guardrailsListGuardrailMemberAssignments failed:", res.error);
  }
}

run();
```

See all 27 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#parameters-9)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.ListGuardrailMemberAssignmentsRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/listguardrailmemberassignmentsrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#response-9)  Response

**Promise< [operations.ListGuardrailMemberAssignmentsResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/listguardrailmemberassignmentsresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#errors-9)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.UnauthorizedResponseError | 401 | application/json |
| errors.NotFoundResponseError | 404 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#bulkassignmembers)  bulkAssignMembers

Assign multiple organization members to a specific guardrail. [Management key](https://openrouter.ai/docs/guides/overview/auth/management-api-keys) required.

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#example-usage-10)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.guardrails.bulkAssignMembers({
    id: "550e8400-e29b-41d4-a716-446655440000",
    bulkAssignMembersRequest: {
      memberUserIds: [\
        "user_abc123",\
        "user_def456",\
      ],
    },
  });

  console.log(result);
}

run();
```

See all 24 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#standalone-function-10)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { guardrailsBulkAssignMembers } from "@openrouter/sdk/funcs/guardrailsBulkAssignMembers.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await guardrailsBulkAssignMembers(openRouter, {
    id: "550e8400-e29b-41d4-a716-446655440000",
    bulkAssignMembersRequest: {
      memberUserIds: [\
        "user_abc123",\
        "user_def456",\
      ],
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("guardrailsBulkAssignMembers failed:", res.error);
  }
}

run();
```

See all 31 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#parameters-10)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.BulkAssignMembersToGuardrailRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/bulkassignmemberstoguardrailrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#response-10)  Response

**Promise< [models.BulkAssignMembersResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models/bulkassignmembersresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#errors-10)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.BadRequestResponseError | 400 | application/json |
| errors.UnauthorizedResponseError | 401 | application/json |
| errors.NotFoundResponseError | 404 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#bulkunassignmembers)  bulkUnassignMembers

Unassign multiple organization members from a specific guardrail. [Management key](https://openrouter.ai/docs/guides/overview/auth/management-api-keys) required.

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#example-usage-11)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.guardrails.bulkUnassignMembers({
    id: "550e8400-e29b-41d4-a716-446655440000",
    bulkUnassignMembersRequest: {
      memberUserIds: [\
        "user_abc123",\
        "user_def456",\
      ],
    },
  });

  console.log(result);
}

run();
```

See all 24 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#standalone-function-11)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { guardrailsBulkUnassignMembers } from "@openrouter/sdk/funcs/guardrailsBulkUnassignMembers.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await guardrailsBulkUnassignMembers(openRouter, {
    id: "550e8400-e29b-41d4-a716-446655440000",
    bulkUnassignMembersRequest: {
      memberUserIds: [\
        "user_abc123",\
        "user_def456",\
      ],
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("guardrailsBulkUnassignMembers failed:", res.error);
  }
}

run();
```

See all 31 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#parameters-11)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.BulkUnassignMembersFromGuardrailRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/bulkunassignmembersfromguardrailrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#response-11)  Response

**Promise< [models.BulkUnassignMembersResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models/bulkunassignmembersresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#errors-11)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.BadRequestResponseError | 400 | application/json |
| errors.UnauthorizedResponseError | 401 | application/json |
| errors.NotFoundResponseError | 404 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#listkeyassignments)  listKeyAssignments

List all API key guardrail assignments for the authenticated user. [Management key](https://openrouter.ai/docs/guides/overview/auth/management-api-keys) required.

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#example-usage-12)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.guardrails.listKeyAssignments();

  for await (const page of result) {
    console.log(page);
  }
}

run();
```

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#standalone-function-12)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { guardrailsListKeyAssignments } from "@openrouter/sdk/funcs/guardrailsListKeyAssignments.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await guardrailsListKeyAssignments(openRouter);
  if (res.ok) {
    const { value: result } = res;
    for await (const page of result) {
    console.log(page);
  }
  } else {
    console.log("guardrailsListKeyAssignments failed:", res.error);
  }
}

run();
```

See all 25 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#parameters-12)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.ListKeyAssignmentsRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/listkeyassignmentsrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#response-12)  Response

**Promise< [operations.ListKeyAssignmentsResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/listkeyassignmentsresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#errors-12)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.UnauthorizedResponseError | 401 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#listmemberassignments)  listMemberAssignments

List all organization member guardrail assignments for the authenticated user. [Management key](https://openrouter.ai/docs/guides/overview/auth/management-api-keys) required.

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#example-usage-13)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.guardrails.listMemberAssignments();

  for await (const page of result) {
    console.log(page);
  }
}

run();
```

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#standalone-function-13)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { guardrailsListMemberAssignments } from "@openrouter/sdk/funcs/guardrailsListMemberAssignments.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await guardrailsListMemberAssignments(openRouter);
  if (res.ok) {
    const { value: result } = res;
    for await (const page of result) {
    console.log(page);
  }
  } else {
    console.log("guardrailsListMemberAssignments failed:", res.error);
  }
}

run();
```

See all 25 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#parameters-13)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.ListMemberAssignmentsRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/listmemberassignmentsrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#response-13)  Response

**Promise< [operations.ListMemberAssignmentsResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/listmemberassignmentsresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/guardrails\#errors-13)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.UnauthorizedResponseError | 401 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

[Generations](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/generations) [Models](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.