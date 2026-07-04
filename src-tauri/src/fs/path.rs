use std::path::{Path, PathBuf};

pub fn canonical_root(working_dir: &str) -> Result<PathBuf, String> {
    let root = Path::new(working_dir)
        .canonicalize()
        .map_err(|e| format!("working_dir is not reachable: {e}"))?;
    if !root.is_dir() {
        return Err("working_dir is not a directory".to_string());
    }
    Ok(root)
}

pub fn resolve_inside_working_dir(working_dir: &str, path: &str) -> Result<PathBuf, String> {
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

pub fn resolve_write_path_inside_working_dir(
    working_dir: &str,
    path: &str,
) -> Result<PathBuf, String> {
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

pub fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}
