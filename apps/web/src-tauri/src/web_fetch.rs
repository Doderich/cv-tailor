use std::time::Duration;

use reqwest::Url;
use serde::{Deserialize, Serialize};

use crate::errors::AppError;

const MAX_SOURCE_CHARS: usize = 80_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchUrlTextRequest {
    pub url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchUrlTextResponse {
    pub url: String,
    pub status: u16,
    pub content_type: Option<String>,
    pub text: String,
}

fn remove_between_case_insensitive(
    mut value: String,
    start_marker: &str,
    end_marker: &str,
) -> String {
    loop {
        let lower = value.to_lowercase();
        let Some(start) = lower.find(start_marker) else {
            break;
        };
        let Some(relative_end) = lower[start..].find(end_marker) else {
            value.replace_range(start.., " ");
            break;
        };
        let end = start + relative_end + end_marker.len();
        value.replace_range(start..end, " ");
    }

    value
}

fn strip_html(value: &str) -> String {
    let without_scripts =
        remove_between_case_insensitive(value.to_string(), "<script", "</script>");
    let without_styles = remove_between_case_insensitive(without_scripts, "<style", "</style>");
    let mut output = String::with_capacity(without_styles.len());
    let mut in_tag = false;

    for character in without_styles.chars() {
        match character {
            '<' => {
                in_tag = true;
                output.push(' ');
            }
            '>' => {
                in_tag = false;
                output.push(' ');
            }
            _ if !in_tag => output.push(character),
            _ => {}
        }
    }

    output
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

fn collapse_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub async fn fetch_url_text(
    request: FetchUrlTextRequest,
) -> Result<FetchUrlTextResponse, AppError> {
    let url = Url::parse(&request.url).map_err(|error| {
        AppError::with_details(
            "invalid_url",
            "The source URL is not valid.",
            error.to_string(),
        )
    })?;

    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(AppError::with_details(
            "unsupported_url_scheme",
            "Only http and https source URLs are supported.",
            url.scheme().to_string(),
        ));
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("cv-tailor/0.1 profile-import")
        .build()
        .map_err(|error| {
            AppError::with_details(
                "http_client_error",
                "Could not create the HTTP client.",
                error.to_string(),
            )
        })?;

    let response = client.get(url.clone()).send().await.map_err(|error| {
        AppError::with_details(
            "url_fetch_failed",
            "Could not fetch the source URL.",
            error.to_string(),
        )
    })?;
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(ToString::to_string);

    if !status.is_success() {
        return Err(AppError::with_details(
            "url_fetch_status",
            "The source URL returned a non-success status.",
            format!(
                "{} {}",
                status.as_u16(),
                status.canonical_reason().unwrap_or("")
            ),
        ));
    }

    let body = response.text().await.map_err(|error| {
        AppError::with_details(
            "url_read_failed",
            "Could not read the source URL body.",
            error.to_string(),
        )
    })?;
    let is_html = content_type.as_deref().unwrap_or("").contains("html");
    let text = if is_html { strip_html(&body) } else { body };
    let collapsed = collapse_whitespace(&text);
    let truncated = collapsed.chars().take(MAX_SOURCE_CHARS).collect::<String>();

    Ok(FetchUrlTextResponse {
        url: url.to_string(),
        status: status.as_u16(),
        content_type,
        text: truncated,
    })
}
