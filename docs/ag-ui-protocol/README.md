# AG-UI Protocol — local documentation mirror

Offline reference for [ag-ui-protocol/ag-ui](https://github.com/ag-ui-protocol/ag-ui) and the published docs at [docs.ag-ui.com](https://docs.ag-ui.com).

**Synced:** see `SYNCED_AT.txt` · **Repo commit:** see `SOURCE_COMMIT.txt`

## Layout

| Path | Contents |
| --- | --- |
| [`repo-docs/`](./repo-docs/) | **Authoritative Mintlify source** (113 MDX/MD files) — concepts, quickstarts, SDK refs for JS/Python/.NET/Go/Java/Kotlin/Rust/Ruby/Dart. |
| [`web-docs/`](./web-docs/) | Rendered docs split from [`llms-full.txt`](./web-docs/llms-full.txt) (55 pages) + [`llms-index.txt`](./web-docs/llms-index.txt). |
| [`repo/`](./repo/) | Root README, AGENTS.md, SDK/integration/middleware READMEs from the monorepo. |
| [`api-source/`](./api-source/) | TypeScript (`@ag-ui/*`) and Python SDK source for offline type/JSDoc reference. |
| [`skills/`](./skills/) | AG-UI integration skills from the repo (e.g. A2UI integration). |

## Start here

- **Protocol intro:** [`repo-docs/introduction.mdx`](./repo-docs/introduction.mdx) or [`web-docs/introduction.md`](./web-docs/introduction.md)
- **Architecture:** [`repo-docs/concepts/architecture.mdx`](./repo-docs/concepts/architecture.mdx)
- **Events reference:** [`repo-docs/concepts/events.mdx`](./repo-docs/concepts/events.mdx)
- **TypeScript SDK:** [`repo-docs/sdk/js/overview.mdx`](./repo-docs/sdk/js/overview.mdx) · [`api-source/typescript/`](./api-source/typescript/)
- **Build an app:** [`repo-docs/quickstart/applications.mdx`](./repo-docs/quickstart/applications.mdx)

## TypeScript packages (`@ag-ui/*`)

| Package | Version | Export map |
| --- | --- | --- |
| `@ag-ui/core` | 0.0.57 | [`core-exports.md`](./api-source/typescript/core-exports.md) |
| `@ag-ui/client` | 0.0.57 | [`client-exports.md`](./api-source/typescript/client-exports.md) |
| `@ag-ui/encoder` | 0.0.57 | [`encoder-exports.md`](./api-source/typescript/encoder-exports.md) |
| `@ag-ui/proto` | 0.0.57 | [`proto-exports.md`](./api-source/typescript/proto-exports.md) |
| `@ag-ui/cli` | 0.0.58 | [`cli-exports.md`](./api-source/typescript/cli-exports.md) |
| `@ag-ui/a2ui-toolkit` | 0.0.4 | [`a2ui-toolkit-exports.md`](./api-source/typescript/a2ui-toolkit-exports.md) |

## Integrations & examples

Framework adapters live under [`repo/integrations/`](./repo/integrations/) (LangGraph, CrewAI, Mastra, Vercel AI SDK, ADK, Pydantic AI, …). Interactive demos are documented in [`repo/apps/dojo/`](./repo/apps/dojo/) feature READMEs.

## Refreshing this mirror

```bash
# 1. Shallow-clone
git clone --depth 1 https://github.com/ag-ui-protocol/ag-ui.git /tmp/ag-ui

# 2. Re-copy repo-docs, repo READMEs, api-source (rsync as in initial sync)

# 3. Pull rendered docs + index (no Firecrawl credits needed)
curl -fsSL "https://docs.ag-ui.com/llms-full.txt" -o docs/ag-ui-protocol/web-docs/llms-full.txt
curl -fsSL "https://docs.ag-ui.com/llms.txt" -o docs/ag-ui-protocol/web-docs/llms-index.txt
# Re-run the llms-full.txt split script (see MANIFEST.json / PAGE_MANIFEST.json)
```

The repo `docs/` folder is the richest source — it includes SDK languages not present in `llms-full.txt` (Dart, Go, Java, Kotlin, Ruby, Rust).

## License

Upstream: MIT. Documentation © AG-UI / CopilotKit contributors.
