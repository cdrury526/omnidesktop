use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use crate::db::Db;

const LAYERS: &[&str] = &[
    "official",
    "published",
    "source",
    "reference",
    "guides",
    "index",
];

const SKIP_FILES: &[&str] = &["llms-full.txt"];

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestReport {
    pub mirror: String,
    pub scanned: u32,
    pub inserted: u32,
    pub updated: u32,
    pub skipped: u32,
    pub removed: u32,
}

/// Ingest every mirror directory under `root` (e.g. `docs/`).
pub async fn ingest_root(db: &Db, root: &Path) -> Result<Vec<IngestReport>, String> {
    let mut reports = Vec::new();
    let entries = std::fs::read_dir(root).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('_') || name.starts_with('.') {
            continue;
        }
        if is_mirror(&path) {
            reports.push(ingest_mirror(db, &path).await?);
        }
    }
    Ok(reports)
}

/// Ingest a single mirror root (e.g. `docs/openrouter-agent-sdk`).
pub async fn ingest_mirror(db: &Db, mirror_root: &Path) -> Result<IngestReport, String> {
    let mirror_root = mirror_root
        .canonicalize()
        .map_err(|e| format!("mirror path: {e}"))?;
    let slug = mirror_root
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or("mirror path has no directory name")?
        .to_string();

    let provenance = read_provenance(&mirror_root);
    let source_id = upsert_source(db, &slug, &mirror_root, &provenance).await?;
    wipe_pages_for_source(db, source_id).await?;

    let mut report = IngestReport {
        mirror: slug.clone(),
        scanned: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        removed: 0,
    };

    let url_map = load_url_map(&mirror_root);

    for entry in WalkDir::new(&mirror_root)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let abs = entry.path();
        let rel = abs
            .strip_prefix(&mirror_root)
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .replace('\\', "/");

        let parts: Vec<&str> = rel.split('/').collect();
        if parts.is_empty() || parts[0].starts_with('_') {
            continue;
        }
        if parts[0] == "README.md" && parts.len() == 1 {
            continue;
        }

        let layer = parts[0];
        if !LAYERS.contains(&layer) {
            continue;
        }

        let file_name = parts.last().copied().unwrap_or("");
        if SKIP_FILES.contains(&file_name) {
            report.skipped += 1;
            continue;
        }

        if !is_indexable(layer, file_name) {
            continue;
        }

        report.scanned += 1;

        let category = if parts.len() > 2 {
            parts[1..parts.len() - 1].join("/")
        } else {
            String::new()
        };
        let slug_name = Path::new(file_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(file_name)
            .to_string();
        let format = extension_format(file_name);
        let content = std::fs::read_to_string(abs).map_err(|e| format!("read {rel}: {e}"))?;
        let byte_size = content.len() as i64;
        let content_hash = hash_content(&content);
        let title = extract_title(&content, &slug_name);
        let source_url = url_map.get(&rel).cloned();

        insert_page(
            db,
            source_id,
            &slug,
            layer,
            &category,
            &slug_name,
            &rel,
            &title,
            &format,
            source_url.as_deref(),
            &content,
            &content_hash,
            byte_size,
        )
        .await?;
        report.inserted += 1;
    }

    Ok(report)
}

fn is_mirror(path: &Path) -> bool {
    path.join("_provenance").is_dir() || LAYERS.iter().any(|layer| path.join(layer).is_dir())
}

fn is_indexable(layer: &str, file_name: &str) -> bool {
    let ext = Path::new(file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    match layer {
        "reference" => matches!(ext, "md" | "ts" | "py"),
        "index" => matches!(ext, "txt" | "json"),
        _ => matches!(ext, "md" | "mdx"),
    }
}

fn extension_format(file_name: &str) -> String {
    Path::new(file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("txt")
        .to_string()
}

fn hash_content(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn extract_title(content: &str, fallback: &str) -> String {
    for line in content.lines().take(30) {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("# ") {
            return rest.trim().to_string();
        }
    }
    fallback.to_string()
}

struct Provenance {
    commit: Option<String>,
    synced_at: Option<String>,
    repository: Option<String>,
}

fn read_provenance(mirror_root: &Path) -> Provenance {
    let dir = mirror_root.join("_provenance");
    let commit = read_trimmed_file(dir.join("SOURCE_COMMIT.txt"));
    let synced_at = read_trimmed_file(dir.join("SYNCED_AT.txt"));
    let repository = read_repository_from_manifest(&dir.join("MANIFEST.json"));
    Provenance {
        commit,
        synced_at,
        repository,
    }
}

fn read_trimmed_file(path: PathBuf) -> Option<String> {
    std::fs::read_to_string(path)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn read_repository_from_manifest(path: &Path) -> Option<String> {
    let raw = std::fs::read_to_string(path).ok()?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    v.get("source")
        .and_then(|s| s.get("repository"))
        .and_then(|r| r.as_str())
        .map(str::to_string)
}

fn load_url_map(mirror_root: &Path) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let manifest = mirror_root.join("index/PAGE_MANIFEST.json");
    if let Ok(raw) = std::fs::read_to_string(&manifest) {
        if let Ok(entries) = serde_json::from_str::<Vec<serde_json::Value>>(&raw) {
            for entry in entries {
                let path = entry.get("path").and_then(|p| p.as_str());
                let url = entry.get("url").and_then(|u| u.as_str());
                if let (Some(p), Some(u)) = (path, url) {
                    let rel = p
                        .strip_prefix("web-docs/")
                        .or_else(|| p.strip_prefix("published/"))
                        .unwrap_or(p);
                    map.insert(rel.to_string(), u.to_string());
                }
            }
        }
    }
    map
}

async fn upsert_source(db: &Db, slug: &str, root: &Path, prov: &Provenance) -> Result<i64, String> {
    let conn = db.conn.clone();
    conn.execute(
        "INSERT INTO doc_sources(slug, root_path, repository, commit_hash, synced_at) \
         VALUES(?, ?, ?, ?, ?) \
         ON CONFLICT(slug) DO UPDATE SET \
           root_path = excluded.root_path, \
           repository = excluded.repository, \
           commit_hash = excluded.commit_hash, \
           synced_at = excluded.synced_at, \
           ingested_at = datetime('now')",
        libsql::params![
            slug,
            root.to_string_lossy().as_ref(),
            prov.repository.as_deref(),
            prov.commit.as_deref(),
            prov.synced_at.as_deref(),
        ],
    )
    .await
    .map_err(|e| e.to_string())?;

    let mut rows = conn
        .query(
            "SELECT id FROM doc_sources WHERE slug = ?",
            libsql::params![slug],
        )
        .await
        .map_err(|e| e.to_string())?;
    let row = rows.next().await.map_err(|e| e.to_string())?;
    row.and_then(|r| r.get::<i64>(0).ok())
        .ok_or_else(|| format!("source id missing for {slug}"))
}

async fn wipe_pages_for_source(db: &Db, source_id: i64) -> Result<(), String> {
    let conn = db.conn.clone();
    conn.execute(
        "DELETE FROM doc_pages WHERE source_id = ?",
        libsql::params![source_id],
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

async fn insert_page(
    db: &Db,
    source_id: i64,
    mirror: &str,
    layer: &str,
    category: &str,
    slug: &str,
    rel_path: &str,
    title: &str,
    format: &str,
    source_url: Option<&str>,
    content: &str,
    content_hash: &str,
    byte_size: i64,
) -> Result<(), String> {
    let conn = db.conn.clone();
    conn.execute(
        "INSERT INTO doc_pages(source_id, mirror, layer, category, slug, rel_path, title, format, \
         source_url, content, content_hash, byte_size) \
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        libsql::params![
            source_id,
            mirror,
            layer,
            category,
            slug,
            rel_path,
            title,
            format,
            source_url,
            content,
            content_hash,
            byte_size,
        ],
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}
