//! Local libSQL data layer.
//!
//! A local embedded SQLite file now; sync-ready. The DB connection lives behind
//! the Rust boundary (never exposed to the webview), and the frontend talks to
//! it through generic `db_execute` / `db_select` commands that mimic the
//! tauri-plugin-sql ergonomics. To enable Turso sync later, switch `init` to
//! `Builder::new_remote_replica(path, url, token)` and add the libsql sync
//! features in Cargo.toml — no schema or query changes needed.

use libsql::{params::Params, Builder, Connection, Database, Value};
use serde_json::Value as Json;
use std::path::PathBuf;

pub struct Db {
    conn: Connection,
    /// Retained for future Turso sync (`database.sync().await`).
    #[allow(dead_code)]
    database: Database,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecResult {
    rows_affected: u64,
    last_insert_id: i64,
}

pub async fn init(path: PathBuf) -> Result<Db, String> {
    let database = Builder::new_local(path)
        .build()
        .await
        .map_err(|e| e.to_string())?;
    let conn = database.connect().map_err(|e| e.to_string())?;
    migrate(&conn).await.map_err(|e| e.to_string())?;
    Ok(Db { conn, database })
}

async fn migrate(conn: &Connection) -> Result<(), libsql::Error> {
    conn.execute_batch(
        // batch returns BatchRows; we only care about success.
        "CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS mcp_servers (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT,
            url        TEXT NOT NULL UNIQUE,
            enabled    INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS tabs (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            kind       TEXT NOT NULL,
            title      TEXT,
            state      TEXT,
            position   INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS conversations (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            title      TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS messages (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role            TEXT NOT NULL,
            content         TEXT NOT NULL,
            created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id);",
    )
    .await?;
    Ok(())
}

fn json_to_value(j: Json) -> Value {
    match j {
        Json::Null => Value::Null,
        Json::Bool(b) => Value::Integer(b as i64),
        Json::Number(n) => n
            .as_i64()
            .map(Value::Integer)
            .unwrap_or_else(|| Value::Real(n.as_f64().unwrap_or(0.0))),
        Json::String(s) => Value::Text(s),
        other => Value::Text(other.to_string()),
    }
}

fn value_to_json(v: Value) -> Json {
    match v {
        Value::Null => Json::Null,
        Value::Integer(i) => Json::from(i),
        Value::Real(f) => Json::from(f),
        Value::Text(s) => Json::from(s),
        Value::Blob(b) => Json::from(b),
    }
}

fn to_params(p: Vec<Json>) -> Params {
    Params::Positional(p.into_iter().map(json_to_value).collect())
}

#[tauri::command]
pub async fn db_execute(
    db: tauri::State<'_, Db>,
    sql: String,
    params: Vec<Json>,
) -> Result<ExecResult, String> {
    let conn = db.conn.clone();
    let rows_affected = conn
        .execute(&sql, to_params(params))
        .await
        .map_err(|e| e.to_string())?;
    Ok(ExecResult {
        rows_affected,
        last_insert_id: conn.last_insert_rowid(),
    })
}

#[tauri::command]
pub async fn db_select(
    db: tauri::State<'_, Db>,
    sql: String,
    params: Vec<Json>,
) -> Result<Vec<serde_json::Map<String, Json>>, String> {
    let conn = db.conn.clone();
    let mut rows = conn
        .query(&sql, to_params(params))
        .await
        .map_err(|e| e.to_string())?;

    let cols: Vec<String> = (0..rows.column_count())
        .map(|i| rows.column_name(i).unwrap_or_default().to_string())
        .collect();

    let mut out = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        let mut obj = serde_json::Map::new();
        for (i, name) in cols.iter().enumerate() {
            let v = row.get_value(i as i32).map_err(|e| e.to_string())?;
            obj.insert(name.clone(), value_to_json(v));
        }
        out.push(obj);
    }
    Ok(out)
}
