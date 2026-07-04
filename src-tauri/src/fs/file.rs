use super::path::{
    display_path, resolve_inside_working_dir, resolve_write_path_inside_working_dir,
};
use serde::Serialize;
use std::fs;

const MAX_READ_BYTES: u64 = 200 * 1024;
const MAX_WRITE_BYTES: usize = 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntryInfo {
    name: String,
    path: String,
    kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteFileResult {
    pub path: String,
    pub bytes: u64,
}

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

pub fn fs_write_file(
    working_dir: String,
    path: String,
    content: String,
) -> Result<WriteFileResult, String> {
    if content.len() > MAX_WRITE_BYTES {
        return Err(format!(
            "content is too large to write ({} bytes > {} byte limit)",
            content.len(),
            MAX_WRITE_BYTES
        ));
    }

    let file = resolve_write_path_inside_working_dir(&working_dir, &path)?;
    fs::write(&file, content.as_bytes()).map_err(|e| format!("failed to write file: {e}"))?;
    Ok(WriteFileResult {
        path: display_path(&file),
        bytes: content.len() as u64,
    })
}
