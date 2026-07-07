use serde_json::Value;
use tauri::AppHandle;

use crate::{
    ai::{self, AiRunRequest, AiRunResponse, AiToolStatus},
    errors::AppError,
    pdf_export::{self, ExportPdfRequest, ExportPdfResponse},
    storage,
    web_fetch::{self, FetchUrlTextRequest, FetchUrlTextResponse},
};

#[tauri::command]
pub fn load_app_state(app: AppHandle) -> Result<Value, AppError> {
    storage::load_app_state(&app)
}

#[tauri::command]
pub fn save_app_state(app: AppHandle, state: Value) -> Result<(), AppError> {
    storage::save_app_state(&app, state)
}

#[tauri::command]
pub async fn detect_ai_tools() -> Result<Vec<AiToolStatus>, AppError> {
    Ok(ai::detect_ai_tools().await)
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
pub fn export_generated_cv_pdf(
    app: AppHandle,
    request: ExportPdfRequest,
) -> Result<ExportPdfResponse, AppError> {
    pdf_export::export_generated_cv_pdf(&app, request)
}
