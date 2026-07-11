use reqwest::Url;
use serde::{Deserialize, Serialize};

use crate::errors::AppError;

const UPDATER_ENDPOINT: &str =
    "https://github.com/Doderich/cv-tailor/releases/latest/download/latest.json";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchUpdaterManifestRequest {
    pub url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdaterManifestPlatform {
    pub url: String,
    pub signature: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchUpdaterManifestResponse {
    pub url: String,
    pub version: String,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
    pub platforms: std::collections::HashMap<String, UpdaterManifestPlatform>,
}

pub async fn fetch_updater_manifest(
    request: FetchUpdaterManifestRequest,
) -> Result<FetchUpdaterManifestResponse, AppError> {
    let url = request
        .url
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| UPDATER_ENDPOINT.to_string());

    let parsed = Url::parse(&url).map_err(|error| {
        AppError::new(
            "invalid_updater_url",
            format!("Invalid updater manifest URL: {error}"),
        )
    })?;

    if parsed.scheme() != "https" {
        return Err(AppError::new(
            "invalid_updater_url",
            "Updater manifest URL must use https.",
        ));
    }

    let response = reqwest::get(parsed.clone())
        .await
        .map_err(|error| {
            AppError::new(
                "updater_manifest_fetch_failed",
                format!("Failed to fetch updater manifest: {error}"),
            )
        })?;

    let status = response.status();
    let body = response.text().await.map_err(|error| {
        AppError::new(
            "updater_manifest_read_failed",
            format!("Failed to read updater manifest: {error}"),
        )
    })?;

    if !status.is_success() {
        return Err(AppError::new(
            "updater_manifest_fetch_failed",
            format!("Updater manifest request failed ({status}): {body}"),
        ));
    }

    let manifest: serde_json::Value = serde_json::from_str(&body).map_err(|error| {
        AppError::new(
            "updater_manifest_invalid_json",
            format!("Updater manifest is not valid JSON: {error}"),
        )
    })?;

    let version = manifest
        .get("version")
        .and_then(|value| value.as_str())
        .ok_or_else(|| {
            AppError::new(
                "updater_manifest_invalid_json",
                "Updater manifest is missing a version field.",
            )
        })?
        .to_string();

    let platforms = manifest
        .get("platforms")
        .and_then(|value| value.as_object())
        .map(|entries| {
            entries
                .iter()
                .filter_map(|(key, value)| {
                    let url = value.get("url")?.as_str()?.to_string();
                    let signature = value.get("signature")?.as_str()?.to_string();
                    Some((
                        key.clone(),
                        UpdaterManifestPlatform { url, signature },
                    ))
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(FetchUpdaterManifestResponse {
        url: parsed.to_string(),
        version,
        notes: manifest
            .get("notes")
            .and_then(|value| value.as_str())
            .map(str::to_string),
        pub_date: manifest
            .get("pub_date")
            .and_then(|value| value.as_str())
            .map(str::to_string),
        platforms,
    })
}
