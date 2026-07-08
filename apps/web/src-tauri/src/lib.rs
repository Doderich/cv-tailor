mod ai;
mod commands;
mod errors;
mod file_import;
mod pdf_export;
mod web_fetch;

use axum::{
    extract::State,
    http::{HeaderValue, Method},
    routing::get,
    Json, Router,
};
use serde::Serialize;
use std::{env, net::TcpListener, thread};
use tower_http::cors::CorsLayer;

const DEFAULT_LOCAL_API_ADDR: &str = "127.0.0.1:3911";

#[derive(Clone)]
struct LocalApiState {
    url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeStatus {
    status: &'static str,
    app_name: &'static str,
    runtime: &'static str,
    pid: u32,
    local_api_url: String,
}

fn status_payload(runtime: &'static str, local_api_url: &str) -> NativeStatus {
    NativeStatus {
        status: "ok",
        app_name: "cv-tailor",
        runtime,
        pid: std::process::id(),
        local_api_url: local_api_url.to_string(),
    }
}

#[tauri::command]
fn native_status(state: tauri::State<'_, LocalApiState>) -> NativeStatus {
    status_payload("tauri", &state.url)
}

async fn http_status(State(state): State<LocalApiState>) -> Json<NativeStatus> {
    Json(status_payload("local-http", &state.url))
}

fn start_local_api() -> Result<LocalApiState, Box<dyn std::error::Error>> {
    let addr =
        env::var("CV_TAILOR_LOCAL_API_ADDR").unwrap_or_else(|_| DEFAULT_LOCAL_API_ADDR.to_string());
    let listener = TcpListener::bind(&addr)?;
    listener.set_nonblocking(true)?;

    let local_addr = listener.local_addr()?;
    let state = LocalApiState {
        url: format!("http://{local_addr}"),
    };

    let app = Router::new()
        .route("/api/status", get(http_status))
        .layer(
            CorsLayer::new()
                .allow_origin([
                    HeaderValue::from_static("http://localhost:1420"),
                    HeaderValue::from_static("http://127.0.0.1:1420"),
                    HeaderValue::from_static("http://localhost:4173"),
                    HeaderValue::from_static("http://127.0.0.1:4173"),
                ])
                .allow_methods([Method::GET]),
        )
        .with_state(state.clone());

    thread::spawn(move || {
        let runtime = match tokio::runtime::Builder::new_current_thread()
            .enable_io()
            .build()
        {
            Ok(runtime) => runtime,
            Err(error) => {
                log::error!("failed to start local API runtime: {error}");
                return;
            }
        };

        runtime.block_on(async move {
            let listener = match tokio::net::TcpListener::from_std(listener) {
                Ok(listener) => listener,
                Err(error) => {
                    log::error!("failed to attach local API listener: {error}");
                    return;
                }
            };

            if let Err(error) = axum::serve(listener, app).await {
                log::error!("local API server failed: {error}");
            }
        });
    });

    Ok(state)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let local_api_state = start_local_api().expect("failed to start local API server");

    tauri::Builder::default()
        .manage(local_api_state)
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            native_status,
            commands::detect_ai_tools,
            commands::run_ai_tool,
            commands::fetch_url_text,
            commands::extract_profile_file_text,
            commands::export_generated_cv_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
