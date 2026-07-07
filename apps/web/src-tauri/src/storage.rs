use std::{fs, path::PathBuf};

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

use crate::errors::AppError;

fn state_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(app.path().app_data_dir()?.join("cv-tailor"))
}

pub fn schema_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let directory = state_dir(app)?;
    fs::create_dir_all(&directory)?;
    Ok(directory.join("tailored_cv_output.schema.json"))
}

fn state_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let directory = state_dir(app)?;
    fs::create_dir_all(&directory)?;
    Ok(directory.join("state.json"))
}

fn default_state() -> Value {
    json!({
      "version": 1,
      "profile": {
        "contact": {
          "name": "",
          "email": "",
          "phone": "",
          "location": "",
          "links": []
        },
        "headline": "",
        "summary": "",
        "targetRoles": [],
        "preferredTone": "Clear, concise, confident, and factual.",
        "skills": [],
        "achievements": [],
        "experience": [],
        "education": [],
        "projects": [],
        "languages": []
      },
      "generatedCvs": []
    })
}

pub fn load_app_state(app: &AppHandle) -> Result<Value, AppError> {
    let path = state_path(app)?;

    if !path.exists() {
        return Ok(default_state());
    }

    let contents = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&contents)?)
}

pub fn save_app_state(app: &AppHandle, state: Value) -> Result<(), AppError> {
    let path = state_path(app)?;
    let temporary_path = path.with_extension("json.tmp");
    let contents = serde_json::to_string_pretty(&state)?;

    fs::write(&temporary_path, contents)?;

    if path.exists() {
        fs::remove_file(&path)?;
    }

    fs::rename(temporary_path, path)?;
    Ok(())
}
