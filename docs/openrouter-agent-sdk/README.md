# OpenRouter TypeScript Agent SDK — local documentation mirror

Offline reference for [OpenRouterTeam/typescript-agent](https://github.com/OpenRouterTeam/typescript-agent) and the published [Agent SDK docs](https://openrouter.ai/docs/agent-sdk/overview).

**Synced:** see `SYNCED_AT.txt` · **Repo commit:** see `SOURCE_COMMIT.txt`

## Layout

| Path | Contents |
| --- | --- |
| [`web-docs/`](./web-docs/) | Official OpenRouter Agent SDK documentation (scraped from openrouter.ai). Start with [`web-docs/overview.md`](./web-docs/overview.md) or [`web-docs/call-model/overview.md`](./web-docs/call-model/overview.md). |
| [`web-docs/llms-index.txt`](./web-docs/llms-index.txt) | Full OpenRouter docs index (`/docs/llms.txt`) — use to discover pages beyond this mirror. |
| [`repo/`](./repo/) | READMEs, changelogs, and `package.json` from the GitHub monorepo. |
| [`api-source/`](./api-source/) | TypeScript source from `packages/agent` and `packages/mcp` (JSDoc + types). See `*-exports.md` for subpath export map. |

## Packages

- **`@openrouter/agent`** — `callModel`, tools, streaming, conversation state, format compat. [`repo/packages/agent/README.md`](./repo/packages/agent/README.md)
- **`@openrouter/mcp`** — Remote MCP servers as `callModel` tools. [`repo/packages/mcp/README.md`](./repo/packages/mcp/README.md)

## Quick links (web-docs)

### Concepts
- [Agent SDK overview](./web-docs/overview.md)
- [Usage for agents](./web-docs/usage-for-agents.md)
- [Migrating to @openrouter/agent](./web-docs/agent-migration.md)
- [DevTools](./web-docs/dev-tools/devtools.md)

### `callModel`
- [Overview](./web-docs/call-model/overview.md)
- [Tools](./web-docs/call-model/tools.md)
- [Streaming](./web-docs/call-model/streaming.md)
- [Stop conditions](./web-docs/call-model/stop-conditions.md)
- [Tool approval & state](./web-docs/call-model/tool-approval-state.md)
- [API reference](./web-docs/call-model/api-reference.md)
- [Examples: weather tool](./web-docs/call-model/examples/weather-tool.md) · [skills loader](./web-docs/call-model/examples/skills-loader.md)

### TypeScript API reference
- [SDK overview](./web-docs/typescript/overview.md)
- [Responses](./web-docs/typescript/api-reference/responses.md) · [Chat](./web-docs/typescript/api-reference/chat.md) · [Models](./web-docs/typescript/api-reference/models.md)

## Refreshing this mirror

```bash
# 1. Shallow-clone the repo
git clone --depth 1 https://github.com/OpenRouterTeam/typescript-agent.git /tmp/typescript-agent

# 2. Re-copy repo docs + api-source (see sync script or repeat rsync/cp steps)

# 3. Re-scrape web docs (requires firecrawl CLI + API key)
firecrawl experimental download "https://openrouter.ai/docs/agent-sdk" \
  --include-paths "/docs/agent-sdk" --only-main-content -y --limit 50

curl -fsSL "https://openrouter.ai/docs/llms.txt" -o docs/openrouter-agent-sdk/web-docs/llms-index.txt
```

Firecrawl raw output lands in `.firecrawl/` (gitignored); reorganize into `web-docs/` as needed.

## License

Upstream: Apache-2.0. Documentation © OpenRouter.
