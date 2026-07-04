use sha2::{Digest, Sha256};
use std::path::Path;
use std::time::Duration;
use walkdir::WalkDir;

use crate::db::Db;

use super::ingest::{ingest_mirror, ingest_root, is_mirror, IngestReport};

#[derive(Debug, Clone, Copy)]
pub enum WatchIngestReason {
    Initial,
    Changed,
}

pub async fn watch_ingest_path<F>(
    db: &Db,
    path: &Path,
    poll: Duration,
    debounce: Duration,
    mut on_ingest: F,
) -> Result<(), String>
where
    F: FnMut(WatchIngestReason, &[IngestReport]),
{
    let path = path.canonicalize().map_err(|e| format!("path: {e}"))?;
    let mut signature = docs_signature(&path)?;
    let reports = ingest_path(db, &path).await?;
    on_ingest(WatchIngestReason::Initial, &reports);

    loop {
        std::thread::sleep(poll);
        let current = docs_signature(&path)?;
        if current == signature {
            continue;
        }

        let stable = wait_for_stable_signature(&path, current, poll, debounce)?;
        let reports = ingest_path(db, &path).await?;
        on_ingest(WatchIngestReason::Changed, &reports);
        signature = stable;
    }
}

async fn ingest_path(db: &Db, path: &Path) -> Result<Vec<IngestReport>, String> {
    if is_mirror(path) {
        Ok(vec![ingest_mirror(db, path).await?])
    } else {
        ingest_root(db, path).await
    }
}

fn wait_for_stable_signature(
    path: &Path,
    mut candidate: String,
    poll: Duration,
    debounce: Duration,
) -> Result<String, String> {
    let mut stable_for = Duration::ZERO;
    loop {
        std::thread::sleep(poll);
        let next = docs_signature(path)?;
        if next == candidate {
            stable_for += poll;
            if stable_for >= debounce {
                return Ok(next);
            }
        } else {
            candidate = next;
            stable_for = Duration::ZERO;
        }
    }
}

fn docs_signature(path: &Path) -> Result<String, String> {
    let mut entries = Vec::new();
    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        let modified = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_nanos())
            .unwrap_or_default();
        let rel = entry
            .path()
            .strip_prefix(path)
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        entries.push(format!("{rel}\0{modified}\0{}", meta.len()));
    }

    entries.sort_unstable();
    let mut hasher = Sha256::new();
    for entry in entries {
        hasher.update(entry.as_bytes());
        hasher.update([0]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}
