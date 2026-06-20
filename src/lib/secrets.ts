/**
 * API key storage via the OS keyring (Rust commands -> Secret Service on Linux).
 *
 * Guarded so the app still runs in a plain browser (`pnpm dev:all` without
 * Tauri), where `invoke` is unavailable — there it degrades to no persistence.
 */
import { invoke } from "@tauri-apps/api/core";

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function saveApiKey(key: string): Promise<void> {
  if (!inTauri) return;
  await invoke("save_api_key", { key });
}

export async function getApiKey(): Promise<string | null> {
  if (!inTauri) return null;
  try {
    return (await invoke<string | null>("get_api_key")) ?? null;
  } catch {
    return null;
  }
}

export async function deleteApiKey(): Promise<void> {
  if (!inTauri) return;
  try {
    await invoke("delete_api_key");
  } catch {
    /* ignore */
  }
}

export const keyringAvailable = inTauri;
