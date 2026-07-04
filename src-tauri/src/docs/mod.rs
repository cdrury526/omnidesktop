//! Local documentation mirror index — ingest + FTS search.
//!
//! Mirrors under `docs/<mirror>/` use path segments as metadata:
//! `<layer>/<category...>/<file>` where layer is one of
//! `official | published | source | reference | guides | index`.
//! `_provenance/` is skipped.

mod ingest;
mod related;
mod resolve;
mod search;
mod symbol;

pub use ingest::{ingest_mirror, ingest_root, IngestReport};
pub use related::related_pages;
pub use resolve::{resolve_topic, ResolveHit};
pub use search::{
    list_categories, list_layers, list_mirrors, list_pages, open_chunk, open_page, open_page_json,
    search, search_chunks, stats, DocChunk, DocChunkHit, DocHit, DocMeta, DocPage,
};
pub use symbol::{find_symbols, SymbolHit};
