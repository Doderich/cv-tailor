use std::{net::SocketAddr, path::PathBuf};

use axum::{
    extract::State,
    http::{
        header::{AUTHORIZATION, COOKIE, SET_COOKIE},
        HeaderMap, HeaderValue, StatusCode,
    },
    middleware::{from_fn_with_state, Next},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use tower_http::{
    cors::{Any, CorsLayer},
    services::{ServeDir, ServeFile},
};

const GATEWAY_SESSION_COOKIE: &str = "cv_tailor_gateway";

use crate::{
    ai::{
        self, AiRunRequest, AiRunResponse, AiToolPaths, AiToolStatus, LmStudioConfig, LmStudioModel,
    },
    cloud_backup::{
        self, CloudBackupConfig, CloudBackupDownloadRequest, CloudBackupDownloadResponse,
        CloudBackupListRequest, CloudBackupListResponse, CloudBackupTestResponse,
        CloudBackupUploadRequest, CloudBackupUploadResponse,
    },
    error::AppError,
};

#[derive(Clone)]
pub struct GatewayState {
    pub data_dir: PathBuf,
    pub token: Option<String>,
    pub bind_addr: String,
    pub ui_dir: Option<PathBuf>,
    /// Server-managed MinIO config (from env). Never taken from web clients.
    pub cloud_backup: Option<CloudBackupConfig>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStatus {
    pub status: &'static str,
    pub app_name: &'static str,
    pub runtime: &'static str,
    pub pid: u32,
    pub local_api_url: String,
    pub ui_enabled: bool,
    pub cloud_backup_configured: bool,
}

fn browseable_base_url(bind_addr: &str) -> String {
    // 0.0.0.0 / :: are bind-any addresses — browsers need localhost or a real host IP.
    if let Some((host, port)) = bind_addr.rsplit_once(':') {
        let host = match host {
            "0.0.0.0" | "[::]" | "::" => "127.0.0.1",
            other => other.trim_start_matches('[').trim_end_matches(']'),
        };
        return format!("http://{host}:{port}");
    }
    format!("http://{bind_addr}")
}

fn unauthorized() -> AppError {
    AppError::new(
        "gateway_unauthorized",
        "Missing or invalid gateway bearer token.",
    )
}

fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    let header = headers
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();

    let token = header
        .strip_prefix("Bearer ")
        .or_else(|| header.strip_prefix("bearer "))
        .unwrap_or(header)
        .trim();

    if token.is_empty() {
        None
    } else {
        Some(token)
    }
}

fn cookie_token(headers: &HeaderMap) -> Option<&str> {
    let cookie = headers.get(COOKIE)?.to_str().ok()?;
    for part in cookie.split(';') {
        let part = part.trim();
        let Some((name, value)) = part.split_once('=') else {
            continue;
        };
        if name.trim() == GATEWAY_SESSION_COOKIE {
            let value = value.trim();
            if !value.is_empty() {
                return Some(value);
            }
        }
    }
    None
}

fn require_auth(state: &GatewayState, headers: &HeaderMap) -> Result<(), AppError> {
    let Some(expected) = state
        .token
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Ok(());
    };

    if bearer_token(headers) == Some(expected) || cookie_token(headers) == Some(expected) {
        Ok(())
    } else {
        Err(unauthorized())
    }
}

/// Sets an HttpOnly session cookie so the hosted web UI never needs a token in JS.
async fn attach_gateway_session_cookie(
    State(state): State<GatewayState>,
    request: axum::extract::Request,
    next: Next,
) -> Response {
    let mut response = next.run(request).await;

    let ui_ready = state
        .ui_dir
        .as_ref()
        .is_some_and(|path| path.join("index.html").is_file());
    let Some(token) = state
        .token
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return response;
    };

    if !ui_ready {
        return response;
    }

    // Keep the cookie scoped to this host; JS cannot read it.
    let cookie = format!(
        "{GATEWAY_SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Strict"
    );
    if let Ok(value) = HeaderValue::from_str(&cookie) {
        response.headers_mut().append(SET_COOKIE, value);
    }

    response
}

async fn status(State(state): State<GatewayState>) -> Json<GatewayStatus> {
    Json(GatewayStatus {
        status: "ok",
        app_name: "CV Tailor AI Gateway",
        runtime: "gateway",
        pid: std::process::id(),
        local_api_url: browseable_base_url(&state.bind_addr),
        ui_enabled: state
            .ui_dir
            .as_ref()
            .is_some_and(|path| path.join("index.html").is_file()),
        cloud_backup_configured: state.cloud_backup.is_some(),
    })
}

fn require_server_cloud_backup(state: &GatewayState) -> Result<CloudBackupConfig, AppError> {
    state.cloud_backup.clone().ok_or_else(|| {
        AppError::new(
            "cloud_backup_not_configured",
            "Cloud backup is not configured on the server. Set CV_TAILOR_CLOUD_BACKUP_* (or VITE_CLOUD_BACKUP_*) in the gateway environment.",
        )
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayCloudUploadBody {
    key: Option<String>,
    content: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayCloudDownloadBody {
    key: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DetectToolsBody {
    paths: Option<AiToolPaths>,
    lm_studio: Option<LmStudioConfig>,
}

async fn detect_tools(
    State(state): State<GatewayState>,
    headers: HeaderMap,
    Json(body): Json<DetectToolsBody>,
) -> Result<Json<Vec<AiToolStatus>>, AppError> {
    require_auth(&state, &headers)?;
    Ok(Json(
        ai::detect_ai_tools(body.paths.unwrap_or_default(), body.lm_studio).await,
    ))
}

async fn list_models(
    State(state): State<GatewayState>,
    headers: HeaderMap,
    Json(config): Json<LmStudioConfig>,
) -> Result<Json<Vec<LmStudioModel>>, AppError> {
    require_auth(&state, &headers)?;
    Ok(Json(ai::list_lm_studio_models(config).await?))
}

async fn suggest_paths(
    State(state): State<GatewayState>,
    headers: HeaderMap,
) -> Result<Json<AiToolPaths>, AppError> {
    require_auth(&state, &headers)?;
    Ok(Json(ai::suggest_ai_tool_paths()))
}

async fn run_tool(
    State(state): State<GatewayState>,
    headers: HeaderMap,
    Json(request): Json<AiRunRequest>,
) -> Result<Json<AiRunResponse>, AppError> {
    require_auth(&state, &headers)?;
    let response = ai::run_ai_tool(&state.data_dir, request, None).await?;
    Ok(Json(response))
}

async fn cloud_backup_test(
    State(state): State<GatewayState>,
    headers: HeaderMap,
) -> Result<Json<CloudBackupTestResponse>, AppError> {
    require_auth(&state, &headers)?;
    let config = require_server_cloud_backup(&state)?;
    Ok(Json(cloud_backup::test_connection(config).await?))
}

async fn cloud_backup_upload(
    State(state): State<GatewayState>,
    headers: HeaderMap,
    Json(body): Json<GatewayCloudUploadBody>,
) -> Result<Json<CloudBackupUploadResponse>, AppError> {
    require_auth(&state, &headers)?;
    let config = require_server_cloud_backup(&state)?;
    Ok(Json(
        cloud_backup::upload_backup(CloudBackupUploadRequest {
            config,
            key: body.key,
            content: body.content,
        })
        .await?,
    ))
}

async fn cloud_backup_list(
    State(state): State<GatewayState>,
    headers: HeaderMap,
) -> Result<Json<CloudBackupListResponse>, AppError> {
    require_auth(&state, &headers)?;
    let config = require_server_cloud_backup(&state)?;
    Ok(Json(
        cloud_backup::list_backups(CloudBackupListRequest { config }).await?,
    ))
}

async fn cloud_backup_download(
    State(state): State<GatewayState>,
    headers: HeaderMap,
    Json(body): Json<GatewayCloudDownloadBody>,
) -> Result<Json<CloudBackupDownloadResponse>, AppError> {
    require_auth(&state, &headers)?;
    let config = require_server_cloud_backup(&state)?;
    Ok(Json(
        cloud_backup::download_backup(CloudBackupDownloadRequest {
            config,
            key: body.key,
        })
        .await?,
    ))
}

impl axum::response::IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let status = match self.code.as_str() {
            "gateway_unauthorized" => StatusCode::UNAUTHORIZED,
            "ai_tool_unavailable"
            | "cloud_backup_invalid_config"
            | "cloud_backup_bucket_missing"
            | "cloud_backup_not_configured" => StatusCode::BAD_REQUEST,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (status, Json(self)).into_response()
    }
}

/// AI routes only (no `/api/status`). Call `.with_state(gateway_state)` before serving/merging.
pub fn ai_routes() -> Router<GatewayState> {
    Router::new()
        .route("/api/ai/tools", post(detect_tools))
        .route("/api/ai/lmstudio/models", post(list_models))
        .route("/api/ai/paths", get(suggest_paths))
        .route("/api/ai/run", post(run_tool))
}

/// Cloud backup (MinIO / S3) routes. Call `.with_state(gateway_state)` before serving/merging.
pub fn cloud_backup_routes() -> Router<GatewayState> {
    Router::new()
        .route("/api/cloud-backup/test", post(cloud_backup_test))
        .route("/api/cloud-backup/upload", post(cloud_backup_upload))
        .route("/api/cloud-backup/list", post(cloud_backup_list))
        .route("/api/cloud-backup/download", post(cloud_backup_download))
}

pub fn router(state: GatewayState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api = Router::new()
        .route("/api/status", get(status))
        .merge(ai_routes())
        .merge(cloud_backup_routes())
        .with_state(state.clone());

    let ui_dir = state
        .ui_dir
        .clone()
        .filter(|path| path.join("index.html").is_file());

    let app = if let Some(ui_dir) = ui_dir {
        let index = ui_dir.join("index.html");
        // Use `fallback` (not `not_found_service`) so SPA routes return 200 + index.html.
        let static_files = ServeDir::new(ui_dir).fallback(ServeFile::new(index));
        api.fallback_service(static_files)
    } else {
        api
    };

    app.layer(from_fn_with_state(
        state.clone(),
        attach_gateway_session_cookie,
    ))
    .layer(cors)
}

pub async fn serve(state: GatewayState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let addr: SocketAddr = state.bind_addr.parse()?;
    let public_url = browseable_base_url(&state.bind_addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;

    if state
        .ui_dir
        .as_ref()
        .is_some_and(|path| path.join("index.html").is_file())
    {
        log::info!("CV Tailor gateway UI + API at {public_url}");
    } else {
        log::info!("CV Tailor AI gateway API at {public_url}/api/status");
        if let Some(ui_dir) = &state.ui_dir {
            log::warn!(
                "UI dir {:?} has no index.html — serve API only. Build with: pnpm run gateway:ui:build",
                ui_dir
            );
        }
    }

    if let Some(config) = &state.cloud_backup {
        log::info!(
            "Cloud backup configured for bucket {} at {}",
            config.bucket,
            config.endpoint
        );
    } else {
        log::warn!(
            "Cloud backup unset — set CV_TAILOR_CLOUD_BACKUP_* (or VITE_CLOUD_BACKUP_*) for MinIO sync"
        );
    }

    axum::serve(listener, router(state)).await?;
    Ok(())
}

pub fn default_data_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("cv-tailor-gateway")
}

pub fn default_ui_dir() -> PathBuf {
    PathBuf::from("apps/web/dist")
}

pub fn state_from_env() -> GatewayState {
    let bind_addr =
        std::env::var("CV_TAILOR_GATEWAY_ADDR").unwrap_or_else(|_| "0.0.0.0:3911".to_string());
    let token = std::env::var("CV_TAILOR_GATEWAY_TOKEN")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let data_dir = std::env::var("CV_TAILOR_GATEWAY_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| default_data_dir());
    let ui_dir = match std::env::var("CV_TAILOR_GATEWAY_UI_DIR") {
        Ok(value) if value.trim().is_empty() || value.trim() == "none" => None,
        Ok(value) => Some(PathBuf::from(value)),
        Err(_) => Some(default_ui_dir()),
    };

    GatewayState {
        data_dir,
        token,
        bind_addr,
        ui_dir,
        cloud_backup: cloud_backup::config_from_env(),
    }
}

pub fn shared_state(
    data_dir: PathBuf,
    bind_addr: impl Into<String>,
    token: Option<String>,
) -> GatewayState {
    GatewayState {
        data_dir,
        token,
        bind_addr: bind_addr.into(),
        ui_dir: None,
        cloud_backup: None,
    }
}
