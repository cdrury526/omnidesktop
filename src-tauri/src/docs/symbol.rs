use crate::db::Db;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolHit {
    pub id: i64,
    pub page_id: i64,
    pub name: String,
    pub kind: String,
    pub line: i64,
    pub snippet: String,
    pub mirror: String,
    pub layer: String,
    pub category: String,
    pub slug: String,
    pub rel_path: String,
    pub title: Option<String>,
}

pub async fn find_symbols(
    db: &Db,
    name: &str,
    mirror: Option<&str>,
    limit: u32,
) -> Result<Vec<SymbolHit>, String> {
    let query = name.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let like = format!("%{query}%");
    let lim = limit as i64;
    let conn = db.conn.clone();

    let mut rows = match mirror {
        Some(m) => {
            conn.query(
                "SELECT s.id, s.page_id, s.name, s.kind, s.line, s.snippet, \
                 p.mirror, p.layer, p.category, p.slug, p.rel_path, p.title \
                 FROM doc_symbols s JOIN doc_pages p ON p.id = s.page_id \
                 WHERE p.mirror = ? AND (lower(s.name) = lower(?) OR s.name LIKE ?) \
                 ORDER BY CASE WHEN lower(s.name) = lower(?) THEN 0 ELSE 1 END, \
                 s.name, p.rel_path LIMIT ?",
                libsql::params![m, query, like, query, lim],
            )
            .await
        }
        None => {
            conn.query(
                "SELECT s.id, s.page_id, s.name, s.kind, s.line, s.snippet, \
                 p.mirror, p.layer, p.category, p.slug, p.rel_path, p.title \
                 FROM doc_symbols s JOIN doc_pages p ON p.id = s.page_id \
                 WHERE lower(s.name) = lower(?) OR s.name LIKE ? \
                 ORDER BY CASE WHEN lower(s.name) = lower(?) THEN 0 ELSE 1 END, \
                 s.name, p.rel_path LIMIT ?",
                libsql::params![query, like, query, lim],
            )
            .await
        }
    }
    .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        out.push(SymbolHit {
            id: row.get(0).map_err(|e| e.to_string())?,
            page_id: row.get(1).map_err(|e| e.to_string())?,
            name: row.get(2).map_err(|e| e.to_string())?,
            kind: row.get(3).map_err(|e| e.to_string())?,
            line: row.get(4).map_err(|e| e.to_string())?,
            snippet: row.get(5).map_err(|e| e.to_string())?,
            mirror: row.get(6).map_err(|e| e.to_string())?,
            layer: row.get(7).map_err(|e| e.to_string())?,
            category: row.get(8).map_err(|e| e.to_string())?,
            slug: row.get(9).map_err(|e| e.to_string())?,
            rel_path: row.get(10).map_err(|e| e.to_string())?,
            title: row.get(11).ok(),
        });
    }
    Ok(out)
}
