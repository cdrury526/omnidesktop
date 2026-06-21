# CLAUDE.md

See **`AGENTS.md`** for the full agent guide, and **`HANDOFF.md`** for the
engineering brief.

## The rules that matter most

- **Work on `main`. No feature branches or PRs by default.**
- **After verifying a change works, commit AND push to `origin/main` without
  asking.** Approval to commit/push is standing — don't prompt for it. Commit
  often, in small coherent units.
- **Verify before committing** — `tsc --noEmit`, `vite build`, `cargo build`
  (when Rust changed), and drive the running app via the `omni-debug-bridge`
  skill. Don't commit on red.
- **Trust `/dom`, not `/snapshot`** — the bridge's `/dom` returns each node's
  visible `text` + resolved `styles.color`/`backgroundColor`; use them to verify
  content/theme/contrast. The html2canvas `/snapshot` drops variable-driven text
  and the cross-origin iframe → false negatives; it's for rough layout only.
- **Schema changes go through migrations** — add a `schema/NNNN_*.sql` + a
  `Migration` entry in `src-tauri/src/db/migrations.rs` (versioned, applied at
  startup). Never hand-edit the live schema; use `ALTER TABLE … ADD COLUMN`.
- **Never commit local/secret files**: `.env`, `.cursor/`, `.claude/projects/`,
  `.firecrawl/`, `google-cloud-sdk/`, `tools/`, `dist/`, `target/`.
- End commit messages with the `Co-Authored-By` trailer (see AGENTS.md).
- Prefer Ant Design X / antd primitives over hand-rolling; use the project skills
  before writing UI code. Keep files under 600 lines.
