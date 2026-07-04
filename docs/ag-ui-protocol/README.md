# AG-UI Protocol — local documentation mirror

Offline reference for [ag-ui-protocol/ag-ui](https://github.com/ag-ui-protocol/ag-ui) and [docs.ag-ui.com](https://docs.ag-ui.com).

**Synced:** see `_provenance/SYNCED_AT.txt` · **Repo commit:** see `_provenance/SOURCE_COMMIT.txt`

## Layout

| Path | Layer | Contents |
| --- | --- | --- |
| [`official/`](./official/) | `official` | **Canonical** Mintlify MDX source (113 files). |
| [`index/`](./index/) | `index` | `llms-index.txt`, `llms-full.txt`, `PAGE_MANIFEST.json`. |
| [`source/`](./source/) | `source` | SDK/integration/middleware READMEs from the monorepo. |
| [`reference/`](./reference/) | `reference` | TypeScript + Python SDK source. |
| [`guides/`](./guides/) | `guides` | Integration skills (e.g. A2UI). |

## Start here

- [Introduction](./official/introduction.mdx)
- [Architecture](./official/concepts/architecture.mdx)
- [Events](./official/concepts/events.mdx)
- [TypeScript SDK](./official/sdk/js/overview.mdx)
- [LangGraph integration](./source/integrations/langgraph/typescript/README.md)

## Indexing

```bash
pnpm docs:ingest -- docs/ag-ui-protocol
pnpm docs:search -- --mirror ag-ui-protocol --layer official events
```

See [`../README.md`](../README.md) for the shared path taxonomy.
