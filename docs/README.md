# Documentation mirrors

Local offline copies of upstream SDK/protocol docs, organized for automated ingest
into `omni.db` via the `omni-docs` CLI.

## Path taxonomy

Every mirror follows the same layout:

```
docs/<mirror>/
  _provenance/     # SOURCE_COMMIT, SYNCED_AT, MANIFEST — not indexed
  index/           # llms-index.txt, PAGE_MANIFEST.json — discovery metadata
  official/        # upstream Mintlify/MDX source (canonical for AG-UI)
  published/       # rendered web export (OpenRouter)
  source/          # repo READMEs, integrations, changelogs
  reference/       # API source (.ts, .py) and export maps
  guides/          # skills and how-tos
```

Ingest derives metadata from path segments:

| Column   | Example value              |
|----------|----------------------------|
| `mirror` | `ag-ui-protocol`           |
| `layer`  | `official`                 |
| `category` | `concepts` or `sdk/js` |
| `slug`   | `events`                   |

## Mirrors

- [`openrouter-agent-sdk/`](./openrouter-agent-sdk/) — `@openrouter/agent` + MCP
- [`ag-ui-protocol/`](./ag-ui-protocol/) — AG-UI protocol + SDKs

## CLI

```bash
# Index all mirrors (uses ./data/omni.db by default, or app data dir if present)
pnpm docs:ingest

# Search — excerpts only, token-efficient
pnpm docs:search -- stopWhen
pnpm docs:search --mirror openrouter-agent-sdk --layer published call-model
pnpm docs:search --paths ag-ui events
pnpm docs:search --paths-only stopWhen
pnpm docs:search --json stopWhen
pnpm docs:search --chunks --mirror ag-ui-protocol events
pnpm docs:find --mirror openrouter-agent-sdk stopWhen

# Browse taxonomy
pnpm docs:list
pnpm docs:list --mirror ag-ui-protocol --layer official
pnpm docs:list --json --mirror openrouter-agent-sdk --layer published

# Compact catalog for agent context maps
pnpm docs:index --compact
pnpm docs:index --compact --mirror ag-ui-protocol

# Fuzzy lookup by topic, path, title, or slug
pnpm docs:resolve stopWhen
pnpm docs:resolve --top3 events

# API symbol lookup from reference files
pnpm docs:symbol callModel
pnpm docs:symbol createMCPTools

# Full content by hit id
pnpm docs:open -- 42
pnpm docs:open --json 42
pnpm docs:open-chunk -- 7

# Stats
cargo run --manifest-path src-tauri/Cargo.toml --bin omni-docs -- stats
```

Environment: `OMNI_DB=/path/to/omni.db` overrides the database location.
