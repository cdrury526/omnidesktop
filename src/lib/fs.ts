/**
 * Filesystem checks via Rust. The webview only holds path strings; validating
 * that a path exists goes through the host — same boundary as future fs tools.
 */
import { invoke } from "@tauri-apps/api/core";

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface FsDirEntry {
  name: string;
  path: string;
  kind: "file" | "directory" | "symlink" | "other";
  size?: number;
}

export interface FsListDirResult {
  path: string;
  entries: FsDirEntry[];
}

export interface FsReadFileResult {
  path: string;
  content: string;
  bytes: number;
}

export interface FsWriteFileResult {
  path: string;
  bytes: number;
}

export interface RunCommandResult {
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  success: boolean;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
}

/** True when `path` exists on disk and is a directory. Skips check in browser dev. */
export async function pathIsDir(path: string): Promise<boolean> {
  if (!inTauri) return true;
  return invoke<boolean>("path_is_dir", { path });
}

export async function fsListDir(workingDir: string, path: string): Promise<FsListDirResult> {
  if (!inTauri) return { path, entries: [] };
  return invoke<FsListDirResult>("fs_list_dir", { workingDir, path });
}

export async function fsReadFile(workingDir: string, path: string): Promise<FsReadFileResult> {
  if (!inTauri) return { path, content: "", bytes: 0 };
  return invoke<FsReadFileResult>("fs_read_file", { workingDir, path });
}

export async function fsWriteFile(
  workingDir: string,
  path: string,
  content: string,
): Promise<FsWriteFileResult> {
  if (!inTauri) return { path, bytes: new TextEncoder().encode(content).length };
  return invoke<FsWriteFileResult>("fs_write_file", { workingDir, path, content });
}

export async function runCommand(
  workingDir: string,
  command: string,
  args?: string[],
  timeoutMs?: number,
): Promise<RunCommandResult> {
  if (!inTauri) {
    return {
      command,
      args: args ?? [],
      cwd: workingDir,
      exitCode: 0,
      success: true,
      timedOut: false,
      stdout: "",
      stderr: "",
      stdoutTruncated: false,
      stderrTruncated: false,
    };
  }
  return invoke<RunCommandResult>("run_command", { workingDir, command, args, timeoutMs });
}
