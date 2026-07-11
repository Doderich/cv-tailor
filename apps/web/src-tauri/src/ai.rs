use std::{
    collections::HashSet,
    io::ErrorKind,
    path::{Path, PathBuf},
    process::Stdio,
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
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

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiToolPaths {
    pub claude: Option<String>,
    pub codex: Option<String>,
    pub cursor: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiToolStatus {
    pub id: String,
    pub label: String,
    pub available: bool,
    pub version: Option<String>,
    pub error: Option<String>,
    pub resolved_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRunRequest {
    pub tool: String,
    pub prompt: String,
    pub schema: serde_json::Value,
    pub model: Option<String>,
    pub run_id: Option<String>,
    pub tool_paths: Option<AiToolPaths>,
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

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

fn path_directories() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    let mut seen = HashSet::new();

    let mut push = |dir: PathBuf| {
        if dir.as_os_str().is_empty() {
            return;
        }
        if seen.insert(dir.clone()) {
            dirs.push(dir);
        }
    };

    if let Ok(path) = std::env::var("PATH") {
        for entry in path.split(':').filter(|entry| !entry.is_empty()) {
            push(PathBuf::from(entry));
        }
    }

    if let Some(home) = home_dir() {
        push(home.join(".local/bin"));
        push(home.join(".npm-global/bin"));
        push(home.join(".bun/bin"));
        push(home.join(".cursor/bin"));
        push(home.join(".claude/local/bin"));
        push(home.join(".codex/bin"));
    }

    push(PathBuf::from("/opt/homebrew/bin"));
    push(PathBuf::from("/usr/local/bin"));
    push(PathBuf::from("/usr/bin"));
    push(PathBuf::from("/bin"));

    dirs
}

#[cfg(unix)]
fn is_executable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;

    path.metadata()
        .map(|metadata| metadata.is_file() && metadata.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(not(unix))]
fn is_executable(path: &Path) -> bool {
    path.is_file()
}

fn find_on_path(binary: &str) -> Option<PathBuf> {
    for dir in path_directories() {
        let candidate = dir.join(binary);
        if is_executable(&candidate) {
            return Some(candidate);
        }
    }

    None
}

fn custom_path_for_tool(tool: &str, paths: &AiToolPaths) -> Option<PathBuf> {
    let raw = match tool {
        "claude" => paths.claude.as_deref(),
        "codex" => paths.codex.as_deref(),
        CURSOR_TOOL_ID => paths.cursor.as_deref(),
        _ => None,
    }?;

    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    Some(PathBuf::from(trimmed))
}

fn resolve_binary_path(tool: &str, paths: &AiToolPaths) -> PathBuf {
    if let Some(custom) = custom_path_for_tool(tool, paths) {
        return custom;
    }

    let binary = binary_for_tool(tool);
    find_on_path(binary).unwrap_or_else(|| PathBuf::from(binary))
}

async fn run_version(tool: &str, paths: &AiToolPaths) -> AiToolStatus {
    let binary_path = resolve_binary_path(tool, paths);
    let resolved_path = binary_path.to_string_lossy().to_string();
    let output = timeout(
        Duration::from_secs(6),
        Command::new(&binary_path).arg("--version").output(),
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
                    resolved_path: Some(resolved_path),
                }
            } else {
                AiToolStatus {
                    id: tool.to_string(),
                    label: label_for_tool(tool).to_string(),
                    available: false,
                    version: None,
                    error: Some(String::from_utf8_lossy(&output.stderr).trim().to_string()),
                    resolved_path: Some(resolved_path),
                }
            }
        }
        Ok(Err(error)) if error.kind() == ErrorKind::NotFound => AiToolStatus {
            id: tool.to_string(),
            label: label_for_tool(tool).to_string(),
            available: false,
            version: None,
            error: Some(format!(
                "Could not find {}. Set a custom path in Settings → AI.",
                binary_for_tool(tool)
            )),
            resolved_path: Some(resolved_path),
        },
        Ok(Err(error)) => AiToolStatus {
            id: tool.to_string(),
            label: label_for_tool(tool).to_string(),
            available: false,
            version: None,
            error: Some(error.to_string()),
            resolved_path: Some(resolved_path),
        },
        Err(_) => AiToolStatus {
            id: tool.to_string(),
            label: label_for_tool(tool).to_string(),
            available: false,
            version: None,
            error: Some("Version check timed out.".to_string()),
            resolved_path: Some(resolved_path),
        },
    }
}

pub async fn detect_ai_tools(paths: AiToolPaths) -> Vec<AiToolStatus> {
    let (claude, codex, cursor) = tokio::join!(
        run_version("claude", &paths),
        run_version("codex", &paths),
        run_version(CURSOR_TOOL_ID, &paths)
    );
    vec![claude, codex, cursor]
}

pub fn suggest_ai_tool_paths() -> AiToolPaths {
    AiToolPaths {
        claude: find_on_path("claude").map(|path| path.to_string_lossy().to_string()),
        codex: find_on_path("codex").map(|path| path.to_string_lossy().to_string()),
        cursor: find_on_path(CURSOR_BINARY).map(|path| path.to_string_lossy().to_string()),
    }
}

async fn available_tool(tool: &str, paths: &AiToolPaths) -> bool {
    run_version(tool, paths).await.available
}

async fn resolve_tool(requested_tool: &str, paths: &AiToolPaths) -> Result<String, AppError> {
    if requested_tool == "auto" {
        if available_tool("claude", paths).await {
            return Ok("claude".to_string());
        }

        if available_tool("codex", paths).await {
            return Ok("codex".to_string());
        }

        if available_tool(CURSOR_TOOL_ID, paths).await {
            return Ok(CURSOR_TOOL_ID.to_string());
        }

        return Err(AppError::new(
            "ai_tool_unavailable",
            "No supported AI tool is available. Configure tool paths in Settings → AI.",
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

    if !available_tool(requested_tool, paths).await {
        return Err(AppError::with_details(
            "ai_tool_unavailable",
            "The requested AI tool is not available. Configure its path in Settings → AI.",
            requested_tool,
        ));
    }

    Ok(requested_tool.to_string())
}

fn classify_process_error(stderr: &str, stdout: &str) -> &'static str {
    let lower = format!("{stderr}\n{stdout}").to_lowercase();

    if lower.contains("auth")
        || lower.contains("login")
        || lower.contains("api key")
        || lower.contains("unauthorized")
        || lower.contains("not logged in")
    {
        "ai_auth_required"
    } else {
        "ai_process_failed"
    }
}

fn extract_process_error_details(stdout: &str, stderr: &str) -> String {
    if !stderr.trim().is_empty() {
        return stderr.trim().to_string();
    }

    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(stdout.trim()) {
        if parsed.get("is_error").and_then(|value| value.as_bool()) == Some(true) {
            if let Some(result) = parsed.get("result").and_then(|value| value.as_str()) {
                return result.trim().to_string();
            }
        }

        if let Some(error) = parsed.get("error") {
            if let Some(message) = error.get("message").and_then(|value| value.as_str()) {
                return message.trim().to_string();
            }
        }
    }

    if !stdout.trim().is_empty() {
        return stdout.trim().to_string();
    }

    String::new()
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
        let details = extract_process_error_details(&stdout, &stderr);
        return Err(AppError::with_details(
            classify_process_error(&stderr, &stdout),
            "The AI tool exited with an error.",
            details,
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
    binary_path: &Path,
    args: &[String],
    prompt: &str,
) -> Result<AiRunResponse, AppError> {
    let start = Instant::now();
    emit_run_progress(
        app,
        run_id,
        "status",
        &format!("Starting {tool} and sending prompt..."),
    );

    let mut command = Command::new(binary_path);
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
                "The requested AI tool was not found. Configure its path in Settings → AI.",
                binary_path.to_string_lossy(),
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
    binary_path: &Path,
    args: &[String],
    prompt: &str,
) -> Result<AiRunResponse, AppError> {
    let start = Instant::now();
    emit_run_progress(
        app,
        run_id,
        "status",
        &format!("Starting {tool} with inline prompt..."),
    );

    let mut command = Command::new(binary_path);
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
                "The requested AI tool was not found. Configure its path in Settings → AI.",
                binary_path.to_string_lossy(),
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
    let tool_paths = request.tool_paths.unwrap_or_default();
    let tool = resolve_tool(&request.tool, &tool_paths).await?;
    let binary_path = resolve_binary_path(&tool, &tool_paths);
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
            &binary_path,
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
            &binary_path,
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
        &binary_path,
        &args,
        &request.prompt,
    )
    .await
}
