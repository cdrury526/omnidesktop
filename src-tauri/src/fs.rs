//! Filesystem helpers — the chokepoint for path checks and (later) scoped file
//! access. The webview only holds path strings; anything that touches the disk
//! goes through here.

/// True when `path` exists on disk and is a directory.
#[tauri::command]
pub fn path_is_dir(path: String) -> Result<bool, String> {
    let p = std::path::Path::new(&path);
    Ok(p.is_dir())
}
