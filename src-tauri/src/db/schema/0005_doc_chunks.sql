-- Migration 0005 — heading-level chunks for token-efficient doc lookup.

CREATE TABLE IF NOT EXISTS doc_chunks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id       INTEGER NOT NULL REFERENCES doc_pages(id) ON DELETE CASCADE,
    chunk_index   INTEGER NOT NULL,
    heading_level INTEGER NOT NULL,
    heading       TEXT NOT NULL,
    content       TEXT NOT NULL,
    byte_size     INTEGER NOT NULL,
    UNIQUE(page_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_doc_chunks_page ON doc_chunks(page_id);

CREATE VIRTUAL TABLE IF NOT EXISTS doc_chunks_fts USING fts5(
    heading,
    content,
    content='doc_chunks',
    content_rowid='id',
    tokenize='porter'
);

CREATE TRIGGER IF NOT EXISTS doc_chunks_ai AFTER INSERT ON doc_chunks BEGIN
    INSERT INTO doc_chunks_fts(rowid, heading, content)
    VALUES (new.id, new.heading, new.content);
END;

CREATE TRIGGER IF NOT EXISTS doc_chunks_ad AFTER DELETE ON doc_chunks BEGIN
    INSERT INTO doc_chunks_fts(doc_chunks_fts, rowid, heading, content)
    VALUES ('delete', old.id, old.heading, old.content);
END;

CREATE TRIGGER IF NOT EXISTS doc_chunks_au AFTER UPDATE ON doc_chunks BEGIN
    INSERT INTO doc_chunks_fts(doc_chunks_fts, rowid, heading, content)
    VALUES ('delete', old.id, old.heading, old.content);
    INSERT INTO doc_chunks_fts(rowid, heading, content)
    VALUES (new.id, new.heading, new.content);
END;
