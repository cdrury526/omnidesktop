/**
 * A `fetch` that runs the request in Rust via the Tauri HTTP plugin, bypassing
 * webview CORS. External API calls (OpenRouter) must use this — calling
 * openrouter.ai directly from the webview origin fails with "Load failed".
 *
 * Falls back to the global fetch when not running inside Tauri (browser dev).
 */
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const appFetch: typeof fetch = inTauri
  ? (tauriFetch as unknown as typeof fetch)
  : globalThis.fetch.bind(globalThis);
