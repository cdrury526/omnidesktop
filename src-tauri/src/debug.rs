//! Local debug bridge — a tiny HTTP server (127.0.0.1:1456) that lets an agent
//! drive the app and introspect the UI without a human in the loop. Same
//! request/response pattern proven in magic-terminal: each HTTP request emits a
//! `debug://request` Tauri event carrying a request id, then blocks until the
//! webview answers via the `complete_debug_request` command.
//!
//! Endpoints (all JSON):
//!   GET  /health                      -> liveness
//!   POST /connect  {url}              -> connect to an MCP server
//!   POST /newchat                      -> start a fresh conversation
//!   POST /projectchat {workingDir,model?} -> start a Code-mode project chat
//!   POST /setmodel {model}             -> switch the active model
//!   POST /codemode {enabled,workingDir?} -> set Code mode on focused chat
//!   POST /openform {spec}             -> deterministically open a form (forced tool call)
//!   POST /send     {text}             -> run a chat turn with `text`
//!   POST /submit   {values}           -> resolve the pending HITL form
//!   POST /cancel                       -> cancel the pending HITL form
//!   POST /approve  {callIds?}          -> approve pending Code tool calls
//!   POST /reject   {callIds?}          -> reject pending Code tool calls
//!   POST /click    {selector}         -> synthetic click on a host element
//!   POST /drag     {selector,dx,dy}   -> synthetic pointer drag on host element
//!   POST /type     {selector,text}    -> set a host input's value (React-aware)
//!   POST /press    {key,selector?}    -> synthetic keydown/keyup on the host
//!   POST /forminput {id,value}        -> set a field inside the form iframe
//!   POST /formclick {target}          -> click submit/cancel/next/back in the form
//!   (the form app long-polls /form-poll and posts /form-ack; OMNI_DEBUG=1 only)
//!
//! Dev-only: started solely under `#[cfg(debug_assertions)]` (so a bundled
//! release never exposes it), and the webview handlers are gated on
//! `import.meta.env.DEV`.
//!   GET  /state                       -> active conversation + pending call + items
//!   GET  /dom?selector=CSS            -> computed box + styles of host elements
//!   GET  /formdom                     -> the form iframe's self-reported layout
//!   GET  /events?since=&limit=        -> the source-attributed activity timeline
//!   GET  /toolusage?conversationId=   -> normalized persisted tool call report
//!   GET  /snapshot                    -> html2canvas PNG of the host UI -> snapshots/
//!
//! Note: the MCP App form renders in a CROSS-ORIGIN sandbox iframe, so neither
//! html2canvas nor `/dom` can pierce it. Diagnose host-side sizing by running
//! `/dom` against the `<iframe>` / `.app-pane-surface` elements (the usual
//! culprit), and use `/state` to read what the form would submit.

use std::collections::{HashMap, VecDeque};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{sync_channel, SyncSender};
use std::sync::{Condvar, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{Emitter, Manager, State};
use tiny_http::{Header, Response, Server, StatusCode};

const ADDR: &str = "127.0.0.1:1456";
const TIMEOUT: Duration = Duration::from_secs(45);
// Form commands fail fast: if no form picks them up quickly, the model likely
// didn't open one — surface that instead of hanging.
const FORM_TIMEOUT: Duration = Duration::from_secs(12);

#[derive(Default)]
pub struct DebugStore {
    pending: Mutex<HashMap<String, SyncSender<Result<Value, String>>>>,
    // Form-interior channel: commands the (cross-origin) form app long-polls for,
    // and per-command ack senders so /forminput etc. block until the form applies.
    form_queue: Mutex<VecDeque<Value>>,
    form_cv: Condvar,
    form_acks: Mutex<HashMap<String, SyncSender<Result<Value, String>>>>,
}

static COUNTER: AtomicU64 = AtomicU64::new(0);
fn next_id() -> String {
    format!("dbg-{}", COUNTER.fetch_add(1, Ordering::Relaxed))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteRequest {
    request_id: String,
    #[serde(default)]
    result: Option<Value>,
    #[serde(default)]
    error: Option<String>,
}

#[tauri::command]
pub fn complete_debug_request(
    store: State<'_, DebugStore>,
    request: CompleteRequest,
) -> Result<(), String> {
    let sender = store
        .pending
        .lock()
        .map_err(|_| "debug store poisoned".to_string())?
        .remove(&request.request_id)
        .ok_or_else(|| "unknown debug request".to_string())?;
    let result = match (request.result, request.error) {
        (_, Some(e)) => Err(e),
        (Some(r), _) => Ok(r),
        _ => Ok(json!({})),
    };
    sender.send(result).map_err(|e| format!("complete failed: {e}"))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSnapshot {
    png_base64: String,
}

#[derive(Serialize, Clone)]
pub struct SavedSnapshot {
    path: String,
    filename: String,
}

fn snapshot_dir() -> PathBuf {
    // repo-root/snapshots in dev (the crate manifest lives in src-tauri/).
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.join("snapshots"))
        .unwrap_or_else(|| PathBuf::from("snapshots"))
}

#[tauri::command]
pub fn save_snapshot(request: SaveSnapshot) -> Result<SavedSnapshot, String> {
    let bytes = general_purpose::STANDARD
        .decode(request.png_base64)
        .map_err(|e| format!("invalid snapshot PNG: {e}"))?;
    let dir = snapshot_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let filename = format!("omni-{ts}.png");
    let path = dir.join(&filename);
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(SavedSnapshot {
        path: path.display().to_string(),
        filename,
    })
}

/// Emit a `debug://request` to the webview and block for the JS answer.
fn wait(app: &tauri::AppHandle, action: &str, params: Value) -> Result<Value, String> {
    let request_id = next_id();
    let (tx, rx) = sync_channel::<Result<Value, String>>(1);
    {
        let store = app.state::<DebugStore>();
        let mut pending = store.pending.lock().map_err(|_| "store poisoned".to_string())?;
        pending.insert(request_id.clone(), tx);
    }
    if let Err(e) = app.emit(
        "debug://request",
        json!({ "requestId": request_id, "action": action, "params": params }),
    ) {
        let store = app.state::<DebugStore>();
        let _ = store.pending.lock().map(|mut p| p.remove(&request_id));
        return Err(format!("emit failed: {e}"));
    }
    match rx.recv_timeout(TIMEOUT) {
        Ok(result) => result,
        Err(_) => {
            let store = app.state::<DebugStore>();
            let _ = store.pending.lock().map(|mut p| p.remove(&request_id));
            Err("debug request timed out (is the webview running?)".to_string())
        }
    }
}

/// Enqueue a command for the form app and block until it acks (or times out).
fn form_command(app: &tauri::AppHandle, action: &str, params: Value) -> Result<Value, String> {
    let cmd_id = next_id();
    let (tx, rx) = sync_channel::<Result<Value, String>>(1);
    let store = app.state::<DebugStore>();
    store
        .form_acks
        .lock()
        .map_err(|_| "form acks poisoned".to_string())?
        .insert(cmd_id.clone(), tx);
    {
        let mut q = store.form_queue.lock().map_err(|_| "form queue poisoned".to_string())?;
        q.push_back(json!({ "cmdId": cmd_id, "action": action, "params": params }));
    }
    store.form_cv.notify_all();
    match rx.recv_timeout(FORM_TIMEOUT) {
        Ok(result) => result,
        Err(_) => {
            let _ = store.form_acks.lock().map(|mut a| a.remove(&cmd_id));
            Err("no form picked this up — is a form open? (check GET /state; the \
                 model may not have called request_user_input — try /openform)"
                .to_string())
        }
    }
}

/// Long-poll: block until a command is queued for the form (or ~25s timeout).
fn form_poll(app: &tauri::AppHandle) -> Result<Value, String> {
    let store = app.state::<DebugStore>();
    let mut q = store.form_queue.lock().map_err(|_| "form queue poisoned".to_string())?;
    loop {
        if let Some(cmd) = q.pop_front() {
            return Ok(cmd);
        }
        let (next, timeout) = store
            .form_cv
            .wait_timeout(q, Duration::from_secs(25))
            .map_err(|_| "form queue poisoned".to_string())?;
        q = next;
        if timeout.timed_out() {
            return Ok(json!({ "none": true }));
        }
    }
}

/// The form posts its result for a command here, unblocking `form_command`.
fn form_ack(app: &tauri::AppHandle, body: Value) -> Result<Value, String> {
    let cmd_id = body.get("cmdId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let store = app.state::<DebugStore>();
    if let Some(tx) = store
        .form_acks
        .lock()
        .map_err(|_| "form acks poisoned".to_string())?
        .remove(&cmd_id)
    {
        let _ = tx.send(Ok(body.get("result").cloned().unwrap_or(json!({}))));
    }
    Ok(json!({ "ok": true }))
}

fn json_response(status: u16, body: Value) -> Response<std::io::Cursor<Vec<u8>>> {
    let mut response =
        Response::from_string(body.to_string()).with_status_code(StatusCode(status));
    for (k, v) in [
        ("content-type", "application/json"),
        ("access-control-allow-origin", "*"),
        ("access-control-allow-headers", "content-type"),
        ("access-control-allow-methods", "GET, POST, OPTIONS"),
    ] {
        if let Ok(h) = Header::from_bytes(k.as_bytes(), v.as_bytes()) {
            response.add_header(h);
        }
    }
    response
}

fn read_body(request: &mut tiny_http::Request) -> Value {
    let mut s = String::new();
    // `as_reader()` is a `dyn Read`, so `read_to_string` is callable directly.
    let _ = request.as_reader().read_to_string(&mut s);
    serde_json::from_str(&s).unwrap_or_else(|_| json!({}))
}

fn query_param(url: &str, key: &str) -> Option<String> {
    let query = url.split('?').nth(1)?;
    query.split('&').find_map(|pair| {
        let mut it = pair.splitn(2, '=');
        if it.next() == Some(key) {
            Some(urldecode(it.next().unwrap_or("")))
        } else {
            None
        }
    })
}

fn urldecode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b'%' if i + 2 < bytes.len() => {
                let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("");
                match u8::from_str_radix(hex, 16) {
                    Ok(b) => {
                        out.push(b);
                        i += 3;
                    }
                    Err(_) => {
                        out.push(bytes[i]);
                        i += 1;
                    }
                }
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn handle_request(mut request: tiny_http::Request, app: &tauri::AppHandle) {
    let method = request.method().as_str().to_string();
    let url = request.url().to_string();
    let route = url.split('?').next().unwrap_or("").to_string();

    if method == "OPTIONS" {
        let _ = request.respond(json_response(204, json!({})));
        return;
    }
    if method == "GET" && route == "/health" {
        let _ = request.respond(json_response(200, json!({ "ok": true })));
        return;
    }

    let outcome = match (method.as_str(), route.as_str()) {
        ("POST", "/connect") => wait(app, "connect", read_body(&mut request)),
        ("POST", "/newchat") => wait(app, "newchat", json!({})),
        ("POST", "/projectchat") => wait(app, "projectchat", read_body(&mut request)),
        ("POST", "/setmodel") => wait(app, "setmodel", read_body(&mut request)),
        ("POST", "/codemode") => wait(app, "codemode", read_body(&mut request)),
        ("POST", "/openform") => wait(app, "openform", read_body(&mut request)),
        ("POST", "/send") => wait(app, "send", read_body(&mut request)),
        ("POST", "/submit") => wait(app, "submit", read_body(&mut request)),
        ("POST", "/cancel") => wait(app, "cancel", json!({})),
        ("POST", "/approve") => wait(app, "approve", read_body(&mut request)),
        ("POST", "/reject") => wait(app, "reject", read_body(&mut request)),
        // Synthetic user input on the HOST document.
        ("POST", "/click") => wait(app, "click", read_body(&mut request)),
        ("POST", "/drag") => wait(app, "drag", read_body(&mut request)),
        ("POST", "/type") => wait(app, "type", read_body(&mut request)),
        ("POST", "/press") => wait(app, "press", read_body(&mut request)),
        // Form-interior input (the form app long-polls /form-poll and acks).
        ("POST", "/forminput") => form_command(app, "setValue", read_body(&mut request)),
        ("POST", "/formclick") => form_command(app, "click", read_body(&mut request)),
        ("GET", "/form-poll") => form_poll(app),
        ("POST", "/form-ack") => form_ack(app, read_body(&mut request)),
        ("GET", "/state") => wait(app, "state", json!({})),
        ("GET", "/dom") => {
            let selector = query_param(&url, "selector").unwrap_or_else(|| "body".into());
            wait(app, "dom", json!({ "selector": selector }))
        }
        ("GET", "/formdom") => wait(app, "formdom", json!({})),
        ("GET", "/events") => {
            let since = query_param(&url, "since").unwrap_or_default();
            let limit = query_param(&url, "limit").unwrap_or_default();
            wait(app, "events", json!({ "since": since, "limit": limit }))
        }
        ("GET", "/toolusage") => {
            let conversation_id = query_param(&url, "conversationId").unwrap_or_default();
            let state_limit = query_param(&url, "stateLimit").unwrap_or_default();
            let event_limit = query_param(&url, "eventLimit").unwrap_or_default();
            wait(
                app,
                "toolusage",
                json!({
                    "conversationId": conversation_id,
                    "stateLimit": state_limit,
                    "eventLimit": event_limit,
                }),
            )
        }
        ("GET", "/snapshot") => wait(app, "snapshot", json!({})),
        _ => Err("not found".to_string()),
    };

    let _ = match outcome {
        Ok(result) => request.respond(json_response(200, json!({ "ok": true, "result": result }))),
        Err(error) => {
            let code = if error == "not found" { 404 } else { 500 };
            request.respond(json_response(code, json!({ "ok": false, "error": error })))
        }
    };
}

pub fn start(app: tauri::AppHandle) {
    thread::spawn(move || {
        let server = match Server::http(ADDR) {
            Ok(server) => server,
            Err(error) => {
                eprintln!("[debug-bridge] disabled: {error}");
                return;
            }
        };
        eprintln!("[debug-bridge] listening on http://{ADDR}");
        // One thread per request so a long-poll (form channel) doesn't block
        // other endpoints.
        for request in server.incoming_requests() {
            let app = app.clone();
            thread::spawn(move || handle_request(request, &app));
        }
    });
}
