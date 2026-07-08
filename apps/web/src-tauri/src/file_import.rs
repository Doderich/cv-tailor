use std::path::Path;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};

use crate::errors::AppError;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractProfileFileTextRequest {
    pub file_name: String,
    pub content_base64: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractProfileFileTextResponse {
    pub file_name: String,
    pub text: String,
}

fn extension_of(file_name: &str) -> Option<String> {
    Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
}

fn decode_base64(content_base64: &str) -> Result<Vec<u8>, AppError> {
    STANDARD.decode(content_base64).map_err(|error| {
        AppError::with_details(
            "invalid_file_encoding",
            "Could not decode the uploaded file.",
            error.to_string(),
        )
    })
}

fn extract_text_from_bytes(file_name: &str, bytes: &[u8]) -> Result<String, AppError> {
    let extension = extension_of(file_name).unwrap_or_default();

    match extension.as_str() {
        "pdf" => pdf_extract::extract_text_from_mem(bytes).map_err(|error| {
            AppError::with_details(
                "pdf_extract_failed",
                "Could not extract text from the PDF.",
                error.to_string(),
            )
        }),
        "txt" | "md" | "markdown" | "json" | "csv" | "html" | "htm" | "rtf" => {
            String::from_utf8(bytes.to_vec()).map_err(|error| {
                AppError::with_details(
                    "invalid_text_file",
                    "The file is not valid UTF-8 text.",
                    error.to_string(),
                )
            })
        }
        _ => Err(AppError::new(
            "unsupported_file_type",
            format!("Unsupported file type for profile import: .{extension}"),
        )),
    }
}

pub fn extract_profile_file_text(
    request: ExtractProfileFileTextRequest,
) -> Result<ExtractProfileFileTextResponse, AppError> {
    let bytes = decode_base64(&request.content_base64)?;
    let text = extract_text_from_bytes(&request.file_name, &bytes)?;

    Ok(ExtractProfileFileTextResponse {
        file_name: request.file_name,
        text,
    })
}
