//! Filesystem helpers — the chokepoint for path checks and scoped file access.
//! The webview only holds path strings; anything that touches the disk goes
//! through here.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_READ_BYTES: u64 = 200 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntryInfo {
    name: String,
    path: String,
    kind: String,
    size: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDirResult {
    path: String,
    entries: Vec<DirEntryInfo>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileResult {
    path: String,
    content: String,
    bytes: u64,
}

fn canonical_root(working_dir: &str) -> Result<PathBuf, String> {
    let root = Path::new(working_dir)
        .canonicalize()
        .map_err(|e| format!("working_dir is not reachable: {e}"))?;
    if !root.is_dir() {
        return Err("working_dir is not a directory".to_string());
    }
    Ok(root)
}

fn resolve_inside_working_dir(working_dir: &str, path: &str) -> Result<PathBuf, String> {
    let root = canonical_root(working_dir)?;
    let requested = Path::new(path);
    let candidate = if requested.is_absolute() {
        requested.to_path_buf()
    } else {
        root.join(requested)
    };
    let resolved = candidate
        .canonicalize()
        .map_err(|e| format!("path is not reachable: {e}"))?;
    if !resolved.starts_with(&root) {
        return Err("path escapes working_dir".to_string());
    }
    Ok(resolved)
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

/// True when `path` exists on disk and is a directory.
#[tauri::command]
pub fn path_is_dir(path: String) -> Result<bool, String> {
    let p = std::path::Path::new(&path);
    Ok(p.is_dir())
}

#[tauri::command]
pub fn fs_list_dir(working_dir: String, path: String) -> Result<ListDirResult, String> {
    let dir = resolve_inside_working_dir(&working_dir, &path)?;
    if !dir.is_dir() {
        return Err("path is not a directory".to_string());
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| format!("failed to read directory: {e}"))? {
        let entry = entry.map_err(|e| format!("failed to read directory entry: {e}"))?;
        let entry_path = entry.path();
        let metadata = fs::symlink_metadata(&entry_path)
            .map_err(|e| format!("failed to read entry metadata: {e}"))?;
        let file_type = metadata.file_type();
        let kind = if file_type.is_symlink() {
            "symlink"
        } else if file_type.is_dir() {
            "directory"
        } else if file_type.is_file() {
            "file"
        } else {
            "other"
        };
        entries.push(DirEntryInfo {
            name: entry.file_name().to_string_lossy().into_owned(),
            path: display_path(&entry_path),
            kind: kind.to_string(),
            size: if file_type.is_file() {
                Some(metadata.len())
            } else {
                None
            },
        });
    }
    entries.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(ListDirResult {
        path: display_path(&dir),
        entries,
    })
}

#[tauri::command]
pub fn fs_read_file(working_dir: String, path: String) -> Result<ReadFileResult, String> {
    let file = resolve_inside_working_dir(&working_dir, &path)?;
    if !file.is_file() {
        return Err("path is not a file".to_string());
    }

    let metadata = fs::metadata(&file).map_err(|e| format!("failed to read metadata: {e}"))?;
    if metadata.len() > MAX_READ_BYTES {
        return Err(format!(
            "file is too large to read ({} bytes > {} byte limit)",
            metadata.len(),
            MAX_READ_BYTES
        ));
    }

    let content =
        fs::read_to_string(&file).map_err(|e| format!("failed to read file as UTF-8 text: {e}"))?;
    Ok(ReadFileResult {
        path: display_path(&file),
        bytes: metadata.len(),
        content,
    })
}

#[cfg(test)]
mod tests {
    use super::resolve_inside_working_dir;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_root() -> std::path::PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("omni-fs-test-{suffix}"));
        fs::create_dir_all(&root).expect("create temp root");
        root
    }

    #[test]
    fn resolves_relative_path_inside_root() {
        let root = temp_root();
        fs::write(root.join("ok.txt"), "ok").expect("write file");

        let resolved = resolve_inside_working_dir(root.to_str().unwrap(), "ok.txt")
            .expect("resolve inside root");
        assert_eq!(resolved, root.join("ok.txt").canonicalize().unwrap());
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn rejects_parent_escape() {
        let root = temp_root();
        let outside = root.parent().unwrap().join("outside.txt");
        fs::write(&outside, "nope").expect("write outside file");

        let err = resolve_inside_working_dir(root.to_str().unwrap(), "../outside.txt")
            .expect_err("escape should fail");
        assert!(err.contains("escapes working_dir"));
        fs::remove_file(outside).ok();
        fs::remove_dir_all(root).ok();
    }
}
