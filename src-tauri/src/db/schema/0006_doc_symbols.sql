-- Migration 0006 — symbols extracted from reference source files.

CREATE TABLE IF NOT EXISTS doc_symbols (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id   INTEGER NOT NULL REFERENCES doc_pages(id) ON DELETE CASCADE,
    name      TEXT NOT NULL,
    kind      TEXT NOT NULL,
    line      INTEGER NOT NULL,
    snippet   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_doc_symbols_name ON doc_symbols(name);
CREATE INDEX IF NOT EXISTS idx_doc_symbols_page ON doc_symbols(page_id);
