use super::file::fs_write_file;
use super::path::{resolve_inside_working_dir, resolve_write_path_inside_working_dir};
use super::process::run_command_blocking;
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

    let resolved =
        resolve_inside_working_dir(root.to_str().unwrap(), "ok.txt").expect("resolve inside root");
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
    let result = run_command_blocking(
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
