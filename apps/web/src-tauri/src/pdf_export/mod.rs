mod canvas;
mod content;
mod templates;

use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::errors::AppError;

use canvas::build_pdf;
use content::{parse_content, parse_labels, CvTemplate};
use templates::render_template;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPdfRequest {
    pub profile: Value,
    pub generated_cv: Value,
    pub cv_template: Option<String>,
    pub labels: Option<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPdfResponse {
    pub path: String,
    pub revealed: bool,
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
        "Tailored CV".to_string()
    } else {
        cleaned.chars().take(90).collect()
    }
}

fn string_at<'a>(value: &'a Value, path: &[&str]) -> &'a str {
    let mut current = value;

    for key in path {
        let Some(next) = current.get(*key) else {
            return "";
        };
        current = next;
    }

    current.as_str().unwrap_or("")
}

fn export_directory(app: &AppHandle) -> Result<PathBuf, AppError> {
    let base = app
        .path()
        .download_dir()
        .or_else(|_| app.path().app_data_dir())?;
    let directory = base.join("CV Tailor Exports");
    fs::create_dir_all(&directory)?;
    Ok(directory)
}

fn reveal_path(path: &Path) -> bool {
    #[cfg(target_os = "macos")]
    {
        return Command::new("open")
            .arg("-R")
            .arg(path)
            .status()
            .map(|status| status.success())
            .unwrap_or(false);
    }

    #[cfg(target_os = "windows")]
    {
        return Command::new("explorer")
            .arg(format!("/select,{}", path.to_string_lossy()))
            .status()
            .map(|status| status.success())
            .unwrap_or(false);
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        return path
            .parent()
            .map(|parent| {
                Command::new("xdg-open")
                    .arg(parent)
                    .status()
                    .map(|status| status.success())
                    .unwrap_or(false)
            })
            .unwrap_or(false);
    }
}

pub fn export_generated_cv_pdf(
    app: &AppHandle,
    request: ExportPdfRequest,
) -> Result<ExportPdfResponse, AppError> {
    let labels = parse_labels(request.labels.as_ref());
    let content = parse_content(&request.profile, &request.generated_cv, &labels);
    let template = CvTemplate::parse(request.cv_template.as_deref());
    let streams = render_template(template, &content, &labels);
    let bytes = build_pdf(&streams);
    let name = string_at(&request.profile, &["contact", "name"]);
    let role = string_at(&request.generated_cv, &["jobOffer", "title"]);
    let company = string_at(&request.generated_cv, &["jobOffer", "company"]);
    let filename = format!(
        "{} - {} - {}.pdf",
        sanitize_filename(name),
        sanitize_filename(role),
        sanitize_filename(company)
    )
    .replace(" -  - ", " - ")
    .replace(" - .pdf", ".pdf");
    let path = export_directory(app)?.join(filename);

    fs::write(&path, bytes)?;

    Ok(ExportPdfResponse {
        path: path.to_string_lossy().to_string(),
        revealed: reveal_path(&path),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample_request(template: &str) -> ExportPdfRequest {
        ExportPdfRequest {
            profile: json!({
                "contact": {
                    "name": "Ada Lovelace",
                    "email": "ada@example.com",
                    "phone": "",
                    "location": "London",
                    "links": []
                },
                "headline": "Engineer",
                "experience": [],
                "projects": [],
                "education": [],
                "languages": ["English"]
            }),
            generated_cv: json!({
                "jobOffer": { "title": "Engineer", "company": "Analytical" },
                "cv": {
                    "summary": "Experienced engineer.",
                    "skills": ["Math"],
                    "experience": [],
                    "projects": [],
                    "educationIds": []
                }
            }),
            cv_template: Some(template.to_string()),
            labels: None,
        }
    }

    #[test]
    fn builds_pdf_for_each_template() {
        for template in ["classic", "modern", "sidebar", "minimal", "executive"] {
            let request = sample_request(template);
            let labels = parse_labels(request.labels.as_ref());
            let content = parse_content(&request.profile, &request.generated_cv, &labels);
            let streams = render_template(
                CvTemplate::parse(request.cv_template.as_deref()),
                &content,
                &labels,
            );
            let bytes = build_pdf(&streams);
            assert!(bytes.starts_with(b"%PDF-1.4"));
            assert!(!streams.is_empty());
        }
    }

    #[test]
    fn german_text_is_encoded_in_pdf_streams() {
        let request = ExportPdfRequest {
            profile: json!({
                "contact": {
                    "name": "Ada Lovelace",
                    "email": "ada@example.com",
                    "phone": "",
                    "location": "Stuttgart",
                    "links": []
                },
                "headline": "Entwicklerin",
                "experience": [],
                "projects": [],
                "education": [],
                "languages": []
            }),
            generated_cv: json!({
                "jobOffer": { "title": "Engineer", "company": "Montamo" },
                "cv": {
                    "summary": "Entwicklung von Features über Mobile und Web.",
                    "skills": ["Flutter"],
                    "experience": [],
                    "projects": [],
                    "educationIds": []
                }
            }),
            cv_template: Some("classic".to_string()),
            labels: None,
        };
        let labels = parse_labels(request.labels.as_ref());
        let content = parse_content(&request.profile, &request.generated_cv, &labels);
        let streams = render_template(CvTemplate::Classic, &content, &labels);
        let joined = streams.join("");
        assert!(joined.contains("FC626572"), "expected WinAnsi-encoded über in PDF stream");
        assert!(!joined.contains("3F626572"), "did not expect ? instead of ü in über");
    }
}
