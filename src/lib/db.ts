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
}

export interface StoredMessage {
  role: string;
  content: string;
}

export async function createConversation(title: string): Promise<number> {
  const r = await dbExecute("INSERT INTO conversations(title) VALUES(?)", [title]);
  return r.lastInsertId;
}

export async function listConversations(): Promise<ConversationRow[]> {
  return dbSelect<ConversationRow>(
    "SELECT id, title, updated_at FROM conversations ORDER BY updated_at DESC, id DESC LIMIT 100",
  );
}

export async function getMessages(conversationId: number): Promise<StoredMessage[]> {
  return dbSelect<StoredMessage>(
    "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id",
    [conversationId],
  );
}

export async function addMessage(
  conversationId: number,
  role: string,
  content: string,
): Promise<void> {
  await dbExecute(
    "INSERT INTO messages(conversation_id, role, content) VALUES(?, ?, ?)",
    [conversationId, role, content],
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
  await dbExecute("DELETE FROM messages WHERE conversation_id = ?", [id]);
  await dbExecute("DELETE FROM conversations WHERE id = ?", [id]);
}
