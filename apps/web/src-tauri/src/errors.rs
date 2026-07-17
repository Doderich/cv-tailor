use serde::Serialize;

/// Tauri-local error wrapper so we can implement `From<tauri::Error>` (orphan rules).
#[derive(Debug, Serialize)]
#[serde(transparent)]
pub struct AppError(cv_tailor_native::AppError);

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self(cv_tailor_native::AppError::new(code, message))
    }

    pub fn with_details(
        code: impl Into<String>,
        message: impl Into<String>,
        details: impl Into<String>,
    ) -> Self {
        Self(cv_tailor_native::AppError::with_details(code, message, details))
    }
}

impl From<cv_tailor_native::AppError> for AppError {
    fn from(error: cv_tailor_native::AppError) -> Self {
        Self(error)
    }
}

impl From<tauri::Error> for AppError {
    fn from(error: tauri::Error) -> Self {
        Self::with_details(
            "tauri_error",
            "A Tauri operation failed.",
            error.to_string(),
        )
    }
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self(error.into())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        Self(error.into())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(error: reqwest::Error) -> Self {
        Self(error.into())
    }
}
