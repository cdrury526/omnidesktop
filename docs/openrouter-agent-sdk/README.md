# OpenRouter TypeScript Agent SDK — local documentation mirror

Offline reference for [OpenRouterTeam/typescript-agent](https://github.com/OpenRouterTeam/typescript-agent) and the published [Agent SDK docs](https://openrouter.ai/docs/agent-sdk/overview).

**Synced:** see `_provenance/SYNCED_AT.txt` · **Repo commit:** see `_provenance/SOURCE_COMMIT.txt`

## Layout

| Path | Layer | Contents |
| --- | --- | --- |
| [`published/`](./published/) | `published` | Official OpenRouter Agent SDK docs (from openrouter.ai). |
| [`index/`](./index/) | `index` | `llms-index.txt` discovery index. |
| [`source/`](./source/) | `source` | READMEs, changelogs, `package.json` from the GitHub monorepo. |
| [`reference/`](./reference/) | `reference` | TypeScript source from `packages/agent` and `packages/mcp`. |

## Quick links (published)

- [Overview](./published/overview.md)
- [callModel overview](./published/call-model/overview.md)
- [Tools](./published/call-model/tools.md)
- [Stop conditions](./published/call-model/stop-conditions.md)

## Indexing

```bash
pnpm docs:ingest -- docs/openrouter-agent-sdk
pnpm docs:search -- --mirror openrouter-agent-sdk stopWhen
```

See [`../README.md`](../README.md) for the shared path taxonomy.
