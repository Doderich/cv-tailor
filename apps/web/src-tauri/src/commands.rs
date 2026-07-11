use tauri::{AppHandle, Manager};

use crate::{
    ai::{self, AiRunRequest, AiRunResponse, AiToolPaths, AiToolStatus},
    data_snapshots::{
        self, DataSnapshotContentResponse, DataSnapshotIdRequest, DataSnapshotMeta,
        DownloadDataSnapshotResponse, SaveDataSnapshotRequest,
    },
    errors::AppError,
    file_import::{self, ExtractProfileFileTextRequest, ExtractProfileFileTextResponse},
    pdf_export::{self, ExportPdfRequest, ExportPdfResponse},
    updater_debug::{
        self, FetchUpdaterManifestRequest, FetchUpdaterManifestResponse,
    },
    web_fetch::{self, FetchUrlTextRequest, FetchUrlTextResponse},
};

#[tauri::command]
pub async fn detect_ai_tools(paths: Option<AiToolPaths>) -> Result<Vec<AiToolStatus>, AppError> {
    Ok(ai::detect_ai_tools(paths.unwrap_or_default()).await)
}

#[tauri::command]
pub fn suggest_ai_tool_paths() -> AiToolPaths {
    ai::suggest_ai_tool_paths()
}

#[tauri::command]
pub async fn run_ai_tool(app: AppHandle, request: AiRunRequest) -> Result<AiRunResponse, AppError> {
    ai::run_ai_tool(&app, request).await
}

#[tauri::command]
pub async fn fetch_url_text(
    request: FetchUrlTextRequest,
) -> Result<FetchUrlTextResponse, AppError> {
    web_fetch::fetch_url_text(request).await
}

#[tauri::command]
pub fn extract_profile_file_text(
    request: ExtractProfileFileTextRequest,
) -> Result<ExtractProfileFileTextResponse, AppError> {
    file_import::extract_profile_file_text(request)
}

#[tauri::command]
pub fn export_generated_cv_pdf(
    app: AppHandle,
    request: ExportPdfRequest,
) -> Result<ExportPdfResponse, AppError> {
    pdf_export::export_generated_cv_pdf(&app, request)
}

#[tauri::command]
pub fn print_generated_cv(app: AppHandle) -> Result<(), AppError> {
    let window = app.get_webview_window("main").ok_or_else(|| {
        AppError::new(
            "window_not_found",
            "The main application window is unavailable.",
        )
    })?;

    window.print()?;
    Ok(())
}

#[tauri::command]
pub fn list_data_snapshots(app: AppHandle) -> Result<Vec<DataSnapshotMeta>, AppError> {
    data_snapshots::list_data_snapshots(&app)
}

#[tauri::command]
pub fn save_data_snapshot(
    app: AppHandle,
    request: SaveDataSnapshotRequest,
) -> Result<DataSnapshotMeta, AppError> {
    data_snapshots::save_data_snapshot(&app, request)
}

#[tauri::command]
pub fn read_data_snapshot(
    app: AppHandle,
    request: DataSnapshotIdRequest,
) -> Result<DataSnapshotContentResponse, AppError> {
    data_snapshots::read_data_snapshot(&app, &request.id)
}

#[tauri::command]
pub fn delete_data_snapshot(
    app: AppHandle,
    request: DataSnapshotIdRequest,
) -> Result<(), AppError> {
    data_snapshots::delete_data_snapshot(&app, &request.id)
}

#[tauri::command]
pub fn download_data_snapshot(
    app: AppHandle,
    request: DataSnapshotIdRequest,
) -> Result<DownloadDataSnapshotResponse, AppError> {
    data_snapshots::download_data_snapshot(&app, &request.id)
}

#[tauri::command]
pub async fn fetch_updater_manifest(
    request: FetchUpdaterManifestRequest,
) -> Result<FetchUpdaterManifestResponse, AppError> {
    updater_debug::fetch_updater_manifest(request).await
}
