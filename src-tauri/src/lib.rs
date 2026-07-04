pub mod db;
mod debug;
pub mod docs;
mod fs;

use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// ---- Secret storage via the OS keyring (Secret Service / gnome-keyring) ----
const KEYRING_SERVICE: &str = "omni-desktop";
const KEYRING_USER: &str = "openrouter-api-key";

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_api_key(key: String) -> Result<(), String> {
    keyring_entry()?
        .set_password(&key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_api_key() -> Result<Option<String>, String> {
    match keyring_entry()?.get_password() {
        Ok(p) => Ok(Some(p)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_api_key() -> Result<(), String> {
    match keyring_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // WebKitGTK's DMA-BUF renderer triggers a Wayland protocol error (GDK
    // "Error 71") on NVIDIA, crashing the window before it draws. Falling back
    // to the SHM render path avoids it. Set before any GTK/WebKit init, only on
    // Linux, and only if the user hasn't overridden it.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        // SAFETY: called at the very start of run(), before threads/GTK init.
        // `unsafe` is required on edition 2024; harmless (allow) on 2021.
        #[allow(unused_unsafe)]
        unsafe {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
        };
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Open (or create) the local libSQL database in the app data dir,
            // run migrations, and hand the connection to managed state.
            let dir = app.path().app_data_dir().expect("no app data dir");
            std::fs::create_dir_all(&dir).ok();
            let db_path = dir.join("omni.db");
            let db = tauri::async_runtime::block_on(db::init(db_path))
                .expect("failed to initialize database");
            app.manage(db);

            // Local debug bridge (dev tool): an HTTP server an agent can drive
            // to introspect and iterate on the UI. Dev-only — never started in a
            // release build. See src/debug.rs.
            #[cfg(debug_assertions)]
            {
                app.manage(debug::DebugStore::default());
                debug::start(app.handle().clone());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            save_api_key,
            get_api_key,
            delete_api_key,
            db::db_execute,
            db::db_select,
            fs::path_is_dir,
            fs::fs_list_dir,
            fs::fs_read_file,
            fs::fs_write_file,
            fs::run_command,
            debug::complete_debug_request,
            debug::save_snapshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
