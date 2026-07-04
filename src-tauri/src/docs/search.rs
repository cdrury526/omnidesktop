use crate::db::Db;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocHit {
    pub id: i64,
    pub mirror: String,
    pub layer: String,
    pub category: String,
    pub slug: String,
    pub rel_path: String,
    pub title: Option<String>,
    pub excerpt: String,
    pub byte_size: i64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocMeta {
    pub id: i64,
    pub mirror: String,
    pub layer: String,
    pub category: String,
    pub slug: String,
    pub title: Option<String>,
    pub rel_path: String,
    pub bytes: i64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocPage {
    #[serde(flatten)]
    pub meta: DocMeta,
    pub abs_path: String,
    pub source_url: Option<String>,
    pub content: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocChunkHit {
    pub id: i64,
    pub page_id: i64,
    pub mirror: String,
    pub layer: String,
    pub category: String,
    pub slug: String,
    pub rel_path: String,
    pub title: Option<String>,
    pub heading: String,
    pub heading_level: i64,
    pub excerpt: String,
    pub byte_size: i64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocChunk {
    pub id: i64,
    pub page_id: i64,
    pub mirror: String,
    pub layer: String,
    pub category: String,
    pub slug: String,
    pub rel_path: String,
    pub title: Option<String>,
    pub heading: String,
    pub heading_level: i64,
    pub byte_size: i64,
    pub content: String,
}

pub async fn search(
    db: &Db,
    query: &str,
    mirror: Option<&str>,
    layer: Option<&str>,
    category_prefix: Option<&str>,
    limit: u32,
) -> Result<Vec<DocHit>, String> {
    let fts = build_fts_query(query);
    if fts.is_empty() {
        return Ok(Vec::new());
    }
    let lim = limit as i64;
    let conn = db.conn.clone();

    let mut rows = match (mirror, layer, category_prefix) {
        (Some(m), Some(l), Some(c)) => {
            let like = format!("{c}/%");
            conn.query(
                "SELECT p.id, p.mirror, p.layer, p.category, p.slug, p.rel_path, p.title, p.byte_size, \
                 snippet(doc_pages_fts, 3, '…', '…', '…', 48) AS excerpt \
                 FROM doc_pages_fts f JOIN doc_pages p ON p.id = f.rowid \
                 WHERE doc_pages_fts MATCH ? AND p.mirror = ? AND p.layer = ? \
                 AND (p.category = ? OR p.category LIKE ?) ORDER BY rank LIMIT ?",
                libsql::params![fts, m, l, c, like, lim],
            )
            .await
        }
        (Some(m), Some(l), None) => {
            conn.query(
                "SELECT p.id, p.mirror, p.layer, p.category, p.slug, p.rel_path, p.title, p.byte_size, \
                 snippet(doc_pages_fts, 3, '…', '…', '…', 48) AS excerpt \
                 FROM doc_pages_fts f JOIN doc_pages p ON p.id = f.rowid \
                 WHERE doc_pages_fts MATCH ? AND p.mirror = ? AND p.layer = ? ORDER BY rank LIMIT ?",
                libsql::params![fts, m, l, lim],
            )
            .await
        }
        (Some(m), None, Some(c)) => {
            let like = format!("{c}/%");
            conn.query(
                "SELECT p.id, p.mirror, p.layer, p.category, p.slug, p.rel_path, p.title, p.byte_size, \
                 snippet(doc_pages_fts, 3, '…', '…', '…', 48) AS excerpt \
                 FROM doc_pages_fts f JOIN doc_pages p ON p.id = f.rowid \
                 WHERE doc_pages_fts MATCH ? AND p.mirror = ? \
                 AND (p.category = ? OR p.category LIKE ?) ORDER BY rank LIMIT ?",
                libsql::params![fts, m, c, like, lim],
            )
            .await
        }
        (Some(m), None, None) => {
            conn.query(
                "SELECT p.id, p.mirror, p.layer, p.category, p.slug, p.rel_path, p.title, p.byte_size, \
                 snippet(doc_pages_fts, 3, '…', '…', '…', 48) AS excerpt \
                 FROM doc_pages_fts f JOIN doc_pages p ON p.id = f.rowid \
                 WHERE doc_pages_fts MATCH ? AND p.mirror = ? ORDER BY rank LIMIT ?",
                libsql::params![fts, m, lim],
            )
            .await
        }
        (None, Some(l), None) => {
            conn.query(
                "SELECT p.id, p.mirror, p.layer, p.category, p.slug, p.rel_path, p.title, p.byte_size, \
                 snippet(doc_pages_fts, 3, '…', '…', '…', 48) AS excerpt \
                 FROM doc_pages_fts f JOIN doc_pages p ON p.id = f.rowid \
                 WHERE doc_pages_fts MATCH ? AND p.layer = ? ORDER BY rank LIMIT ?",
                libsql::params![fts, l, lim],
            )
            .await
        }
        _ => {
            conn.query(
                "SELECT p.id, p.mirror, p.layer, p.category, p.slug, p.rel_path, p.title, p.byte_size, \
                 snippet(doc_pages_fts, 3, '…', '…', '…', 48) AS excerpt \
                 FROM doc_pages_fts f JOIN doc_pages p ON p.id = f.rowid \
                 WHERE doc_pages_fts MATCH ? ORDER BY rank LIMIT ?",
                libsql::params![fts, lim],
            )
            .await
        }
    }
    .map_err(|e| e.to_string())?;

    collect_hits(&mut rows).await
}

pub async fn search_chunks(
    db: &Db,
    query: &str,
    mirror: Option<&str>,
    layer: Option<&str>,
    category_prefix: Option<&str>,
    limit: u32,
) -> Result<Vec<DocChunkHit>, String> {
    let fts = build_fts_query(query);
    if fts.is_empty() {
        return Ok(Vec::new());
    }
    let lim = limit as i64;
    let conn = db.conn.clone();

    let mut rows = match (mirror, layer, category_prefix) {
        (Some(m), Some(l), Some(c)) => {
            let like = format!("{c}/%");
            conn.query(
                "SELECT c.id, c.page_id, p.mirror, p.layer, p.category, p.slug, p.rel_path, \
                 p.title, c.heading, c.heading_level, c.byte_size, \
                 snippet(doc_chunks_fts, 1, '…', '…', '…', 48) AS excerpt \
                 FROM doc_chunks_fts f JOIN doc_chunks c ON c.id = f.rowid \
                 JOIN doc_pages p ON p.id = c.page_id \
                 WHERE doc_chunks_fts MATCH ? AND p.mirror = ? AND p.layer = ? \
                 AND (p.category = ? OR p.category LIKE ?) ORDER BY rank LIMIT ?",
                libsql::params![fts, m, l, c, like, lim],
            )
            .await
        }
        (Some(m), Some(l), None) => {
            conn.query(
                "SELECT c.id, c.page_id, p.mirror, p.layer, p.category, p.slug, p.rel_path, \
                 p.title, c.heading, c.heading_level, c.byte_size, \
                 snippet(doc_chunks_fts, 1, '…', '…', '…', 48) AS excerpt \
                 FROM doc_chunks_fts f JOIN doc_chunks c ON c.id = f.rowid \
                 JOIN doc_pages p ON p.id = c.page_id \
                 WHERE doc_chunks_fts MATCH ? AND p.mirror = ? AND p.layer = ? ORDER BY rank LIMIT ?",
                libsql::params![fts, m, l, lim],
            )
            .await
        }
        (Some(m), None, Some(c)) => {
            let like = format!("{c}/%");
            conn.query(
                "SELECT c.id, c.page_id, p.mirror, p.layer, p.category, p.slug, p.rel_path, \
                 p.title, c.heading, c.heading_level, c.byte_size, \
                 snippet(doc_chunks_fts, 1, '…', '…', '…', 48) AS excerpt \
                 FROM doc_chunks_fts f JOIN doc_chunks c ON c.id = f.rowid \
                 JOIN doc_pages p ON p.id = c.page_id \
                 WHERE doc_chunks_fts MATCH ? AND p.mirror = ? \
                 AND (p.category = ? OR p.category LIKE ?) ORDER BY rank LIMIT ?",
                libsql::params![fts, m, c, like, lim],
            )
            .await
        }
        (Some(m), None, None) => {
            conn.query(
                "SELECT c.id, c.page_id, p.mirror, p.layer, p.category, p.slug, p.rel_path, \
                 p.title, c.heading, c.heading_level, c.byte_size, \
                 snippet(doc_chunks_fts, 1, '…', '…', '…', 48) AS excerpt \
                 FROM doc_chunks_fts f JOIN doc_chunks c ON c.id = f.rowid \
                 JOIN doc_pages p ON p.id = c.page_id \
                 WHERE doc_chunks_fts MATCH ? AND p.mirror = ? ORDER BY rank LIMIT ?",
                libsql::params![fts, m, lim],
            )
            .await
        }
        (None, Some(l), None) => {
            conn.query(
                "SELECT c.id, c.page_id, p.mirror, p.layer, p.category, p.slug, p.rel_path, \
                 p.title, c.heading, c.heading_level, c.byte_size, \
                 snippet(doc_chunks_fts, 1, '…', '…', '…', 48) AS excerpt \
                 FROM doc_chunks_fts f JOIN doc_chunks c ON c.id = f.rowid \
                 JOIN doc_pages p ON p.id = c.page_id \
                 WHERE doc_chunks_fts MATCH ? AND p.layer = ? ORDER BY rank LIMIT ?",
                libsql::params![fts, l, lim],
            )
            .await
        }
        _ => {
            conn.query(
                "SELECT c.id, c.page_id, p.mirror, p.layer, p.category, p.slug, p.rel_path, \
                 p.title, c.heading, c.heading_level, c.byte_size, \
                 snippet(doc_chunks_fts, 1, '…', '…', '…', 48) AS excerpt \
                 FROM doc_chunks_fts f JOIN doc_chunks c ON c.id = f.rowid \
                 JOIN doc_pages p ON p.id = c.page_id \
                 WHERE doc_chunks_fts MATCH ? ORDER BY rank LIMIT ?",
                libsql::params![fts, lim],
            )
            .await
        }
    }
    .map_err(|e| e.to_string())?;

    collect_chunk_hits(&mut rows).await
}

pub async fn list_pages(
    db: &Db,
    mirror: Option<&str>,
    layer: Option<&str>,
) -> Result<Vec<DocMeta>, String> {
    let conn = db.conn.clone();
    let mut rows = match (mirror, layer) {
        (Some(m), Some(l)) => {
            conn.query(
                "SELECT id, mirror, layer, category, slug, title, rel_path, byte_size \
                 FROM doc_pages WHERE mirror = ? AND layer = ? \
                 ORDER BY mirror, layer, category, slug",
                libsql::params![m, l],
            )
            .await
        }
        (Some(m), None) => {
            conn.query(
                "SELECT id, mirror, layer, category, slug, title, rel_path, byte_size \
                 FROM doc_pages WHERE mirror = ? \
                 ORDER BY mirror, layer, category, slug",
                libsql::params![m],
            )
            .await
        }
        (None, Some(l)) => {
            conn.query(
                "SELECT id, mirror, layer, category, slug, title, rel_path, byte_size \
                 FROM doc_pages WHERE layer = ? \
                 ORDER BY mirror, layer, category, slug",
                libsql::params![l],
            )
            .await
        }
        (None, None) => {
            conn.query(
                "SELECT id, mirror, layer, category, slug, title, rel_path, byte_size \
                 FROM doc_pages ORDER BY mirror, layer, category, slug",
                (),
            )
            .await
        }
    }
    .map_err(|e| e.to_string())?;

    collect_meta(&mut rows).await
}

pub async fn stats(db: &Db) -> Result<Vec<(String, String, i64)>, String> {
    let conn = db.conn.clone();
    let mut rows = conn
        .query(
            "SELECT mirror, layer, COUNT(*) AS n FROM doc_pages \
             GROUP BY mirror, layer ORDER BY mirror, layer",
            (),
        )
        .await
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        out.push((
            row.get(0).map_err(|e| e.to_string())?,
            row.get(1).map_err(|e| e.to_string())?,
            row.get(2).map_err(|e| e.to_string())?,
        ));
    }
    Ok(out)
}

pub async fn open_page(db: &Db, id: i64) -> Result<Option<(String, String)>, String> {
    let conn = db.conn.clone();
    let mut rows = conn
        .query(
            "SELECT s.root_path, p.rel_path, p.content FROM doc_pages p \
             JOIN doc_sources s ON s.id = p.source_id WHERE p.id = ?",
            libsql::params![id],
        )
        .await
        .map_err(|e| e.to_string())?;
    let Some(row) = rows.next().await.map_err(|e| e.to_string())? else {
        return Ok(None);
    };
    let root: String = row.get(0).map_err(|e| e.to_string())?;
    let rel: String = row.get(1).map_err(|e| e.to_string())?;
    let content: String = row.get(2).map_err(|e| e.to_string())?;
    let abs = format!("{root}/{rel}");
    Ok(Some((abs, content)))
}

pub async fn open_page_json(db: &Db, id: i64) -> Result<Option<DocPage>, String> {
    let conn = db.conn.clone();
    let mut rows = conn
        .query(
            "SELECT p.id, p.mirror, p.layer, p.category, p.slug, p.title, p.rel_path, \
             p.byte_size, s.root_path, p.source_url, p.content \
             FROM doc_pages p JOIN doc_sources s ON s.id = p.source_id WHERE p.id = ?",
            libsql::params![id],
        )
        .await
        .map_err(|e| e.to_string())?;
    let Some(row) = rows.next().await.map_err(|e| e.to_string())? else {
        return Ok(None);
    };

    let rel_path: String = row.get(6).map_err(|e| e.to_string())?;
    let root: String = row.get(8).map_err(|e| e.to_string())?;
    Ok(Some(DocPage {
        meta: DocMeta {
            id: row.get(0).map_err(|e| e.to_string())?,
            mirror: row.get(1).map_err(|e| e.to_string())?,
            layer: row.get(2).map_err(|e| e.to_string())?,
            category: row.get(3).map_err(|e| e.to_string())?,
            slug: row.get(4).map_err(|e| e.to_string())?,
            title: row.get(5).ok(),
            rel_path: rel_path.clone(),
            bytes: row.get(7).map_err(|e| e.to_string())?,
        },
        abs_path: format!("{root}/{rel_path}"),
        source_url: row.get(9).ok(),
        content: row.get(10).map_err(|e| e.to_string())?,
    }))
}

pub async fn list_mirrors(db: &Db) -> Result<Vec<String>, String> {
    list_strings(
        db,
        "SELECT DISTINCT mirror FROM doc_pages ORDER BY mirror",
        None,
        None,
    )
    .await
}

pub async fn list_layers(db: &Db, mirror: Option<&str>) -> Result<Vec<String>, String> {
    match mirror {
        Some(m) => {
            list_strings(
                db,
                "SELECT DISTINCT layer FROM doc_pages WHERE mirror = ? ORDER BY layer",
                Some(m),
                None,
            )
            .await
        }
        None => {
            list_strings(
                db,
                "SELECT DISTINCT layer FROM doc_pages ORDER BY layer",
                None,
                None,
            )
            .await
        }
    }
}

pub async fn list_categories(
    db: &Db,
    mirror: Option<&str>,
    layer: Option<&str>,
) -> Result<Vec<String>, String> {
    match (mirror, layer) {
        (Some(m), Some(l)) => {
            list_strings(
                db,
                "SELECT DISTINCT category FROM doc_pages \
                 WHERE category != '' AND mirror = ? AND layer = ? ORDER BY category",
                Some(m),
                Some(l),
            )
            .await
        }
        (Some(m), None) => {
            list_strings(
                db,
                "SELECT DISTINCT category FROM doc_pages \
                 WHERE category != '' AND mirror = ? ORDER BY category",
                Some(m),
                None,
            )
            .await
        }
        (None, Some(l)) => {
            list_strings(
                db,
                "SELECT DISTINCT category FROM doc_pages \
                 WHERE category != '' AND layer = ? ORDER BY category",
                None,
                Some(l),
            )
            .await
        }
        (None, None) => {
            list_strings(
                db,
                "SELECT DISTINCT category FROM doc_pages WHERE category != '' ORDER BY category",
                None,
                None,
            )
            .await
        }
    }
}

async fn list_strings(
    db: &Db,
    sql: &str,
    mirror: Option<&str>,
    layer: Option<&str>,
) -> Result<Vec<String>, String> {
    let conn = db.conn.clone();
    let mut rows = match (mirror, layer) {
        (Some(m), Some(l)) => conn
            .query(sql, libsql::params![m, l])
            .await
            .map_err(|e| e.to_string())?,
        (Some(m), None) => conn
            .query(sql, libsql::params![m])
            .await
            .map_err(|e| e.to_string())?,
        (None, Some(l)) => conn
            .query(sql, libsql::params![l])
            .await
            .map_err(|e| e.to_string())?,
        (None, None) => conn.query(sql, ()).await.map_err(|e| e.to_string())?,
    };
    let mut out = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        out.push(row.get::<String>(0).map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub async fn open_chunk(db: &Db, id: i64) -> Result<Option<DocChunk>, String> {
    let conn = db.conn.clone();
    let mut rows = conn
        .query(
            "SELECT c.id, c.page_id, p.mirror, p.layer, p.category, p.slug, p.rel_path, \
             p.title, c.heading, c.heading_level, c.byte_size, c.content \
             FROM doc_chunks c JOIN doc_pages p ON p.id = c.page_id WHERE c.id = ?",
            libsql::params![id],
        )
        .await
        .map_err(|e| e.to_string())?;
    let Some(row) = rows.next().await.map_err(|e| e.to_string())? else {
        return Ok(None);
    };

    Ok(Some(DocChunk {
        id: row.get(0).map_err(|e| e.to_string())?,
        page_id: row.get(1).map_err(|e| e.to_string())?,
        mirror: row.get(2).map_err(|e| e.to_string())?,
        layer: row.get(3).map_err(|e| e.to_string())?,
        category: row.get(4).map_err(|e| e.to_string())?,
        slug: row.get(5).map_err(|e| e.to_string())?,
        rel_path: row.get(6).map_err(|e| e.to_string())?,
        title: row.get(7).ok(),
        heading: row.get(8).map_err(|e| e.to_string())?,
        heading_level: row.get(9).map_err(|e| e.to_string())?,
        byte_size: row.get(10).map_err(|e| e.to_string())?,
        content: row.get(11).map_err(|e| e.to_string())?,
    }))
}

async fn collect_meta(rows: &mut libsql::Rows) -> Result<Vec<DocMeta>, String> {
    let mut out = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        out.push(DocMeta {
            id: row.get(0).map_err(|e| e.to_string())?,
            mirror: row.get(1).map_err(|e| e.to_string())?,
            layer: row.get(2).map_err(|e| e.to_string())?,
            category: row.get(3).map_err(|e| e.to_string())?,
            slug: row.get(4).map_err(|e| e.to_string())?,
            title: row.get(5).ok(),
            rel_path: row.get(6).map_err(|e| e.to_string())?,
            bytes: row.get(7).map_err(|e| e.to_string())?,
        });
    }
    Ok(out)
}

async fn collect_chunk_hits(rows: &mut libsql::Rows) -> Result<Vec<DocChunkHit>, String> {
    let mut out = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        out.push(DocChunkHit {
            id: row.get(0).map_err(|e| e.to_string())?,
            page_id: row.get(1).map_err(|e| e.to_string())?,
            mirror: row.get(2).map_err(|e| e.to_string())?,
            layer: row.get(3).map_err(|e| e.to_string())?,
            category: row.get(4).map_err(|e| e.to_string())?,
            slug: row.get(5).map_err(|e| e.to_string())?,
            rel_path: row.get(6).map_err(|e| e.to_string())?,
            title: row.get(7).ok(),
            heading: row.get(8).map_err(|e| e.to_string())?,
            heading_level: row.get(9).map_err(|e| e.to_string())?,
            byte_size: row.get(10).map_err(|e| e.to_string())?,
            excerpt: row.get(11).map_err(|e| e.to_string())?,
        });
    }
    Ok(out)
}

async fn collect_hits(rows: &mut libsql::Rows) -> Result<Vec<DocHit>, String> {
    let mut out = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        out.push(DocHit {
            id: row.get(0).map_err(|e| e.to_string())?,
            mirror: row.get(1).map_err(|e| e.to_string())?,
            layer: row.get(2).map_err(|e| e.to_string())?,
            category: row.get(3).map_err(|e| e.to_string())?,
            slug: row.get(4).map_err(|e| e.to_string())?,
            rel_path: row.get(5).map_err(|e| e.to_string())?,
            title: row.get(6).ok(),
            byte_size: row.get(7).map_err(|e| e.to_string())?,
            excerpt: row.get(8).map_err(|e| e.to_string())?,
        });
    }
    Ok(out)
}

fn build_fts_query(query: &str) -> String {
    let terms: Vec<String> = query
        .split_whitespace()
        .filter(|t| !t.is_empty())
        .map(|t| {
            let clean = t.replace('"', "");
            if clean.contains('*') || clean.contains(':') {
                clean
            } else {
                format!("\"{clean}\"")
            }
        })
        .collect();
    terms.join(" AND ")
}
