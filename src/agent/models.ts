/**
 * OpenRouter model catalog. The /models endpoint is public (no key needed) and
 * returns ~340 models, each advertising `supported_parameters` — we use that to
 * filter to tool-capable models, since auto-summon needs the model to call tools.
 */
export interface ORModel {
  id: string;
  name: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
}

import { appFetch } from "../lib/tauri-fetch";

let cache: ORModel[] | null = null;

export async function listModels(): Promise<ORModel[]> {
  if (cache) return cache;
  const res = await appFetch("https://openrouter.ai/api/v1/models");
  if (!res.ok) throw new Error(`models endpoint ${res.status}`);
  const json = (await res.json()) as { data: ORModel[] };
  cache = json.data ?? [];
  return cache;
}

export function supportsTools(m: ORModel): boolean {
  return m.supported_parameters?.includes("tools") ?? false;
}

/** A reasonable default if present in the catalog. */
export const PREFERRED_DEFAULTS = [
  "anthropic/claude-opus-4",
  "anthropic/claude-3.7-sonnet",
  "openai/gpt-5",
  "google/gemini-2.5-pro",
];
