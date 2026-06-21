-- Migration 0001 — initial schema.
-- Mirrors the pre-migration-framework inline schema exactly (all IF NOT EXISTS),
-- so DBs that predate versioning (user_version = 0) replay this as a no-op and
-- get stamped to version 1 without touching existing data.

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS mcp_servers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT,
    url        TEXT NOT NULL UNIQUE,
    enabled    INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tabs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kind       TEXT NOT NULL,
    title      TEXT,
    state      TEXT,
    position   INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id);

CREATE TABLE IF NOT EXISTS conversation_state (
    conversation_id INTEGER PRIMARY KEY,
    state           TEXT NOT NULL,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS form_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER,
    tool_name       TEXT,
    spec            TEXT,
    spec_valid      INTEGER,
    issues          TEXT,
    result          TEXT,
    status          TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ts              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    source          TEXT NOT NULL,
    type            TEXT NOT NULL,
    conversation_id INTEGER,
    data            TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_id ON events(id);
