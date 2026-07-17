use tauri::{AppHandle, Manager};

use cv_tailor_native::{
    cloud_backup, config_from_env, AiRunRequest, AiRunResponse, CloudBackupConfig,
    CloudBackupDownloadRequest, CloudBackupDownloadResponse, CloudBackupListRequest,
    CloudBackupListResponse, CloudBackupTestResponse, CloudBackupUploadRequest,
    CloudBackupUploadResponse,
};

use crate::{
    ai::{self, AiToolPaths, AiToolStatus, LmStudioConfig, LmStudioModel},
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
pub async fn detect_ai_tools(
    paths: Option<AiToolPaths>,
    lm_studio: Option<LmStudioConfig>,
) -> Result<Vec<AiToolStatus>, AppError> {
    Ok(ai::detect_ai_tools(paths.unwrap_or_default(), lm_studio).await)
}

#[tauri::command]
pub async fn list_lm_studio_models(
    config: LmStudioConfig,
) -> Result<Vec<LmStudioModel>, AppError> {
    ai::list_lm_studio_models(config).await
}

#[tauri::command]
pub fn suggest_ai_tool_paths() -> AiToolPaths {
    ai::suggest_ai_tool_paths()
}

#[tauri::command]
pub async fn run_ai_tool(app: AppHandle, request: AiRunRequest) -> Result<AiRunResponse, AppError> {
    ai::run_ai_tool(app, request).await
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

/// Must be async: `blocking_save_file` deadlocks/crashes on macOS when run from a sync command (main thread).
#[tauri::command]
pub async fn download_data_snapshot(
    app: AppHandle,
    request: DataSnapshotIdRequest,
) -> Result<DownloadDataSnapshotResponse, AppError> {
    let id = request.id;
    tauri::async_runtime::spawn_blocking(move || {
        data_snapshots::download_data_snapshot(&app, &id)
    })
    .await
    .map_err(|error| {
        AppError::with_details(
            "dialog_join_error",
            "The save dialog was interrupted.",
            error.to_string(),
        )
    })?
}

#[tauri::command]
pub async fn fetch_updater_manifest(
    request: FetchUpdaterManifestRequest,
) -> Result<FetchUpdaterManifestResponse, AppError> {
    updater_debug::fetch_updater_manifest(request).await
}

/// Desktop-only prefills from process env (never baked into the web bundle).
#[tauri::command]
pub fn cloud_backup_env_defaults() -> Option<CloudBackupConfig> {
    config_from_env()
}

#[tauri::command]
pub async fn cloud_backup_test(
    config: CloudBackupConfig,
) -> Result<CloudBackupTestResponse, AppError> {
    Ok(cloud_backup::test_connection(config).await?)
}

#[tauri::command]
pub async fn cloud_backup_upload(
    request: CloudBackupUploadRequest,
) -> Result<CloudBackupUploadResponse, AppError> {
    Ok(cloud_backup::upload_backup(request).await?)
}

#[tauri::command]
pub async fn cloud_backup_list(
    request: CloudBackupListRequest,
) -> Result<CloudBackupListResponse, AppError> {
    Ok(cloud_backup::list_backups(request).await?)
}

#[tauri::command]
pub async fn cloud_backup_download(
    request: CloudBackupDownloadRequest,
) -> Result<CloudBackupDownloadResponse, AppError> {
    Ok(cloud_backup::download_backup(request).await?)
}
