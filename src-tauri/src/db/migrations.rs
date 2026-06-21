//! Versioned schema migrations.
//!
//! Each migration is an ordered `(version, name, SQL)` triple; the SQL lives in
//! `schema/NNNN_name.sql` and is embedded at compile time. On startup we read
//! `PRAGMA user_version` and apply every migration whose version is greater than
//! the stored one, each wrapped in a transaction that also bumps `user_version`
//! — so a failed migration rolls back fully (no half-migrated DB) and re-running
//! is idempotent.
//!
//! ## Adding a migration
//! 1. Write `schema/NNNN_name.sql` (next number).
//! 2. Append a `Migration` to `MIGRATIONS` with that version.
//!
//! Never edit an already-shipped migration — add a new one. When altering an
//! existing table, write the migration so it's safe on every prior version
//! (e.g. `ALTER TABLE … ADD COLUMN`, `CREATE … IF NOT EXISTS`). DBs that predate
//! this framework start at version 0 and replay `0001` (a no-op on existing
//! tables) before any later migration.

use libsql::Connection;

struct Migration {
    version: i64,
    name: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "initial",
        sql: include_str!("schema/0001_initial.sql"),
    },
    Migration {
        version: 2,
        name: "code_mode",
        sql: include_str!("schema/0002_code_mode.sql"),
    },
    Migration {
        version: 3,
        name: "open_tabs",
        sql: include_str!("schema/0003_open_tabs.sql"),
    },
];

/// Apply every pending migration in order. Returns a contextual error naming the
/// migration that failed, so a botched schema change is obvious in the logs.
pub async fn run(conn: &Connection) -> Result<(), String> {
    let current = current_version(conn)
        .await
        .map_err(|e| format!("reading user_version: {e}"))?;

    for m in MIGRATIONS {
        if m.version <= current {
            continue;
        }
        // Schema change + version bump commit together or not at all.
        let batch = format!(
            "BEGIN;\n{}\nPRAGMA user_version = {};\nCOMMIT;",
            m.sql, m.version
        );
        conn.execute_batch(&batch)
            .await
            .map_err(|e| format!("migration {} ({}) failed: {e}", m.version, m.name))?;
    }
    Ok(())
}

async fn current_version(conn: &Connection) -> Result<i64, libsql::Error> {
    let mut rows = conn.query("PRAGMA user_version", ()).await?;
    match rows.next().await? {
        Some(row) => row.get::<i64>(0),
        None => Ok(0),
    }
}
