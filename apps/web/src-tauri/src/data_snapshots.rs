use std::{
    fs,
    path::PathBuf,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

use crate::errors::AppError;

const INDEX_FILE: &str = "index.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSnapshotSummary {
    pub profiles: usize,
    pub applications: usize,
    pub cv_runs: usize,
    pub ai_outputs: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSnapshotMeta {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub profiles: usize,
    pub applications: usize,
    pub cv_runs: usize,
    pub ai_outputs: usize,
    pub filename: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDataSnapshotRequest {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub content: String,
    pub summary: DataSnapshotSummary,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSnapshotIdRequest {
    pub id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSnapshotContentResponse {
    pub meta: DataSnapshotMeta,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadDataSnapshotResponse {
    pub path: Option<String>,
    pub saved: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct SnapshotIndex {
    snapshots: Vec<DataSnapshotMeta>,
}

fn snapshots_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let directory = app.path().app_data_dir()?.join("snapshots");
    fs::create_dir_all(&directory)?;
    Ok(directory)
}

fn index_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(snapshots_dir(app)?.join(INDEX_FILE))
}

fn read_index(app: &AppHandle) -> Result<SnapshotIndex, AppError> {
    let path = index_path(app)?;
    if !path.exists() {
        return Ok(SnapshotIndex {
            snapshots: Vec::new(),
        });
    }

    let content = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&content)?)
}

fn write_index(app: &AppHandle, index: &SnapshotIndex) -> Result<(), AppError> {
    let path = index_path(app)?;
    fs::write(path, format!("{}\n", serde_json::to_string_pretty(index)?))?;
    Ok(())
}

fn sanitize_filename(value: &str) -> String {
    let cleaned = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, ' ' | '-' | '_' | '.') {
                character
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    if cleaned.is_empty() {
        "snapshot".to_string()
    } else {
        cleaned.chars().take(80).collect()
    }
}

fn snapshot_filename(id: &str) -> String {
    format!("{id}.json")
}

fn suggested_download_name(meta: &DataSnapshotMeta) -> String {
    let date = meta.created_at.chars().take(10).collect::<String>();
    format!(
        "cv-tailor-backup-{}-{}.json",
        date,
        sanitize_filename(&meta.name)
            .to_ascii_lowercase()
            .replace(' ', "-")
    )
}

fn find_snapshot<'a>(index: &'a SnapshotIndex, id: &str) -> Option<&'a DataSnapshotMeta> {
    index.snapshots.iter().find(|snapshot| snapshot.id == id)
}

pub fn list_data_snapshots(app: &AppHandle) -> Result<Vec<DataSnapshotMeta>, AppError> {
    let index = read_index(app)?;
    Ok(index.snapshots)
}

pub fn save_data_snapshot(
    app: &AppHandle,
    request: SaveDataSnapshotRequest,
) -> Result<DataSnapshotMeta, AppError> {
    if request.content.trim().is_empty() {
        return Err(AppError::new(
            "empty_snapshot",
            "Snapshot content cannot be empty.",
        ));
    }

    let filename = snapshot_filename(&request.id);
    let path = snapshots_dir(app)?.join(&filename);
    fs::write(&path, format!("{}\n", request.content))?;

    let meta = DataSnapshotMeta {
        id: request.id,
        name: request.name,
        created_at: request.created_at,
        profiles: request.summary.profiles,
        applications: request.summary.applications,
        cv_runs: request.summary.cv_runs,
        ai_outputs: request.summary.ai_outputs,
        filename,
    };

    let mut index = read_index(app)?;
    index.snapshots.retain(|snapshot| snapshot.id != meta.id);
    index.snapshots.insert(0, meta.clone());
    write_index(app, &index)?;

    Ok(meta)
}

pub fn read_data_snapshot(
    app: &AppHandle,
    id: &str,
) -> Result<DataSnapshotContentResponse, AppError> {
    let index = read_index(app)?;
    let meta = find_snapshot(&index, id)
        .cloned()
        .ok_or_else(|| {
            AppError::new("snapshot_not_found", format!("Snapshot \"{id}\" was not found."))
        })?;
    let path = snapshots_dir(app)?.join(&meta.filename);
    let content = fs::read_to_string(path)?;

    Ok(DataSnapshotContentResponse { meta, content })
}

pub fn delete_data_snapshot(app: &AppHandle, id: &str) -> Result<(), AppError> {
    let mut index = read_index(app)?;
    let Some(position) = index.snapshots.iter().position(|snapshot| snapshot.id == id) else {
        return Err(AppError::new(
            "snapshot_not_found",
            format!("Snapshot \"{id}\" was not found."),
        ));
    };

    let meta = index.snapshots.remove(position);
    write_index(app, &index)?;

    let path = snapshots_dir(app)?.join(&meta.filename);
    if path.exists() {
        fs::remove_file(path)?;
    }

    Ok(())
}

pub fn download_data_snapshot(
    app: &AppHandle,
    id: &str,
) -> Result<DownloadDataSnapshotResponse, AppError> {
    // Caller must invoke this off the UI/main thread (async command + spawn_blocking).
    let snapshot = read_data_snapshot(app, id)?;
    let suggested_name = suggested_download_name(&snapshot.meta);
    let selected_path = app
        .dialog()
        .file()
        .set_title("Save backup")
        .set_file_name(&suggested_name)
        .add_filter("JSON backup", &["json"])
        .blocking_save_file();

    let Some(selected_path) = selected_path else {
        return Ok(DownloadDataSnapshotResponse {
            path: None,
            saved: false,
        });
    };

    let mut path = selected_path.into_path().map_err(|error| {
        AppError::with_details(
            "invalid_path",
            "Selected path is invalid.",
            error.to_string(),
        )
    })?;

    // macOS save panels often omit the extension in the text field; keep .json on disk.
    if path.extension().is_none() {
        path.set_extension("json");
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&path, snapshot.content)?;

    Ok(DownloadDataSnapshotResponse {
        path: Some(path.to_string_lossy().to_string()),
        saved: true,
    })
}
