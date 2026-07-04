-- Migration 0007 — persisted tool enable/disable policy.
-- Tools are discovered from app code (built-ins) and connected MCP servers, then
-- mirrored here so users can disable noisy/unused tools before they reach the
-- model context.

CREATE TABLE IF NOT EXISTS tool_registry (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT NOT NULL,
    source_id   TEXT NOT NULL DEFAULT '',
    name        TEXT NOT NULL,
    title       TEXT,
    description TEXT,
    enabled     INTEGER NOT NULL DEFAULT 1,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source, source_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tool_registry_source
ON tool_registry(source, source_id, name);
