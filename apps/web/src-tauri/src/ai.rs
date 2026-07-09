use std::{
    io::ErrorKind,
    path::PathBuf,
    process::Stdio,
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    io::AsyncWriteExt,
    process::{Child, Command},
    time::timeout,
};

use crate::errors::AppError;

const AI_TIMEOUT_SECONDS: u64 = 300;
const AI_RUN_PROGRESS_EVENT: &str = "ai-run-progress";
const CURSOR_TOOL_ID: &str = "cursor";
const CURSOR_BINARY: &str = "agent";

fn schema_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let directory = app.path().app_data_dir()?.join("cv-tailor");
    std::fs::create_dir_all(&directory)?;
    Ok(directory.join("tailored_cv_output.schema.json"))
}

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
    pub model: Option<String>,
    pub run_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRunProgressEvent {
    pub run_id: String,
    pub stream: String,
    pub text: String,
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
        CURSOR_TOOL_ID => "Cursor Agent",
        _ => "Unknown",
    }
}

fn binary_for_tool(tool: &str) -> &str {
    match tool {
        CURSOR_TOOL_ID => CURSOR_BINARY,
        _ => tool,
    }
}

async fn run_version(tool: &str) -> AiToolStatus {
    let binary = binary_for_tool(tool);
    let output = timeout(
        Duration::from_secs(6),
        Command::new(binary).arg("--version").output(),
    )
    .await;

    match output {
        Ok(Ok(output)) => {
            if output.status.success() {
                AiToolStatus {
                    id: tool.to_string(),
                    label: label_for_tool(tool).to_string(),
                    available: true,
                    version: Some(String::from_utf8_lossy(&output.stdout).trim().to_string()),
                    error: None,
                }
            } else {
                AiToolStatus {
                    id: tool.to_string(),
                    label: label_for_tool(tool).to_string(),
                    available: false,
                    version: None,
                    error: Some(String::from_utf8_lossy(&output.stderr).trim().to_string()),
                }
            }
        }
        Ok(Err(error)) if error.kind() == ErrorKind::NotFound => AiToolStatus {
            id: tool.to_string(),
            label: label_for_tool(tool).to_string(),
            available: false,
            version: None,
            error: Some(format!("{binary} was not found on PATH.")),
        },
        Ok(Err(error)) => AiToolStatus {
            id: tool.to_string(),
            label: label_for_tool(tool).to_string(),
            available: false,
            version: None,
            error: Some(error.to_string()),
        },
        Err(_) => AiToolStatus {
            id: tool.to_string(),
            label: label_for_tool(tool).to_string(),
            available: false,
            version: None,
            error: Some("Version check timed out.".to_string()),
        },
    }
}

pub async fn detect_ai_tools() -> Vec<AiToolStatus> {
    let (claude, codex, cursor) = tokio::join!(
        run_version("claude"),
        run_version("codex"),
        run_version(CURSOR_TOOL_ID)
    );
    vec![claude, codex, cursor]
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

        if available_tool(CURSOR_TOOL_ID).await {
            return Ok(CURSOR_TOOL_ID.to_string());
        }

        return Err(AppError::new(
            "ai_tool_unavailable",
            "No supported AI tool is available on PATH.",
        ));
    }

    if requested_tool != "claude"
        && requested_tool != "codex"
        && requested_tool != CURSOR_TOOL_ID
    {
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

fn emit_run_progress(app: Option<&AppHandle>, run_id: &str, stream: &str, text: &str) {
    let Some(app) = app else {
        return;
    };

    let _ = app.emit(
        AI_RUN_PROGRESS_EVENT,
        AiRunProgressEvent {
            run_id: run_id.to_string(),
            stream: stream.to_string(),
            text: text.to_string(),
        },
    );
}

async fn collect_stream(
    app: Option<AppHandle>,
    run_id: String,
    stream: &str,
    output: Option<tokio::process::ChildStdout>,
) -> String {
    let Some(output) = output else {
        return String::new();
    };

    let mut collected = String::new();
    let mut reader = BufReader::new(output).lines();

    while let Ok(Some(line)) = reader.next_line().await {
        if !line.trim().is_empty() {
            emit_run_progress(app.as_ref(), &run_id, stream, &line);
        }
        collected.push_str(&line);
        collected.push('\n');
    }

    collected
}

async fn collect_stderr(
    app: Option<AppHandle>,
    run_id: String,
    output: Option<tokio::process::ChildStderr>,
) -> String {
    let Some(output) = output else {
        return String::new();
    };

    let mut collected = String::new();
    let mut reader = BufReader::new(output).lines();

    while let Ok(Some(line)) = reader.next_line().await {
        if !line.trim().is_empty() {
            emit_run_progress(app.as_ref(), &run_id, "stderr", &line);
        }
        collected.push_str(&line);
        collected.push('\n');
    }

    collected
}

async fn finish_child(
    app: Option<&AppHandle>,
    run_id: &str,
    tool: &str,
    start: Instant,
    mut child: Child,
    stdout_output: Option<tokio::process::ChildStdout>,
    stderr_output: Option<tokio::process::ChildStderr>,
) -> Result<AiRunResponse, AppError> {
    let app_for_stdout = app.cloned();
    let app_for_stderr = app.cloned();
    let run_id_for_stdout = run_id.to_string();
    let run_id_for_stderr = run_id.to_string();

    let stdout_task = tokio::spawn(collect_stream(
        app_for_stdout,
        run_id_for_stdout,
        "stdout",
        stdout_output,
    ));
    let stderr_task = tokio::spawn(collect_stderr(
        app_for_stderr,
        run_id_for_stderr,
        stderr_output,
    ));

    let status = match timeout(
        Duration::from_secs(AI_TIMEOUT_SECONDS),
        child.wait(),
    )
    .await
    {
        Ok(status) => status?,
        Err(_) => {
            let _ = child.kill().await;
            return Err(AppError::with_details(
                "ai_timeout",
                "The AI tool did not finish before the timeout.",
                format!("{AI_TIMEOUT_SECONDS} seconds"),
            ));
        }
    };

    let stdout = stdout_task.await.unwrap_or_default();
    let stderr = stderr_task.await.unwrap_or_default();

    if !status.success() {
        return Err(AppError::with_details(
            classify_process_error(&stderr),
            "The AI tool exited with an error.",
            stderr,
        ));
    }

    emit_run_progress(
        app,
        run_id,
        "status",
        &format!("{tool} finished in {} ms", start.elapsed().as_millis()),
    );

    Ok(AiRunResponse {
        tool: tool.to_string(),
        stdout,
        stderr,
        duration_ms: start.elapsed().as_millis(),
    })
}

async fn run_with_stdin(
    app: Option<&AppHandle>,
    run_id: &str,
    tool: &str,
    args: &[String],
    prompt: &str,
) -> Result<AiRunResponse, AppError> {
    let binary = binary_for_tool(tool);
    let start = Instant::now();
    emit_run_progress(
        app,
        run_id,
        "status",
        &format!("Starting {tool} and sending prompt..."),
    );

    let mut command = Command::new(binary);
    command
        .current_dir(std::env::temp_dir())
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

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    finish_child(app, run_id, tool, start, child, stdout, stderr).await
}

async fn run_with_prompt_arg(
    app: Option<&AppHandle>,
    run_id: &str,
    tool: &str,
    args: &[String],
    prompt: &str,
) -> Result<AiRunResponse, AppError> {
    let binary = binary_for_tool(tool);
    let start = Instant::now();
    emit_run_progress(
        app,
        run_id,
        "status",
        &format!("Starting {tool} with inline prompt..."),
    );

    let mut command = Command::new(binary);
    command
        .current_dir(std::env::temp_dir())
        .args(args)
        .arg(prompt)
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

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    finish_child(app, run_id, tool, start, child, stdout, stderr).await
}

fn extract_cursor_result(stdout: &str) -> Result<String, AppError> {
    let parsed: serde_json::Value = serde_json::from_str(stdout.trim())?;
    if let Some(result) = parsed.get("result") {
        if let Some(text) = result.as_str() {
            return Ok(text.to_string());
        }

        if result.is_object() || result.is_array() {
            return Ok(result.to_string());
        }
    }

    Ok(stdout.to_string())
}

pub async fn run_ai_tool(
    app: &AppHandle,
    request: AiRunRequest,
) -> Result<AiRunResponse, AppError> {
    let tool = resolve_tool(&request.tool).await?;
    let has_progress = request
        .run_id
        .as_ref()
        .is_some_and(|value| !value.trim().is_empty());
    let run_id = request
        .run_id
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "anonymous".to_string());
    let progress_app = has_progress.then(|| app.clone());

    if tool == "claude" {
        let schema = serde_json::to_string(&request.schema)?;
        let mut args = vec![
            "-p".to_string(),
            "--input-format".to_string(),
            "text".to_string(),
            "--output-format".to_string(),
            "json".to_string(),
            "--json-schema".to_string(),
            schema,
            "--no-session-persistence".to_string(),
        ];

        if let Some(model) = request.model {
            args.push("--model".to_string());
            args.push(model);
        }

        return run_with_stdin(
            progress_app.as_ref(),
            &run_id,
            "claude",
            &args,
            &request.prompt,
        )
        .await;
    }

    if tool == CURSOR_TOOL_ID {
        let mut args = vec![
            "-p".to_string(),
            "--output-format".to_string(),
            "json".to_string(),
            "--mode".to_string(),
            "ask".to_string(),
            "--trust".to_string(),
        ];

        if let Some(model) = request.model.filter(|model| model != "auto") {
            args.push("--model".to_string());
            args.push(model);
        }

        let response = run_with_prompt_arg(
            progress_app.as_ref(),
            &run_id,
            CURSOR_TOOL_ID,
            &args,
            &request.prompt,
        )
        .await?;
        return Ok(AiRunResponse {
            stdout: extract_cursor_result(&response.stdout)?,
            ..response
        });
    }

    let schema_path = schema_path(app)?;
    std::fs::write(&schema_path, serde_json::to_string_pretty(&request.schema)?)?;

    let mut args = vec![
        "exec".to_string(),
        "--ephemeral".to_string(),
        "--sandbox".to_string(),
        "read-only".to_string(),
        "--skip-git-repo-check".to_string(),
        "--output-schema".to_string(),
        schema_path.to_string_lossy().to_string(),
        "-".to_string(),
    ];

    if let Some(model) = request.model {
        args.push("--model".to_string());
        args.push(model);
    }

    run_with_stdin(
        progress_app.as_ref(),
        &run_id,
        "codex",
        &args,
        &request.prompt,
    )
    .await
}
