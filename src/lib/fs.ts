/**
 * Filesystem checks via Rust. The webview only holds path strings; validating
 * that a path exists goes through the host — same boundary as future fs tools.
 */
import { invoke } from "@tauri-apps/api/core";

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** True when `path` exists on disk and is a directory. Skips check in browser dev. */
export async function pathIsDir(path: string): Promise<boolean> {
  if (!inTauri) return true;
  return invoke<boolean>("path_is_dir", { path });
}
