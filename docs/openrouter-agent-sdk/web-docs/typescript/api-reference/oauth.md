> ## Documentation Index
>
> Fetch the complete documentation index at: [/docs/llms.txt](https://openrouter.ai/docs/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth#content-area)

The TypeScript SDK and docs are currently in beta.
Report issues on [GitHub](https://github.com/OpenRouterTeam/typescript-sdk/issues).

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth\#overview)  Overview

OAuth authentication endpoints

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth\#available-operations)  Available Operations

- [exchangeAuthCodeForAPIKey](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth#exchangeauthcodeforapikey) \- Exchange authorization code for API key
- [createAuthCode](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth#createauthcode) \- Create authorization code

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth\#exchangeauthcodeforapikey)  exchangeAuthCodeForAPIKey

Exchange an authorization code from the PKCE flow for a user-controlled API key

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth\#example-usage)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.oAuth.exchangeAuthCodeForAPIKey({
    requestBody: {
      code: "auth_code_abc123def456",
      codeChallengeMethod: "S256",
      codeVerifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
    },
  });

  console.log(result);
}

run();
```

See all 22 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth\#standalone-function)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { oAuthExchangeAuthCodeForAPIKey } from "@openrouter/sdk/funcs/oAuthExchangeAuthCodeForAPIKey.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await oAuthExchangeAuthCodeForAPIKey(openRouter, {
    requestBody: {
      code: "auth_code_abc123def456",
      codeChallengeMethod: "S256",
      codeVerifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("oAuthExchangeAuthCodeForAPIKey failed:", res.error);
  }
}

run();
```

See all 29 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth\#parameters)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.ExchangeAuthCodeForAPIKeyRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/exchangeauthcodeforapikeyrequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth\#response)  Response

**Promise< [operations.ExchangeAuthCodeForAPIKeyResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/exchangeauthcodeforapikeyresponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth\#errors)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.BadRequestResponseError | 400 | application/json |
| errors.ForbiddenResponseError | 403 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

## [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth\#createauthcode)  createAuthCode

Create an authorization code for the PKCE flow to generate a user-controlled API key

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth\#example-usage-2)  Example Usage

```
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const result = await openRouter.oAuth.createAuthCode({
    requestBody: {
      callbackUrl: "https://myapp.com/auth/callback",
      codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      codeChallengeMethod: "S256",
      limit: 100,
    },
  });

  console.log(result);
}

run();
```

See all 23 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth\#standalone-function-2)  Standalone function

The standalone function version of this method:

```
import { OpenRouterCore } from "@openrouter/sdk/core.js";
import { oAuthCreateAuthCode } from "@openrouter/sdk/funcs/oAuthCreateAuthCode.js";

// Use `OpenRouterCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const openRouter = new OpenRouterCore({
  httpReferer: "<value>",
  appTitle: "<value>",
  appCategories: "<value>",
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
});

async function run() {
  const res = await oAuthCreateAuthCode(openRouter, {
    requestBody: {
      callbackUrl: "https://myapp.com/auth/callback",
      codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      codeChallengeMethod: "S256",
      limit: 100,
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("oAuthCreateAuthCode failed:", res.error);
  }
}

run();
```

See all 30 lines

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth\#parameters-2)  Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `request` | [operations.CreateAuthKeysCodeRequest](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/createauthkeyscoderequest) | :heavy\_check\_mark: | The request object to use for the request. |
| `options` | RequestOptions | :heavy\_minus\_sign: | Used to set various options for making HTTP requests. |
| `options.fetchOptions` | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options) | :heavy\_minus\_sign: | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries` | [RetryConfig](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/lib/retryconfig) | :heavy\_minus\_sign: | Enables retrying HTTP requests under certain failure conditions. |

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth\#response-2)  Response

**Promise< [operations.CreateAuthKeysCodeResponse](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/operations/createauthkeyscoderesponse) >**

### [​](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/oauth\#errors-2)  Errors

| Error Type | Status Code | Content Type |
| --- | --- | --- |
| errors.BadRequestResponseError | 400 | application/json |
| errors.UnauthorizedResponseError | 401 | application/json |
| errors.ConflictResponseError | 409 | application/json |
| errors.InternalServerResponseError | 500 | application/json |
| errors.OpenRouterDefaultError | 4XX, 5XX | \*/\* |

[Models](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models) [Organization](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/organization)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.