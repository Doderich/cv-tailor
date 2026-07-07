use std::{
    io::ErrorKind,
    process::Stdio,
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tokio::{io::AsyncWriteExt, process::Command, time::timeout};

use crate::{errors::AppError, storage};

const AI_TIMEOUT_SECONDS: u64 = 120;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiToolStatus {
    pub id: String,
    pub label: String,
    pub available: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRunRequest {
    pub tool: String,
    pub prompt: String,
    pub schema: serde_json::Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRunResponse {
    pub tool: String,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u128,
}

fn label_for_tool(tool: &str) -> &'static str {
    match tool {
        "claude" => "Claude Code",
        "codex" => "Codex CLI",
        _ => "Unknown",
    }
}

async fn run_version(binary: &str) -> AiToolStatus {
    let output = timeout(
        Duration::from_secs(6),
        Command::new(binary).arg("--version").output(),
    )
    .await;

    match output {
        Ok(Ok(output)) => {
            if output.status.success() {
                AiToolStatus {
                    id: binary.to_string(),
                    label: label_for_tool(binary).to_string(),
                    available: true,
                    version: Some(String::from_utf8_lossy(&output.stdout).trim().to_string()),
                    error: None,
                }
            } else {
                AiToolStatus {
                    id: binary.to_string(),
                    label: label_for_tool(binary).to_string(),
                    available: false,
                    version: None,
                    error: Some(String::from_utf8_lossy(&output.stderr).trim().to_string()),
                }
            }
        }
        Ok(Err(error)) if error.kind() == ErrorKind::NotFound => AiToolStatus {
            id: binary.to_string(),
            label: label_for_tool(binary).to_string(),
            available: false,
            version: None,
            error: Some(format!("{binary} was not found on PATH.")),
        },
        Ok(Err(error)) => AiToolStatus {
            id: binary.to_string(),
            label: label_for_tool(binary).to_string(),
            available: false,
            version: None,
            error: Some(error.to_string()),
        },
        Err(_) => AiToolStatus {
            id: binary.to_string(),
            label: label_for_tool(binary).to_string(),
            available: false,
            version: None,
            error: Some("Version check timed out.".to_string()),
        },
    }
}

pub async fn detect_ai_tools() -> Vec<AiToolStatus> {
    let (claude, codex) = tokio::join!(run_version("claude"), run_version("codex"));
    vec![claude, codex]
}

async fn available_tool(tool: &str) -> bool {
    run_version(tool).await.available
}

async fn resolve_tool(requested_tool: &str) -> Result<String, AppError> {
    if requested_tool == "auto" {
        if available_tool("claude").await {
            return Ok("claude".to_string());
        }

        if available_tool("codex").await {
            return Ok("codex".to_string());
        }

        return Err(AppError::new(
            "ai_tool_unavailable",
            "Neither claude nor codex is available on PATH.",
        ));
    }

    if requested_tool != "claude" && requested_tool != "codex" {
        return Err(AppError::with_details(
            "invalid_ai_tool",
            "Unknown AI tool requested.",
            requested_tool,
        ));
    }

    if !available_tool(requested_tool).await {
        return Err(AppError::with_details(
            "ai_tool_unavailable",
            "The requested AI tool is not available on PATH.",
            requested_tool,
        ));
    }

    Ok(requested_tool.to_string())
}

fn classify_process_error(stderr: &str) -> &'static str {
    let lower = stderr.to_lowercase();

    if lower.contains("auth")
        || lower.contains("login")
        || lower.contains("api key")
        || lower.contains("unauthorized")
    {
        "ai_auth_required"
    } else {
        "ai_process_failed"
    }
}

async fn run_with_stdin(
    binary: &str,
    args: &[String],
    prompt: &str,
) -> Result<AiRunResponse, AppError> {
    let start = Instant::now();
    let mut command = Command::new(binary);
    command
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) if error.kind() == ErrorKind::NotFound => {
            return Err(AppError::with_details(
                "ai_tool_unavailable",
                "The requested AI tool was not found on PATH.",
                binary,
            ));
        }
        Err(error) => return Err(AppError::from(error)),
    };
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(prompt.as_bytes()).await?;
    }

    let output = match timeout(
        Duration::from_secs(AI_TIMEOUT_SECONDS),
        child.wait_with_output(),
    )
    .await
    {
        Ok(output) => output?,
        Err(_) => {
            return Err(AppError::with_details(
                "ai_timeout",
                "The AI tool did not finish before the timeout.",
                format!("{AI_TIMEOUT_SECONDS} seconds"),
            ));
        }
    };
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        return Err(AppError::with_details(
            classify_process_error(&stderr),
            "The AI tool exited with an error.",
            stderr,
        ));
    }

    Ok(AiRunResponse {
        tool: binary.to_string(),
        stdout,
        stderr,
        duration_ms: start.elapsed().as_millis(),
    })
}

pub async fn run_ai_tool(
    app: &AppHandle,
    request: AiRunRequest,
) -> Result<AiRunResponse, AppError> {
    let tool = resolve_tool(&request.tool).await?;

    if tool == "claude" {
        let schema = serde_json::to_string(&request.schema)?;
        return run_with_stdin(
            "claude",
            &[
                "-p".to_string(),
                "--input-format".to_string(),
                "text".to_string(),
                "--output-format".to_string(),
                "json".to_string(),
                "--json-schema".to_string(),
                schema,
                "--permission-mode".to_string(),
                "plan".to_string(),
                "--no-session-persistence".to_string(),
            ],
            &request.prompt,
        )
        .await;
    }

    let schema_path = storage::schema_path(app)?;
    std::fs::write(&schema_path, serde_json::to_string_pretty(&request.schema)?)?;

    run_with_stdin(
        "codex",
        &[
            "exec".to_string(),
            "--ephemeral".to_string(),
            "--sandbox".to_string(),
            "read-only".to_string(),
            "--skip-git-repo-check".to_string(),
            "--output-schema".to_string(),
            schema_path.to_string_lossy().to_string(),
            "-".to_string(),
        ],
        &request.prompt,
    )
    .await
}
