//! Thin Tauri adapter around `cv-tailor-native` AI runtime.

use std::sync::Arc;

use cv_tailor_native::{
    ai, AiRunRequest, AiRunResponse, ProgressSink, AI_RUN_PROGRESS_EVENT,
};
use tauri::{AppHandle, Emitter, Manager};

use crate::errors::AppError;

pub use cv_tailor_native::{
    AiToolPaths, AiToolStatus, LmStudioConfig, LmStudioModel,
};

pub async fn detect_ai_tools(
    paths: AiToolPaths,
    lm_studio: Option<LmStudioConfig>,
) -> Vec<AiToolStatus> {
    ai::detect_ai_tools(paths, lm_studio).await
}

pub async fn list_lm_studio_models(
    config: LmStudioConfig,
) -> Result<Vec<LmStudioModel>, AppError> {
    Ok(ai::list_lm_studio_models(config).await?)
}

pub fn suggest_ai_tool_paths() -> AiToolPaths {
    ai::suggest_ai_tool_paths()
}

pub async fn run_ai_tool(app: AppHandle, request: AiRunRequest) -> Result<AiRunResponse, AppError> {
    let data_dir = app.path().app_data_dir().map_err(|error| {
        AppError::with_details(
            "tauri_error",
            "Could not resolve the application data directory.",
            error.to_string(),
        )
    })?;

    let has_progress = request
        .run_id
        .as_ref()
        .is_some_and(|value| !value.trim().is_empty());

    let progress: Option<ProgressSink> = if has_progress {
        let handle = app.clone();
        Some(Arc::new(move |event| {
            let _ = handle.emit(AI_RUN_PROGRESS_EVENT, event);
        }))
    } else {
        None
    };

    Ok(ai::run_ai_tool(&data_dir, request, progress).await?)
}
