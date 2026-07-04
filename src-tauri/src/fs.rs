//! Filesystem helpers — the chokepoint for path checks and scoped file access.
//! The webview only holds path strings; anything that touches the disk goes
//! through here.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const MAX_READ_BYTES: u64 = 200 * 1024;
const MAX_WRITE_BYTES: usize = 1024 * 1024;
const MAX_COMMAND_OUTPUT_BYTES: usize = 64 * 1024;
const DEFAULT_COMMAND_TIMEOUT_MS: u64 = 30_000;
const MAX_COMMAND_TIMEOUT_MS: u64 = 120_000;

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteFileResult {
    path: String,
    bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunCommandResult {
    command: String,
    args: Vec<String>,
    cwd: String,
    exit_code: Option<i32>,
    success: bool,
    timed_out: bool,
    stdout: String,
    stderr: String,
    stdout_truncated: bool,
    stderr_truncated: bool,
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

fn resolve_write_path_inside_working_dir(working_dir: &str, path: &str) -> Result<PathBuf, String> {
    let root = canonical_root(working_dir)?;
    let requested = Path::new(path);
    let candidate = if requested.is_absolute() {
        requested.to_path_buf()
    } else {
        root.join(requested)
    };

    if candidate.symlink_metadata().is_ok() {
        let resolved = candidate
            .canonicalize()
            .map_err(|e| format!("path is not reachable: {e}"))?;
        if !resolved.starts_with(&root) {
            return Err("path escapes working_dir".to_string());
        }
        if resolved.is_dir() {
            return Err("path is a directory".to_string());
        }
        return Ok(resolved);
    }

    let parent = candidate
        .parent()
        .ok_or_else(|| "path has no parent directory".to_string())?;
    let parent = parent
        .canonicalize()
        .map_err(|e| format!("parent directory is not reachable: {e}"))?;
    if !parent.starts_with(&root) {
        return Err("path escapes working_dir".to_string());
    }
    let name = candidate
        .file_name()
        .ok_or_else(|| "path must include a file name".to_string())?;
    Ok(parent.join(name))
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn truncate_utf8(bytes: &[u8]) -> (String, bool) {
    let truncated = bytes.len() > MAX_COMMAND_OUTPUT_BYTES;
    let slice = if truncated {
        &bytes[..MAX_COMMAND_OUTPUT_BYTES]
    } else {
        bytes
    };
    (String::from_utf8_lossy(slice).into_owned(), truncated)
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

#[tauri::command]
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

#[tauri::command]
pub fn run_command(
    working_dir: String,
    command: String,
    args: Option<Vec<String>>,
    timeout_ms: Option<u64>,
) -> Result<RunCommandResult, String> {
    if command.trim().is_empty() {
        return Err("command is required".to_string());
    }

    let root = canonical_root(&working_dir)?;
    let args = args.unwrap_or_default();
    let timeout_ms = timeout_ms
        .unwrap_or(DEFAULT_COMMAND_TIMEOUT_MS)
        .clamp(1, MAX_COMMAND_TIMEOUT_MS);

    let mut child = Command::new(&command)
        .args(&args)
        .current_dir(&root)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to start command: {e}"))?;

    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let timed_out = loop {
        if child
            .try_wait()
            .map_err(|e| format!("failed to poll command: {e}"))?
            .is_some()
        {
            break false;
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            break true;
        }
        thread::sleep(Duration::from_millis(20));
    };

    let output = child
        .wait_with_output()
        .map_err(|e| format!("failed to collect command output: {e}"))?;
    let (stdout, stdout_truncated) = truncate_utf8(&output.stdout);
    let (stderr, stderr_truncated) = truncate_utf8(&output.stderr);

    Ok(RunCommandResult {
        command,
        args,
        cwd: display_path(&root),
        exit_code: output.status.code(),
        success: output.status.success(),
        timed_out,
        stdout,
        stderr,
        stdout_truncated,
        stderr_truncated,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        fs_write_file, resolve_inside_working_dir, resolve_write_path_inside_working_dir,
        run_command,
    };
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

    #[test]
    fn write_path_allows_new_file_inside_root() {
        let root = temp_root();
        let resolved = resolve_write_path_inside_working_dir(root.to_str().unwrap(), "nested.txt")
            .expect("resolve write path inside root");
        assert_eq!(
            resolved,
            root.join("nested.txt")
                .canonicalize()
                .unwrap_or(root.join("nested.txt"))
        );
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn write_file_creates_file_inside_root() {
        let root = temp_root();
        let result = fs_write_file(
            root.to_string_lossy().into_owned(),
            "created.txt".to_string(),
            "hello".to_string(),
        )
        .expect("write file");
        assert_eq!(result.bytes, 5);
        assert_eq!(
            fs::read_to_string(root.join("created.txt")).unwrap(),
            "hello"
        );
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn write_rejects_parent_escape() {
        let root = temp_root();
        let err = fs_write_file(
            root.to_string_lossy().into_owned(),
            "../outside-write.txt".to_string(),
            "nope".to_string(),
        )
        .expect_err("escape should fail");
        assert!(err.contains("escapes working_dir"));
        fs::remove_dir_all(root).ok();
    }

    #[cfg(unix)]
    #[test]
    fn write_rejects_dangling_symlink_escape() {
        let root = temp_root();
        let outside = root.parent().unwrap().join("dangling-target.txt");
        std::os::unix::fs::symlink(&outside, root.join("link.txt")).expect("create symlink");

        let err = fs_write_file(
            root.to_string_lossy().into_owned(),
            "link.txt".to_string(),
            "nope".to_string(),
        )
        .expect_err("dangling symlink should fail");
        assert!(err.contains("path is not reachable"));
        assert!(!outside.exists());
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn command_runs_in_working_dir() {
        let root = temp_root();
        fs::write(root.join("marker.txt"), "ok").expect("write marker");
        let result = run_command(
            root.to_string_lossy().into_owned(),
            "pwd".to_string(),
            None,
            Some(5_000),
        )
        .expect("run pwd");
        assert!(result.success);
        assert_eq!(result.cwd, root.canonicalize().unwrap().to_string_lossy());
        assert_eq!(
            result.stdout.trim(),
            root.canonicalize().unwrap().to_string_lossy()
        );
        fs::remove_dir_all(root).ok();
    }
}
