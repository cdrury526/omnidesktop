/**
 * Frontend database API. Mirrors tauri-plugin-sql's ergonomics (db.execute /
 * db.select with SQL + positional params), but under the hood it's libSQL
 * running behind Rust commands — so the DB credential/sync token never enters
 * the webview. Local file now; flip on Turso sync in Rust later, no JS change.
 */
import { invoke } from "@tauri-apps/api/core";

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface ExecResult {
  rowsAffected: number;
  lastInsertId: number;
}

export async function dbExecute(sql: string, params: unknown[] = []): Promise<ExecResult> {
  if (!inTauri) return { rowsAffected: 0, lastInsertId: 0 };
  return invoke<ExecResult>("db_execute", { sql, params });
}

export async function dbSelect<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!inTauri) return [];
  return invoke<T[]>("db_select", { sql, params });
}

// ---- settings (key/value) convenience helpers ----

export async function getSetting(key: string): Promise<string | null> {
  const rows = await dbSelect<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await dbExecute(
    "INSERT INTO settings(key, value) VALUES(?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}

// ---- tool registry / policy ----

export type ToolSource = "builtin:code" | "mcp";

export interface ToolRegistryRow {
  id: number;
  source: ToolSource;
  source_id: string;
  name: string;
  title: string | null;
  description: string | null;
  enabled: number;
  updated_at: string;
}

export interface ToolRegistryInput {
  source: ToolSource;
  sourceId?: string | null;
  name: string;
  title?: string | null;
  description?: string | null;
}

export function toolPolicyKey(source: ToolSource, sourceId: string | null | undefined, name: string): string {
  return `${source}:${sourceId ?? ""}:${name}`;
}

export function toolEnabledMap(rows: ToolRegistryRow[]): Map<string, boolean> {
  return new Map(rows.map((r) => [toolPolicyKey(r.source, r.source_id || null, r.name), !!r.enabled]));
}

export async function listToolRegistry(): Promise<ToolRegistryRow[]> {
  return dbSelect<ToolRegistryRow>(
    "SELECT id, source, source_id, name, title, description, enabled, updated_at " +
      "FROM tool_registry ORDER BY source, source_id, name",
  );
}

/** Built-ins plus MCP tools for the connected server (stale MCP rows stay in DB). */
export async function listActiveToolRegistry(
  activeMcpUrl: string | null,
): Promise<ToolRegistryRow[]> {
  if (activeMcpUrl) {
    return dbSelect<ToolRegistryRow>(
      "SELECT id, source, source_id, name, title, description, enabled, updated_at " +
        "FROM tool_registry " +
        "WHERE source = 'builtin:code' OR (source = 'mcp' AND source_id = ?) " +
        "ORDER BY source, source_id, name",
      [activeMcpUrl],
    );
  }
  return dbSelect<ToolRegistryRow>(
    "SELECT id, source, source_id, name, title, description, enabled, updated_at " +
      "FROM tool_registry WHERE source = 'builtin:code' ORDER BY name",
  );
}

export async function upsertToolRegistry(tools: ToolRegistryInput[]): Promise<void> {
  for (const t of tools) {
    await dbExecute(
      "INSERT INTO tool_registry(source, source_id, name, title, description) VALUES(?, ?, ?, ?, ?) " +
        "ON CONFLICT(source, source_id, name) DO UPDATE SET " +
        "title = COALESCE(excluded.title, tool_registry.title), " +
        "description = COALESCE(excluded.description, tool_registry.description), " +
        "updated_at = datetime('now')",
      [t.source, t.sourceId ?? "", t.name, t.title ?? null, t.description ?? null],
    );
  }
}

export async function setToolEnabled(
  source: ToolSource,
  sourceId: string | null | undefined,
  name: string,
  enabled: boolean,
): Promise<void> {
  await dbExecute(
    "UPDATE tool_registry SET enabled = ?, updated_at = datetime('now') " +
      "WHERE source = ? AND source_id = ? AND name = ?",
    [enabled ? 1 : 0, source, sourceId ?? "", name],
  );
}

// ---- MCP server registry ----

export interface McpServerRow {
  id: number;
  name: string | null;
  url: string;
  enabled: number;
}

export async function upsertMcpServer(url: string, name?: string): Promise<void> {
  await dbExecute(
    "INSERT INTO mcp_servers(url, name) VALUES(?, ?) " +
      "ON CONFLICT(url) DO UPDATE SET name = COALESCE(excluded.name, mcp_servers.name)",
    [url, name ?? null],
  );
}

export async function listMcpServers(): Promise<McpServerRow[]> {
  return dbSelect<McpServerRow>(
    "SELECT id, name, url, enabled FROM mcp_servers ORDER BY created_at",
  );
}

// ---- conversations & messages ----

export interface ConversationRow {
  id: number;
  title: string | null;
  updated_at: string;
  code_mode: number;
  working_dir: string | null;
}

export interface StoredMessage {
  role: string;
  content: string;
}

export async function createConversation(title: string): Promise<number> {
  const r = await dbExecute("INSERT INTO conversations(title) VALUES(?)", [title]);
  return r.lastInsertId;
}

export async function renameConversation(id: number, title: string): Promise<void> {
  await dbExecute("UPDATE conversations SET title = ? WHERE id = ?", [title, id]);
}

export async function listConversations(): Promise<ConversationRow[]> {
  return dbSelect<ConversationRow>(
    "SELECT id, title, updated_at, code_mode, working_dir FROM conversations " +
      "ORDER BY updated_at DESC, id DESC LIMIT 100",
  );
}

/**
 * Legacy text history reader. Conversations created before the SDK-state
 * migration stored only `{role, content}` text rows; we still read them so old
 * chats render. New turns persist full SDK state via {@link conversationStateAccessor}.
 */
export async function getMessages(conversationId: number): Promise<StoredMessage[]> {
  return dbSelect<StoredMessage>(
    "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id",
    [conversationId],
  );
}

// ---- per-conversation Code mode (working folder) ----
//
// Code mode binds a chat to a project folder. We store the toggle + the chosen
// path as columns on `conversations` (added in migration 0002). The path feeds
// the agent's system prompt; file access stays behind Rust later.

export interface CodeModeState {
  codeMode: boolean;
  workingDir: string | null;
}

export async function getCodeMode(id: number): Promise<CodeModeState> {
  const rows = await dbSelect<{ code_mode: number; working_dir: string | null }>(
    "SELECT code_mode, working_dir FROM conversations WHERE id = ?",
    [id],
  );
  const row = rows[0];
  return { codeMode: !!row?.code_mode, workingDir: row?.working_dir ?? null };
}

export async function setCodeMode(
  id: number,
  { codeMode, workingDir }: CodeModeState,
): Promise<void> {
  await dbExecute(
    "UPDATE conversations SET code_mode = ?, working_dir = ? WHERE id = ?",
    [codeMode ? 1 : 0, workingDir, id],
  );
}

// ---- SDK conversation state (full item history incl. tool calls/results) ----
//
// The OpenRouter agent SDK owns a `ConversationState` per chat: the complete
// item stream (user/assistant messages, function_call + function_call_output
// items) plus `previousResponseId` for server-side chaining. We persist it as
// one JSON blob and hand the SDK a StateAccessor so it rehydrates history and
// auto-saves after every turn — see `runner.ts`.

export async function getConversationState(id: number): Promise<unknown | null> {
  const rows = await dbSelect<{ state: string }>(
    "SELECT state FROM conversation_state WHERE conversation_id = ?",
    [id],
  );
  return rows[0] ? JSON.parse(rows[0].state) : null;
}

export async function saveConversationState(id: number, state: unknown): Promise<void> {
  await dbExecute(
    "INSERT INTO conversation_state(conversation_id, state) VALUES(?, ?) " +
      "ON CONFLICT(conversation_id) DO UPDATE SET " +
      "state = excluded.state, updated_at = datetime('now')",
    [id, JSON.stringify(state)],
  );
}

/** A DB-backed SDK StateAccessor (`{ load, save }`) bound to one conversation. */
export function conversationStateAccessor(id: number) {
  return {
    load: () => getConversationState(id),
    save: (state: unknown) => saveConversationState(id, state),
  };
}

// ---- interactive-form observability ----
//
// One row per form interaction: the spec the agent emitted, whether it
// validated, the user's result, and how it ended. The `issues` column is the
// dataset for "what are agents tripping on" — feeds tightening the DSL schema.

export interface FormEvent {
  conversationId: number | null;
  toolName: string;
  spec: unknown;
  specValid: boolean;
  issues?: unknown;
  result?: unknown;
  status: "submitted" | "spec_rejected" | "cancelled";
}

export async function logFormEvent(e: FormEvent): Promise<void> {
  await dbExecute(
    "INSERT INTO form_events(conversation_id, tool_name, spec, spec_valid, issues, result, status) " +
      "VALUES(?, ?, ?, ?, ?, ?, ?)",
    [
      e.conversationId,
      e.toolName,
      JSON.stringify(e.spec ?? null),
      e.specValid ? 1 : 0,
      e.issues === undefined ? null : JSON.stringify(e.issues),
      e.result === undefined ? null : JSON.stringify(e.result),
      e.status,
    ],
  );
}

/** Bump updated_at (for recency ordering); optionally set a title if unset. */
export async function touchConversation(id: number, title?: string): Promise<void> {
  if (title !== undefined) {
    await dbExecute(
      "UPDATE conversations SET updated_at = datetime('now'), title = COALESCE(title, ?) WHERE id = ?",
      [title, id],
    );
  } else {
    await dbExecute(
      "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?",
      [id],
    );
  }
}

export async function deleteConversation(id: number): Promise<void> {
  await dbExecute("DELETE FROM tabs WHERE conversation_id = ?", [id]);
  await dbExecute("DELETE FROM messages WHERE conversation_id = ?", [id]);
  await dbExecute("DELETE FROM conversations WHERE id = ?", [id]);
}

// ---- open tabs (tab bar persistence) ----
//
// Each row is one tab in the VS Code-style tab bar. Restored on startup in
// position order; the active tab id lives in settings (`active_tab_id`).

export interface TabRow {
  id: number;
  conversation_id: number | null;
  working_dir: string | null;
  position: number;
}

export async function listTabs(): Promise<TabRow[]> {
  return dbSelect<TabRow>(
    "SELECT id, conversation_id, working_dir, position FROM tabs ORDER BY position, id",
  );
}

export async function createTab(
  conversationId: number | null = null,
  workingDir: string | null = null,
): Promise<number> {
  const r = await dbExecute(
    "INSERT INTO tabs(kind, conversation_id, working_dir, position) " +
      "VALUES('chat', ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM tabs))",
    [conversationId, workingDir],
  );
  return r.lastInsertId;
}

export async function deleteTab(id: number): Promise<void> {
  await dbExecute("DELETE FROM tabs WHERE id = ?", [id]);
}

export async function updateTabConversation(id: number, conversationId: number): Promise<void> {
  await dbExecute(
    "UPDATE tabs SET conversation_id = ?, updated_at = datetime('now') WHERE id = ?",
    [conversationId, id],
  );
}

export async function getActiveTabId(): Promise<number | null> {
  const raw = await getSetting("active_tab_id");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function setActiveTabId(id: number): Promise<void> {
  await setSetting("active_tab_id", String(id));
}
