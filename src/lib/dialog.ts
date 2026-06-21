/**
 * Native dialogs via the Tauri dialog plugin. Used by Code mode to pick a
 * working folder. The returned path is the user's own machine path (not a
 * secret) — but actual file access stays behind Rust commands later; the
 * webview only ever holds the string.
 */
import { open } from "@tauri-apps/plugin-dialog";

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Open a native directory picker; returns the chosen path or null if cancelled. */
export async function pickDirectory(): Promise<string | null> {
  if (!inTauri) return null;
  const selected = await open({ directory: true, multiple: false });
  return typeof selected === "string" ? selected : null;
}
