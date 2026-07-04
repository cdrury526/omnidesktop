//! Filesystem helpers — the chokepoint for path checks and scoped file access.
//! The webview only holds path strings; anything that touches the disk goes
//! through here.

mod file;
mod path;
mod process;

#[cfg(test)]
mod tests;

/// True when `path` exists on disk and is a directory.
#[tauri::command]
pub fn path_is_dir(path: String) -> Result<bool, String> {
    let p = std::path::Path::new(&path);
    Ok(p.is_dir())
}

#[tauri::command]
pub fn fs_list_dir(working_dir: String, path: String) -> Result<file::ListDirResult, String> {
    file::fs_list_dir(working_dir, path)
}

#[tauri::command]
pub fn fs_read_file(working_dir: String, path: String) -> Result<file::ReadFileResult, String> {
    file::fs_read_file(working_dir, path)
}

#[tauri::command]
pub fn fs_write_file(
    working_dir: String,
    path: String,
    content: String,
) -> Result<file::WriteFileResult, String> {
    file::fs_write_file(working_dir, path, content)
}

#[tauri::command]
pub async fn run_command(
    working_dir: String,
    command: String,
    args: Option<Vec<String>>,
    timeout_ms: Option<u64>,
) -> Result<process::RunCommandResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        process::run_command_blocking(working_dir, command, args, timeout_ms)
    })
    .await
    .map_err(|e| format!("command task failed: {e}"))?
}
