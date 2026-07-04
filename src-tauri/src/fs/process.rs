use super::path::{canonical_root, display_path};
use serde::Serialize;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const MAX_COMMAND_OUTPUT_BYTES: usize = 64 * 1024;
const DEFAULT_COMMAND_TIMEOUT_MS: u64 = 30_000;
const MAX_COMMAND_TIMEOUT_MS: u64 = 120_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunCommandResult {
    command: String,
    args: Vec<String>,
    pub cwd: String,
    exit_code: Option<i32>,
    pub success: bool,
    timed_out: bool,
    pub stdout: String,
    stderr: String,
    stdout_truncated: bool,
    stderr_truncated: bool,
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

pub fn run_command_blocking(
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
