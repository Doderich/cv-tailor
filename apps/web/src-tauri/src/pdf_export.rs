use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::errors::AppError;

const PAGE_WIDTH: f32 = 595.0;
const PAGE_HEIGHT: f32 = 842.0;
const MARGIN_X: f32 = 50.0;
const TOP_Y: f32 = 792.0;
const BOTTOM_Y: f32 = 50.0;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPdfRequest {
    pub profile: Value,
    pub generated_cv: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPdfResponse {
    pub path: String,
    pub revealed: bool,
}

#[derive(Clone, Copy)]
enum LineStyle {
    Title,
    Contact,
    Section,
    Heading,
    Meta,
    Body,
    Bullet,
    Spacer,
}

struct PdfLine {
    text: String,
    style: LineStyle,
}

impl PdfLine {
    fn new(text: impl Into<String>, style: LineStyle) -> Self {
        Self {
            text: text.into(),
            style,
        }
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

fn array_strings_at(value: &Value, path: &[&str]) -> Vec<String> {
    let mut current = value;

    for key in path {
        let Some(next) = current.get(*key) else {
            return Vec::new();
        };
        current = next;
    }

    current
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(ToString::to_string))
                .filter(|item| !item.trim().is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn object_array_at<'a>(value: &'a Value, path: &[&str]) -> Vec<&'a Value> {
    let mut current = value;

    for key in path {
        let Some(next) = current.get(*key) else {
            return Vec::new();
        };
        current = next;
    }

    current
        .as_array()
        .map(|items| items.iter().collect())
        .unwrap_or_default()
}

fn find_by_id<'a>(items: &'a [&Value], id: &str) -> Option<&'a Value> {
    items
        .iter()
        .copied()
        .find(|item| string_at(item, &["id"]) == id)
}

fn join_non_empty(values: &[String], separator: &str) -> String {
    values
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join(separator)
}

fn join_date_range(start_date: &str, end_date: &str, current: bool) -> String {
    let end = if current { "Present" } else { end_date };
    [start_date, end]
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join(" - ")
}

fn push_section(lines: &mut Vec<PdfLine>, title: &str) {
    lines.push(PdfLine::new("", LineStyle::Spacer));
    lines.push(PdfLine::new(title.to_uppercase(), LineStyle::Section));
}

fn build_lines(profile: &Value, generated_cv: &Value) -> Vec<PdfLine> {
    let cv = generated_cv.get("cv").unwrap_or(&Value::Null);
    let mut lines = Vec::new();
    let name = string_at(profile, &["contact", "name"]);
    let headline = string_at(profile, &["headline"]);
    let contact_links = array_strings_at(profile, &["contact", "links"]);
    let contact_line = join_non_empty(
        &[
            string_at(profile, &["contact", "email"]).to_string(),
            string_at(profile, &["contact", "phone"]).to_string(),
            string_at(profile, &["contact", "location"]).to_string(),
            contact_links.join(" | "),
        ],
        " | ",
    );

    lines.push(PdfLine::new(
        if name.is_empty() { "CV" } else { name },
        LineStyle::Title,
    ));
    if !headline.is_empty() {
        lines.push(PdfLine::new(headline, LineStyle::Contact));
    }
    if !contact_line.is_empty() {
        lines.push(PdfLine::new(contact_line, LineStyle::Contact));
    }

    let summary = string_at(cv, &["summary"]);
    if !summary.is_empty() {
        push_section(&mut lines, "Summary");
        lines.push(PdfLine::new(summary, LineStyle::Body));
    }

    let skills = array_strings_at(cv, &["skills"]);
    if !skills.is_empty() {
        push_section(&mut lines, "Skills");
        lines.push(PdfLine::new(skills.join(" | "), LineStyle::Body));
    }

    let source_experience = object_array_at(profile, &["experience"]);
    let tailored_experience = object_array_at(cv, &["experience"]);
    if !tailored_experience.is_empty() {
        push_section(&mut lines, "Experience");

        for tailored_item in tailored_experience {
            let experience_id = string_at(tailored_item, &["experienceId"]);
            let Some(source) = find_by_id(&source_experience, experience_id) else {
                continue;
            };
            let heading = join_non_empty(
                &[
                    string_at(source, &["title"]).to_string(),
                    string_at(source, &["company"]).to_string(),
                ],
                ", ",
            );
            let current = source
                .get("current")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let date_range = join_date_range(
                string_at(source, &["startDate"]),
                string_at(source, &["endDate"]),
                current,
            );
            let technologies = array_strings_at(source, &["technologies"]);
            let meta = join_non_empty(
                &[
                    string_at(source, &["location"]).to_string(),
                    date_range,
                    technologies.join(", "),
                ],
                " | ",
            );

            lines.push(PdfLine::new(heading, LineStyle::Heading));
            if !meta.is_empty() {
                lines.push(PdfLine::new(meta, LineStyle::Meta));
            }
            for bullet in array_strings_at(tailored_item, &["bullets"]) {
                lines.push(PdfLine::new(bullet, LineStyle::Bullet));
            }
        }
    }

    let source_projects = object_array_at(profile, &["projects"]);
    let tailored_projects = object_array_at(cv, &["projects"]);
    if !tailored_projects.is_empty() {
        push_section(&mut lines, "Projects");

        for tailored_item in tailored_projects {
            let project_id = string_at(tailored_item, &["projectId"]);
            let Some(source) = find_by_id(&source_projects, project_id) else {
                continue;
            };
            let technologies = array_strings_at(source, &["technologies"]);
            let meta = join_non_empty(
                &[
                    string_at(source, &["role"]).to_string(),
                    string_at(source, &["url"]).to_string(),
                    technologies.join(", "),
                ],
                " | ",
            );

            lines.push(PdfLine::new(
                string_at(source, &["name"]),
                LineStyle::Heading,
            ));
            if !meta.is_empty() {
                lines.push(PdfLine::new(meta, LineStyle::Meta));
            }
            let description = string_at(source, &["description"]);
            if !description.is_empty() {
                lines.push(PdfLine::new(description, LineStyle::Body));
            }
            for bullet in array_strings_at(tailored_item, &["bullets"]) {
                lines.push(PdfLine::new(bullet, LineStyle::Bullet));
            }
        }
    }

    let education_ids = array_strings_at(cv, &["educationIds"]);
    let source_education = object_array_at(profile, &["education"]);
    let included_education = source_education
        .iter()
        .copied()
        .filter(|item| {
            education_ids
                .iter()
                .any(|id| id == string_at(item, &["id"]))
        })
        .collect::<Vec<_>>();
    if !included_education.is_empty() {
        push_section(&mut lines, "Education");

        for item in included_education {
            let heading = if string_at(item, &["degree"]).is_empty() {
                string_at(item, &["institution"])
            } else {
                string_at(item, &["degree"])
            };
            let meta = join_non_empty(
                &[
                    string_at(item, &["institution"]).to_string(),
                    string_at(item, &["location"]).to_string(),
                    join_date_range(
                        string_at(item, &["startDate"]),
                        string_at(item, &["endDate"]),
                        false,
                    ),
                ],
                " | ",
            );

            lines.push(PdfLine::new(heading, LineStyle::Heading));
            if !meta.is_empty() {
                lines.push(PdfLine::new(meta, LineStyle::Meta));
            }
            for detail in array_strings_at(item, &["details"]) {
                lines.push(PdfLine::new(detail, LineStyle::Bullet));
            }
        }
    }

    let languages = array_strings_at(profile, &["languages"]);
    if !languages.is_empty() {
        push_section(&mut lines, "Languages");
        lines.push(PdfLine::new(languages.join(" | "), LineStyle::Body));
    }

    lines
}

fn pdf_safe_text(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii() && !character.is_control() {
                character
            } else if character.is_whitespace() {
                ' '
            } else {
                '?'
            }
        })
        .collect()
}

fn escape_pdf_literal(value: &str) -> String {
    pdf_safe_text(value)
        .replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
}

fn style_metrics(style: LineStyle) -> (&'static str, f32, f32, f32) {
    match style {
        LineStyle::Title => ("F2", 18.0, 24.0, 0.0),
        LineStyle::Contact => ("F1", 9.5, 13.0, 0.0),
        LineStyle::Section => ("F2", 11.0, 16.0, 0.0),
        LineStyle::Heading => ("F2", 10.5, 14.0, 0.0),
        LineStyle::Meta => ("F1", 9.0, 12.0, 0.0),
        LineStyle::Body => ("F1", 10.0, 13.5, 0.0),
        LineStyle::Bullet => ("F1", 10.0, 13.5, 12.0),
        LineStyle::Spacer => ("F1", 1.0, 5.0, 0.0),
    }
}

fn wrap_text(value: &str, font_size: f32, indent: f32) -> Vec<String> {
    let usable_width = PAGE_WIDTH - (MARGIN_X * 2.0) - indent;
    let max_chars = (usable_width / (font_size * 0.48)).floor().max(18.0) as usize;
    let words = value.split_whitespace().collect::<Vec<_>>();

    if words.is_empty() {
        return vec![String::new()];
    }

    let mut lines = Vec::new();
    let mut current = String::new();

    for word in words {
        let extra_space = usize::from(!current.is_empty());
        if current.len() + word.len() + extra_space > max_chars && !current.is_empty() {
            lines.push(current);
            current = String::new();
        }

        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(word);
    }

    if !current.is_empty() {
        lines.push(current);
    }

    lines
}

fn write_text(stream: &mut String, font: &str, size: f32, x: f32, y: f32, text: &str) {
    stream.push_str(&format!(
        "BT /{} {:.1} Tf {:.1} {:.1} Td ({}) Tj ET\n",
        font,
        size,
        x,
        y,
        escape_pdf_literal(text)
    ));
}

fn render_content_streams(lines: &[PdfLine]) -> Vec<String> {
    let mut pages = Vec::new();
    let mut stream = String::new();
    let mut y = TOP_Y;

    for line in lines {
        let (font, size, line_height, indent) = style_metrics(line.style);

        if matches!(line.style, LineStyle::Spacer) {
            y -= line_height;
            continue;
        }

        let mut wrapped_lines = wrap_text(&line.text, size, indent);
        if matches!(line.style, LineStyle::Bullet) {
            if let Some(first_line) = wrapped_lines.first_mut() {
                *first_line = format!("- {first_line}");
            }
        }

        for wrapped_line in wrapped_lines {
            if y - line_height < BOTTOM_Y {
                pages.push(stream);
                stream = String::new();
                y = TOP_Y;
            }

            write_text(&mut stream, font, size, MARGIN_X + indent, y, &wrapped_line);
            y -= line_height;
        }
    }

    if !stream.is_empty() {
        pages.push(stream);
    }

    if pages.is_empty() {
        pages.push(String::new());
    }

    pages
}

fn object(content: impl Into<Vec<u8>>) -> Vec<u8> {
    content.into()
}

fn stream_object(stream: &str) -> Vec<u8> {
    format!(
        "<< /Length {} >>\nstream\n{}endstream",
        stream.as_bytes().len(),
        stream
    )
    .into_bytes()
}

fn build_pdf(lines: &[PdfLine]) -> Vec<u8> {
    let streams = render_content_streams(lines);
    let page_count = streams.len();
    let mut objects = Vec::new();

    objects.push(object("<< /Type /Catalog /Pages 2 0 R >>"));

    let page_ids = (0..page_count)
        .map(|index| 6 + (index * 2))
        .collect::<Vec<_>>();
    let kids = page_ids
        .iter()
        .map(|id| format!("{id} 0 R"))
        .collect::<Vec<_>>()
        .join(" ");
    objects.push(object(format!(
        "<< /Type /Pages /Kids [{}] /Count {} >>",
        kids, page_count
    )));
    objects.push(object(
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ));
    objects.push(object(
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ));

    for (index, stream) in streams.iter().enumerate() {
        let content_id = 5 + (index * 2);
        let page_id = content_id + 1;
        objects.push(stream_object(stream));
        objects.push(object(format!(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {:.1} {:.1}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {} 0 R >>",
            PAGE_WIDTH, PAGE_HEIGHT, content_id
        )));
        debug_assert_eq!(page_ids[index], page_id);
    }

    let mut output = Vec::new();
    output.extend_from_slice(b"%PDF-1.4\n");
    let mut offsets = Vec::with_capacity(objects.len() + 1);
    offsets.push(0);

    for (index, content) in objects.iter().enumerate() {
        let object_id = index + 1;
        offsets.push(output.len());
        output.extend_from_slice(format!("{object_id} 0 obj\n").as_bytes());
        output.extend_from_slice(content);
        output.extend_from_slice(b"\nendobj\n");
    }

    let xref_position = output.len();
    output.extend_from_slice(format!("xref\n0 {}\n", objects.len() + 1).as_bytes());
    output.extend_from_slice(b"0000000000 65535 f \n");
    for offset in offsets.iter().skip(1) {
        output.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
    }
    output.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
            objects.len() + 1,
            xref_position
        )
        .as_bytes(),
    );

    output
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
    let lines = build_lines(&request.profile, &request.generated_cv);
    let bytes = build_pdf(&lines);
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
