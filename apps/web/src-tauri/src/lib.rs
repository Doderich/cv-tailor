mod ai;
mod commands;
mod data_snapshots;
mod errors;
mod file_import;
#[cfg(desktop)]
mod menu;
mod pdf_export;
mod updater_debug;
mod web_fetch;

use axum::{
    extract::State,
    http::{HeaderValue, Method},
    routing::get,
    Json, Router,
};
use cv_tailor_native::{ai_routes, cloud_backup_routes, shared_state};
use serde::Serialize;
use std::{env, net::TcpListener, thread};
use tower_http::cors::CorsLayer;

// Keep off :3911 so the headless gateway can bind there while the desktop app is open.
const DEFAULT_LOCAL_API_ADDR: &str = "127.0.0.1:3912";

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
        app_name: "CV Tailor",
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
    let data_dir = env::temp_dir().join("cv-tailor-local-api");
    let _ = std::fs::create_dir_all(&data_dir);
    let gateway_state = shared_state(data_dir, local_addr.to_string(), None);

    let status_router = Router::new()
        .route("/api/status", get(http_status))
        .with_state(state.clone());
    let app = Router::new()
        .merge(status_router)
        .merge(ai_routes().with_state(gateway_state.clone()))
        .merge(cloud_backup_routes().with_state(gateway_state))
        .layer(
            CorsLayer::new()
                .allow_origin([
                    HeaderValue::from_static("http://localhost:1420"),
                    HeaderValue::from_static("http://127.0.0.1:1420"),
                    HeaderValue::from_static("http://localhost:4173"),
                    HeaderValue::from_static("http://127.0.0.1:4173"),
                ])
                .allow_methods([Method::GET, Method::POST])
                .allow_headers(tower_http::cors::Any),
        );

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
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(local_api_state)
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            #[cfg(desktop)]
            menu::install(app)?;
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .level_for("sqlx::query", log::LevelFilter::Error)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            native_status,
            commands::detect_ai_tools,
            commands::list_lm_studio_models,
            commands::suggest_ai_tool_paths,
            commands::run_ai_tool,
            commands::fetch_url_text,
            commands::extract_profile_file_text,
            commands::export_generated_cv_pdf,
            commands::print_generated_cv,
            commands::list_data_snapshots,
            commands::save_data_snapshot,
            commands::read_data_snapshot,
            commands::delete_data_snapshot,
            commands::download_data_snapshot,
            commands::cloud_backup_env_defaults,
            commands::cloud_backup_test,
            commands::cloud_backup_upload,
            commands::cloud_backup_list,
            commands::cloud_backup_download,
            commands::fetch_updater_manifest
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
