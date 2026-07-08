use tauri::AppHandle;

use crate::{
    ai::{self, AiRunRequest, AiRunResponse, AiToolStatus},
    errors::AppError,
    file_import::{self, ExtractProfileFileTextRequest, ExtractProfileFileTextResponse},
    pdf_export::{self, ExportPdfRequest, ExportPdfResponse},
    web_fetch::{self, FetchUrlTextRequest, FetchUrlTextResponse},
};

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
