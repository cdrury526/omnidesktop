# `omni-docs` CLI backlog

Dev-time tooling for referencing local doc mirrors (`docs/`) via `data/omni.db` while building the app. **Not** in-app UI — CLI + agents only.

**Implemented baseline (2026-07):** layer taxonomy, migration `0004_doc_index`, FTS5 search, ingest, `search` / `list` / `open` / `stats`, `pnpm docs:*` scripts.

Mark items `[x]` when **implemented and tested** (note command + date in *Verified* column or inline).

---

## Priority 1 — highest leverage

- [x] **1. `--json` on search / list / open**
  - Structured output for agents (`id`, `mirror`, `layer`, `category`, `slug`, `title`, `excerpt`, `relPath`, `bytes`).
  - Flags: `search --json`, `list --json`, `open --json` (metadata only; content in separate field or omitted for search).
  - *Verified:* 2026-07-04: `cargo build --manifest-path src-tauri/Cargo.toml --bin omni-docs`; `pnpm docs:ingest`; `pnpm docs:search --json stopWhen | node -e ...`; `pnpm docs:list --json --mirror openrouter-agent-sdk --layer published | node -e ...`; `pnpm docs:open --json 1 | node -e ...`.

- [x] **2. `index --compact`**
  - Token-efficient catalog: one line per page (`mirror | layer | category | slug | title`).
  - Optional `--mirror` filter; pipe-friendly for agent context maps.
  - *Verified:* 2026-07-04: `cargo build --manifest-path src-tauri/Cargo.toml --bin omni-docs`; `pnpm docs:index --compact | node -e ...`; `pnpm docs:index --compact --mirror ag-ui-protocol | node -e ...`.

- [x] **3. Heading-level chunks**
  - Ingest splits `##` / `###` sections into `doc_chunks` (+ FTS).
  - Commands: `search --chunks`, `open-chunk <id>`.
  - Biggest token win on large MDX (e.g. `official/concepts/events.mdx`).
  - *Verified:* 2026-07-04: `cargo build --manifest-path src-tauri/Cargo.toml --bin omni-docs`; `pnpm docs:ingest`; `pnpm docs:search --chunks --mirror ag-ui-protocol events | node -e ...`; `pnpm docs:search --chunks --json --mirror ag-ui-protocol events | node -e ...`; `pnpm docs:open-chunk -- <id> | node -e ...`.

- [x] **4. `resolve <topic>`**
  - Fuzzy single-best-doc lookup (path + title + slug), prints one hit or top 3.
  - Example: `resolve stopWhen` → `published/call-model/stop-conditions.md`.
  - *Verified:* 2026-07-04: `cargo build --manifest-path src-tauri/Cargo.toml --bin omni-docs`; `pnpm docs:resolve stopWhen | node -e ...`; `pnpm docs:resolve --top3 events | node -e ...`; `pnpm docs:resolve --json stopWhen | node -e ...`.

- [x] **5. Layer priority in search ranking**
  - Boost order when FTS scores tie: `official` → `published` → `guides` → `source` → `reference`.
  - Configurable in `docs/_taxonomy.yaml` or hardcoded defaults.
  - *Verified:* 2026-07-04: `cargo build --manifest-path src-tauri/Cargo.toml --bin omni-docs`; `pnpm docs:search --json events | node -e ...`; `pnpm docs:search --chunks --json events | node -e ...`.

---

## Priority 2 — nice second wave

- [x] **6. `symbol <name>`**
  - Index exports / function names from `reference/` (`.ts`, `*-exports.md`).
  - Example: `symbol callModel`, `symbol createMCPTools`.
  - *Verified:* 2026-07-04: `cargo build --manifest-path src-tauri/Cargo.toml --bin omni-docs`; `pnpm docs:ingest`; `pnpm docs:symbol callModel | node -e ...`; `pnpm docs:symbol createMCPTools | node -e ...`; `pnpm docs:symbol --json callModel | node -e ...`.

- [x] **7. `find` alias / `--paths-only`**
  - Thin output: `mirror/rel_path` per line for editor open / scripting.
  - `pnpm docs:find` wrapper.
  - *Verified:* 2026-07-04: `cargo build --manifest-path src-tauri/Cargo.toml --bin omni-docs`; `pnpm docs:find stopWhen | node -e ...`; `pnpm docs:find --mirror openrouter-agent-sdk stopWhen | node -e ...`; `pnpm docs:search --paths-only stopWhen | node -e ...`.

- [x] **8. `related <id>`**
  - Same `mirror` + `category` siblings (or shared tags later).
  - Surfaces “also read” docs after a hit.
  - *Verified:* 2026-07-04: `cargo build --manifest-path src-tauri/Cargo.toml --bin omni-docs`; `OMNI_DB=data/omni.db pnpm docs:related -- 10 | node -e ...`; `OMNI_DB=data/omni.db pnpm docs:related --json -- 10 | node -e ...`.

- [ ] **9. Watch + re-ingest**
  - `docs:watch` on `docs/` (debounced file watcher → incremental or full re-ingest).
  - Dev convenience when mirrors are refreshed.
  - *Verified:*

- [ ] **10. AGENTS.md / agent workflow blurb**
  - Standing instruction: before OpenRouter/AG-UI work, run `pnpm docs:search` / `docs:index --compact`.
  - Link to `docs/README.md` and this backlog.
  - *Verified:*

---

## Priority 3 — defer unless needed

- [ ] **11. Vector / semantic search**
  - Chunk embeddings + `sqlite-vec` (or sidecar); hybrid FTS + vector.
  - Only if keyword search + taxonomy keeps missing intent.
  - *Verified:*

- [ ] **12. In-app / debug-bridge integration**
  - Tauri `docs_search` command or `/docs/search` on debug bridge.
  - Out of scope unless we want in-IDE search from running app.
  - *Verified:*

- [ ] **13. Ingest into app `~/.local/share/.../omni.db`**
  - Same schema, app data path; only needed if CLI and app must share one DB.
  - Dev default `data/omni.db` is sufficient for build-time use.
  - *Verified:*

---

## Suggested “best stack” (target workflow)

```bash
pnpm docs:ingest                              # when mirrors change
pnpm docs:index --compact                     # agent map (once per task)
pnpm docs:search --json …                     # 3–5 hits
pnpm docs:open -- <id>                        # or open-chunk <id>
```

---

## Testing checklist (per item)

When marking `[x]`, confirm:

1. `cargo build --manifest-path src-tauri/Cargo.toml --bin omni-docs`
2. Command works against `data/omni.db` with real mirrors under `docs/`
3. Output is agent-friendly (JSON valid / paths correct / excerpts sane)
4. Brief note in *Verified* (e.g. `2026-07-04: pnpm docs:search --json stopWhen`)
