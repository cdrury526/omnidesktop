use crate::db::Db;

use super::search::DocMeta;

pub async fn related_pages(db: &Db, id: i64, limit: u32) -> Result<Option<Vec<DocMeta>>, String> {
    let conn = db.conn.clone();
    let mut source_rows = conn
        .query(
            "SELECT mirror, layer, category FROM doc_pages WHERE id = ?",
            libsql::params![id],
        )
        .await
        .map_err(|e| e.to_string())?;
    let Some(source) = source_rows.next().await.map_err(|e| e.to_string())? else {
        return Ok(None);
    };

    let mirror: String = source.get(0).map_err(|e| e.to_string())?;
    let layer: String = source.get(1).map_err(|e| e.to_string())?;
    let category: String = source.get(2).map_err(|e| e.to_string())?;
    let lim = limit as i64;

    let mut rows = if category.is_empty() {
        conn.query(
            "SELECT id, mirror, layer, category, slug, title, rel_path, byte_size \
             FROM doc_pages WHERE id != ? AND mirror = ? AND layer = ? AND category = '' \
             ORDER BY CASE layer WHEN 'official' THEN 0 WHEN 'published' THEN 1 WHEN 'guides' THEN 2 WHEN 'source' THEN 3 WHEN 'reference' THEN 4 ELSE 5 END, rel_path LIMIT ?",
            libsql::params![id, mirror, layer, lim],
        )
        .await
    } else {
        conn.query(
            "SELECT id, mirror, layer, category, slug, title, rel_path, byte_size \
             FROM doc_pages WHERE id != ? AND mirror = ? AND category = ? \
             ORDER BY CASE layer WHEN 'official' THEN 0 WHEN 'published' THEN 1 WHEN 'guides' THEN 2 WHEN 'source' THEN 3 WHEN 'reference' THEN 4 ELSE 5 END, rel_path LIMIT ?",
            libsql::params![id, mirror, category, lim],
        )
        .await
    }
    .map_err(|e| e.to_string())?;

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

    Ok(Some(out))
}
