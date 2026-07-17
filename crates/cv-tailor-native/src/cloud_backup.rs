use futures_util::StreamExt;
use minio::s3::builders::ObjectContent;
use minio::s3::creds::StaticProvider;
use minio::s3::http::BaseUrl;
use minio::s3::response_traits::HasEtagFromHeaders;
use minio::s3::types::{S3Api, ToStream};
use minio::s3::{MinioClient, MinioClientBuilder};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupConfig {
    pub endpoint: String,
    /// Kept for settings parity with S3 clients; MinIO ignores region for path-style hosts.
    #[allow(dead_code)]
    pub region: Option<String>,
    pub bucket: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub prefix: Option<String>,
}

fn env_nonempty(keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Ok(value) = std::env::var(key) {
            let trimmed = value.trim().to_string();
            if !trimmed.is_empty() {
                return Some(trimmed);
            }
        }
    }
    None
}

/// Server-side MinIO settings for the gateway.
/// Prefers `CV_TAILOR_CLOUD_BACKUP_*`, falls back to `VITE_CLOUD_BACKUP_*` (e.g. from apps/web/.env).
pub fn config_from_env() -> Option<CloudBackupConfig> {
    let endpoint = env_nonempty(&[
        "CV_TAILOR_CLOUD_BACKUP_ENDPOINT",
        "VITE_CLOUD_BACKUP_ENDPOINT",
    ])?;
    let bucket = env_nonempty(&[
        "CV_TAILOR_CLOUD_BACKUP_BUCKET",
        "VITE_CLOUD_BACKUP_BUCKET",
    ])?;
    let access_key_id = env_nonempty(&[
        "CV_TAILOR_CLOUD_BACKUP_ACCESS_KEY_ID",
        "VITE_CLOUD_BACKUP_ACCESS_KEY_ID",
    ])?;
    let secret_access_key = env_nonempty(&[
        "CV_TAILOR_CLOUD_BACKUP_SECRET_ACCESS_KEY",
        "VITE_CLOUD_BACKUP_SECRET_ACCESS_KEY",
    ])?;

    Some(CloudBackupConfig {
        endpoint,
        region: env_nonempty(&[
            "CV_TAILOR_CLOUD_BACKUP_REGION",
            "VITE_CLOUD_BACKUP_REGION",
        ]),
        bucket,
        access_key_id,
        secret_access_key,
        prefix: env_nonempty(&[
            "CV_TAILOR_CLOUD_BACKUP_PREFIX",
            "VITE_CLOUD_BACKUP_PREFIX",
        ]),
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupUploadRequest {
    pub config: CloudBackupConfig,
    pub key: Option<String>,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupUploadResponse {
    pub key: String,
    pub etag: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupListRequest {
    pub config: CloudBackupConfig,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupObjectMeta {
    pub key: String,
    pub size: i64,
    pub last_modified: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupListResponse {
    pub objects: Vec<CloudBackupObjectMeta>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupDownloadRequest {
    pub config: CloudBackupConfig,
    pub key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupDownloadResponse {
    pub key: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupTestResponse {
    pub ok: bool,
    pub bucket: String,
    pub endpoint: String,
}

fn normalize_prefix(prefix: Option<&str>) -> String {
    let trimmed = prefix.unwrap_or("cv-tailor/").trim();
    if trimmed.is_empty() {
        return "cv-tailor/".to_string();
    }
    if trimmed.ends_with('/') {
        trimmed.to_string()
    } else {
        format!("{trimmed}/")
    }
}

fn validate_config(config: &CloudBackupConfig) -> Result<(), AppError> {
    if config.endpoint.trim().is_empty() {
        return Err(AppError::new(
            "cloud_backup_invalid_config",
            "Cloud backup endpoint is required.",
        ));
    }
    if config.bucket.trim().is_empty() {
        return Err(AppError::new(
            "cloud_backup_invalid_config",
            "Cloud backup bucket is required.",
        ));
    }
    if config.access_key_id.trim().is_empty() {
        return Err(AppError::new(
            "cloud_backup_invalid_config",
            "Cloud backup access key is required.",
        ));
    }
    if config.secret_access_key.trim().is_empty() {
        return Err(AppError::new(
            "cloud_backup_invalid_config",
            "Cloud backup secret key is required.",
        ));
    }
    Ok(())
}

fn build_client(config: &CloudBackupConfig) -> Result<MinioClient, AppError> {
    validate_config(config)?;

    let base_url = config
        .endpoint
        .trim()
        .parse::<BaseUrl>()
        .map_err(map_minio_error)?;

    let provider = StaticProvider::new(
        config.access_key_id.trim(),
        config.secret_access_key.trim(),
        None,
    );

    MinioClientBuilder::new(base_url)
        .provider(Some(provider))
        .build()
        .map_err(map_minio_error)
}

fn default_object_key(prefix: &str) -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{prefix}backup-{secs}.json")
}

fn map_minio_error(error: impl std::fmt::Display) -> AppError {
    AppError::with_details(
        "cloud_backup_s3_error",
        "The cloud backup request to object storage failed.",
        error.to_string(),
    )
}

pub async fn test_connection(
    config: CloudBackupConfig,
) -> Result<CloudBackupTestResponse, AppError> {
    let client = build_client(&config)?;
    let bucket = config.bucket.trim().to_string();
    let response = client
        .bucket_exists(&bucket)
        .map_err(map_minio_error)?
        .build()
        .send()
        .await
        .map_err(map_minio_error)?;

    if !response.exists() {
        return Err(AppError::with_details(
            "cloud_backup_bucket_missing",
            "The configured bucket was not found.",
            bucket,
        ));
    }

    Ok(CloudBackupTestResponse {
        ok: true,
        bucket,
        endpoint: config.endpoint.trim().to_string(),
    })
}

pub async fn upload_backup(
    request: CloudBackupUploadRequest,
) -> Result<CloudBackupUploadResponse, AppError> {
    let client = build_client(&request.config)?;
    let prefix = normalize_prefix(request.config.prefix.as_deref());
    let key = request
        .key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| default_object_key(&prefix));
    let bucket = request.config.bucket.trim();

    let response = client
        .put_object_content(bucket, &key, ObjectContent::from(request.content))
        .map_err(map_minio_error)?
        .build()
        .send()
        .await
        .map_err(map_minio_error)?;

    Ok(CloudBackupUploadResponse {
        key,
        etag: response.etag().ok().map(|value| value.to_string()),
    })
}

pub async fn list_backups(
    request: CloudBackupListRequest,
) -> Result<CloudBackupListResponse, AppError> {
    let client = build_client(&request.config)?;
    let prefix = normalize_prefix(request.config.prefix.as_deref());
    let bucket = request.config.bucket.trim();

    let mut stream = client
        .list_objects(bucket)
        .map_err(map_minio_error)?
        .prefix(prefix)
        .recursive(true)
        .build()
        .to_stream()
        .await;

    let mut objects = Vec::new();
    while let Some(page) = stream.next().await {
        let response = page.map_err(map_minio_error)?;
        for entry in response.contents {
            if entry.is_prefix || entry.name.ends_with('/') {
                continue;
            }
            objects.push(CloudBackupObjectMeta {
                key: entry.name,
                size: entry.size.unwrap_or(0) as i64,
                last_modified: entry.last_modified.map(|value| value.to_rfc3339()),
            });
        }
    }

    objects.sort_by(|left, right| right.key.cmp(&left.key));

    Ok(CloudBackupListResponse { objects })
}

pub async fn download_backup(
    request: CloudBackupDownloadRequest,
) -> Result<CloudBackupDownloadResponse, AppError> {
    let client = build_client(&request.config)?;
    let key = request.key.trim();
    if key.is_empty() {
        return Err(AppError::new(
            "cloud_backup_invalid_config",
            "Cloud backup object key is required.",
        ));
    }

    let response = client
        .get_object(request.config.bucket.trim(), key)
        .map_err(map_minio_error)?
        .build()
        .send()
        .await
        .map_err(map_minio_error)?;

    let bytes = response.into_bytes().await.map_err(map_minio_error)?;
    let content = String::from_utf8(bytes.to_vec()).map_err(|error| {
        AppError::with_details(
            "cloud_backup_invalid_content",
            "The downloaded backup is not valid UTF-8 text.",
            error.to_string(),
        )
    })?;

    Ok(CloudBackupDownloadResponse {
        key: key.to_string(),
        content,
    })
}
