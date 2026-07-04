-- Migration 0004 — local documentation index (mirrors under docs/).
-- Path segments map to mirror / layer / category; FTS5 powers omni-docs search.

CREATE TABLE IF NOT EXISTS doc_sources (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    slug         TEXT NOT NULL UNIQUE,
    root_path    TEXT NOT NULL,
    repository   TEXT,
    commit_hash  TEXT,
    synced_at    TEXT,
    ingested_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS doc_pages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id    INTEGER NOT NULL REFERENCES doc_sources(id) ON DELETE CASCADE,
    mirror       TEXT NOT NULL,
    layer        TEXT NOT NULL,
    category     TEXT NOT NULL DEFAULT '',
    slug         TEXT NOT NULL,
    rel_path     TEXT NOT NULL,
    title        TEXT,
    format       TEXT NOT NULL,
    source_url   TEXT,
    content      TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    byte_size    INTEGER NOT NULL,
    ingested_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source_id, rel_path)
);

CREATE INDEX IF NOT EXISTS idx_doc_pages_mirror_layer ON doc_pages(mirror, layer);
CREATE INDEX IF NOT EXISTS idx_doc_pages_mirror_category ON doc_pages(mirror, category);

CREATE VIRTUAL TABLE IF NOT EXISTS doc_pages_fts USING fts5(
    title,
    category,
    slug,
    content,
    content='doc_pages',
    content_rowid='id',
    tokenize='porter'
);

CREATE TRIGGER IF NOT EXISTS doc_pages_ai AFTER INSERT ON doc_pages BEGIN
    INSERT INTO doc_pages_fts(rowid, title, category, slug, content)
    VALUES (new.id, new.title, new.category, new.slug, new.content);
END;

CREATE TRIGGER IF NOT EXISTS doc_pages_ad AFTER DELETE ON doc_pages BEGIN
    INSERT INTO doc_pages_fts(doc_pages_fts, rowid, title, category, slug, content)
    VALUES ('delete', old.id, old.title, old.category, old.slug, old.content);
END;

CREATE TRIGGER IF NOT EXISTS doc_pages_au AFTER UPDATE ON doc_pages BEGIN
    INSERT INTO doc_pages_fts(doc_pages_fts, rowid, title, category, slug, content)
    VALUES ('delete', old.id, old.title, old.category, old.slug, old.content);
    INSERT INTO doc_pages_fts(rowid, title, category, slug, content)
    VALUES (new.id, new.title, new.category, new.slug, new.content);
END;
