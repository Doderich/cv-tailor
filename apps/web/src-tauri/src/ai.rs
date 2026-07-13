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
const LM_STUDIO_TIMEOUT_SECONDS: u64 = 300;
const LM_STUDIO_REASONING_TIMEOUT_SECONDS: u64 = 1_200;
const AI_RUN_PROGRESS_EVENT: &str = "ai-run-progress";
const CURSOR_TOOL_ID: &str = "cursor";
const CURSOR_BINARY: &str = "agent";
const LM_STUDIO_TOOL_ID: &str = "lmstudio";
const LM_STUDIO_DETECT_TIMEOUT_SECS: u64 = 5;
const LM_STUDIO_MAX_TOKENS: u32 = 32_768;
const LM_STUDIO_MAX_TOKENS_REASONING: u32 = 12_288;
const DEFAULT_LM_STUDIO_BASE_URL: &str = "http://localhost:1234";

fn schema_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let directory = app.path().app_data_dir()?.join("cv-tailor");
    std::fs::create_dir_all(&directory)?;
    Ok(directory.join("tailored_cv_output.schema.json"))
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LmStudioConfig {
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub model: Option<String>,
    pub enable_reasoning: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LmStudioModel {
    pub id: String,
    pub label: String,
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
    pub lm_studio: Option<LmStudioConfig>,
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
        LM_STUDIO_TOOL_ID => "LM Studio",
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

pub async fn detect_ai_tools(
    paths: AiToolPaths,
    lm_studio: Option<LmStudioConfig>,
) -> Vec<AiToolStatus> {
    let lm_config = lm_studio.unwrap_or_default();
    let (claude, codex, cursor, lmstudio) = tokio::join!(
        run_version("claude", &paths),
        run_version("codex", &paths),
        run_version(CURSOR_TOOL_ID, &paths),
        detect_lm_studio(&lm_config)
    );
    vec![claude, codex, cursor, lmstudio]
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

async fn resolve_cli_tool(requested_tool: &str, paths: &AiToolPaths) -> Result<String, AppError> {
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

fn lm_studio_base_url(config: &LmStudioConfig) -> String {
    config
        .base_url
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(|value| value.trim_end_matches('/').to_string())
        .unwrap_or_else(|| DEFAULT_LM_STUDIO_BASE_URL.to_string())
}

fn apply_lm_studio_auth(
    request: reqwest::RequestBuilder,
    config: &LmStudioConfig,
) -> reqwest::RequestBuilder {
    if let Some(api_key) = config
        .api_key
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        request.bearer_auth(api_key)
    } else {
        request
    }
}

async fn fetch_lm_studio_models(config: &LmStudioConfig) -> Result<Vec<LmStudioModel>, AppError> {
    let base_url = lm_studio_base_url(config);
    let url = format!("{base_url}/v1/models");
    let request = apply_lm_studio_auth(reqwest::Client::new().get(url), config)
        .timeout(Duration::from_secs(LM_STUDIO_DETECT_TIMEOUT_SECS));

    let response = request.send().await.map_err(|error| {
        AppError::with_details(
            "ai_provider_unreachable",
            "Could not reach LM Studio.",
            error.to_string(),
        )
    })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::with_details(
            "ai_provider_unreachable",
            "LM Studio returned an error while listing models.",
            format!("HTTP {status}: {body}"),
        ));
    }

    let payload: serde_json::Value = response.json().await?;
    let models = payload
        .get("data")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();

    Ok(models
        .into_iter()
        .filter_map(|model| {
            let id = model.get("id")?.as_str()?.trim().to_string();
            if id.is_empty() {
                return None;
            }

            let label = model
                .get("id")
                .and_then(|value| value.as_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or(id.as_str())
                .to_string();

            Some(LmStudioModel { id, label })
        })
        .collect())
}

async fn detect_lm_studio(config: &LmStudioConfig) -> AiToolStatus {
    let base_url = lm_studio_base_url(config);
    match fetch_lm_studio_models(config).await {
        Ok(models) if !models.is_empty() => AiToolStatus {
            id: LM_STUDIO_TOOL_ID.to_string(),
            label: label_for_tool(LM_STUDIO_TOOL_ID).to_string(),
            available: true,
            version: Some(format!("{} model(s) loaded", models.len())),
            error: None,
            resolved_path: Some(base_url),
        },
        Ok(_) => AiToolStatus {
            id: LM_STUDIO_TOOL_ID.to_string(),
            label: label_for_tool(LM_STUDIO_TOOL_ID).to_string(),
            available: false,
            version: None,
            error: Some("LM Studio is reachable but no models are loaded.".to_string()),
            resolved_path: Some(base_url),
        },
        Err(error) => AiToolStatus {
            id: LM_STUDIO_TOOL_ID.to_string(),
            label: label_for_tool(LM_STUDIO_TOOL_ID).to_string(),
            available: false,
            version: None,
            error: Some(error.details.unwrap_or(error.message)),
            resolved_path: Some(base_url),
        },
    }
}

pub async fn list_lm_studio_models(
    config: LmStudioConfig,
) -> Result<Vec<LmStudioModel>, AppError> {
    fetch_lm_studio_models(&config).await
}

fn lm_studio_reasoning_enabled(config: &LmStudioConfig) -> bool {
    config.enable_reasoning.unwrap_or(true)
}

fn lm_studio_timeout_seconds(config: &LmStudioConfig) -> u64 {
    if lm_studio_reasoning_enabled(config) {
        LM_STUDIO_REASONING_TIMEOUT_SECONDS
    } else {
        LM_STUDIO_TIMEOUT_SECONDS
    }
}

fn lm_studio_http_client(config: &LmStudioConfig) -> reqwest::Client {
    let timeout_secs = lm_studio_timeout_seconds(config);
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

fn classify_lm_studio_transport_error(error: &reqwest::Error) -> (&'static str, &'static str) {
    if error.is_timeout() {
        return (
            "ai_request_timeout",
            "LM Studio took too long to respond. Reasoning models can run for many minutes — retry or disable reasoning for faster structured output.",
        );
    }

    if error.is_connect() {
        return (
            "ai_provider_unreachable",
            "Could not connect to LM Studio. Check that the server is running and the URL in Settings → AI is correct.",
        );
    }

    (
        "ai_provider_unreachable",
        "Could not reach LM Studio.",
    )
}

fn extract_first_json_object(stdout: &str) -> Option<String> {
    let start = stdout.find('{')?;
    let end = stdout.rfind('}')?;
    if end <= start {
        return None;
    }

    Some(stdout[start..=end].to_string())
}

fn looks_like_json_output(stdout: &str) -> bool {
    let trimmed = stdout.trim();
    if trimmed.starts_with('{') {
        return true;
    }

    if trimmed.contains("```json") {
        return true;
    }

    extract_first_json_object(trimmed).is_some()
}

fn ensure_lm_studio_stdout_is_json_candidate(
    stdout: &str,
    reasoning_enabled: bool,
) -> Result<(), AppError> {
    if looks_like_json_output(stdout) {
        return Ok(());
    }

    let message = if reasoning_enabled {
        "LM Studio finished reasoning without returning JSON. The model spent the output on thinking — try disabling reasoning, using a larger model, or lowering thinking in LM Studio."
    } else {
        "LM Studio returned a response that does not look like JSON."
    };
    Err(AppError::new("ai_process_failed", message))
}

fn normalize_lm_studio_stdout(stdout: String) -> String {
    if stdout.trim().starts_with('{') {
        return stdout;
    }

    extract_first_json_object(&stdout).unwrap_or(stdout)
}

fn lm_studio_max_tokens(config: &LmStudioConfig) -> u32 {
    if lm_studio_reasoning_enabled(config) {
        LM_STUDIO_MAX_TOKENS_REASONING
    } else {
        LM_STUDIO_MAX_TOKENS
    }
}

fn build_lm_studio_request_body(
    model: &str,
    prompt: &str,
    schema: &serde_json::Value,
    config: &LmStudioConfig,
    stream: bool,
) -> serde_json::Value {
    let reasoning_enabled = lm_studio_reasoning_enabled(config);
    let mut body = serde_json::json!({
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": if reasoning_enabled {
                    "You are a structured data API. Keep internal reasoning concise (under 2000 tokens). After a brief analysis, your final assistant message must contain ONLY one complete JSON object that satisfies the schema in the user prompt. Never end a response with thinking alone. Never return placeholder empty strings or hollow arrays when rich profile or job data is provided."
                } else {
                    "You are a structured data API. Read the full user input and return complete JSON that satisfies the schema. Never return placeholder empty strings or hollow arrays when rich profile or job data is provided."
                }
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "max_tokens": lm_studio_max_tokens(config),
        "temperature": 0,
        "stream": stream
    });

    if let Some(object) = body.as_object_mut() {
        if reasoning_enabled {
            // LM Studio currently applies json_schema to the thinking stream for Qwen-style
            // reasoning models, which traps JSON in reasoning_content and leaves content empty.
            object.insert("reasoning_effort".into(), serde_json::json!("medium"));
            object.insert(
                "chat_template_kwargs".into(),
                serde_json::json!({
                    "enable_thinking": true,
                    "thinking": true
                }),
            );
        } else {
            object.insert(
                "response_format".into(),
                serde_json::json!({
                    "type": "json_schema",
                    "json_schema": {
                        "name": "cv_tailor_output",
                        "strict": true,
                        "schema": schema
                    }
                }),
            );
            object.insert("reasoning_effort".into(), serde_json::json!("none"));
            object.insert(
                "chat_template_kwargs".into(),
                serde_json::json!({
                    "enable_thinking": false,
                    "thinking": false
                }),
            );
        }
    }

    body
}

fn resolve_lm_studio_output(
    content: Option<String>,
    reasoning_content: Option<String>,
) -> Option<String> {
    let content = content.unwrap_or_default();
    if !content.trim().is_empty() {
        return Some(content);
    }

    let reasoning_content = reasoning_content.unwrap_or_default();
    if !reasoning_content.trim().is_empty() {
        return Some(reasoning_content);
    }

    None
}

fn extract_lm_studio_message_content(payload: &serde_json::Value) -> Option<String> {
    payload
        .get("choices")
        .and_then(|value| value.as_array())
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(|content| content.as_str())
        .map(str::to_string)
}

fn extract_lm_studio_reasoning_content(payload: &serde_json::Value) -> Option<String> {
    payload
        .get("choices")
        .and_then(|value| value.as_array())
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("reasoning_content"))
        .and_then(|content| content.as_str())
        .map(str::to_string)
        .filter(|value| !value.trim().is_empty())
}

fn ensure_lm_studio_has_output(stdout: &str, reasoning_enabled: bool) -> Result<(), AppError> {
    if !stdout.trim().is_empty() {
        return Ok(());
    }

    let message = if reasoning_enabled {
        "LM Studio returned an empty response after reasoning. Retry the request or temporarily disable reasoning for structured output."
    } else {
        "LM Studio returned reasoning output but no JSON content. Try enabling reasoning mode in Settings → AI or switch to a non-reasoning instruct model."
    };
    Err(AppError::new("ai_process_failed", message))
}

fn extract_lm_studio_delta_reasoning_content(payload: &serde_json::Value) -> Option<String> {
    payload
        .get("choices")
        .and_then(|value| value.as_array())
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("delta"))
        .and_then(|delta| delta.get("reasoning_content"))
        .and_then(|content| content.as_str())
        .map(str::to_string)
}

fn extract_lm_studio_stream_reasoning_content(payload: &serde_json::Value) -> Option<String> {
    if let Some(content) = extract_lm_studio_delta_reasoning_content(payload) {
        return Some(content);
    }

    extract_lm_studio_reasoning_content(payload)
}

fn extract_lm_studio_finish_reason(payload: &serde_json::Value) -> Option<String> {
    payload
        .get("choices")
        .and_then(|value| value.as_array())
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("finish_reason"))
        .and_then(|reason| reason.as_str())
        .map(str::to_string)
}

fn extract_lm_studio_stream_content(payload: &serde_json::Value) -> Option<String> {
    if let Some(content) = extract_lm_studio_delta_content(payload) {
        return Some(content);
    }

    extract_lm_studio_message_content(payload)
}

fn ensure_lm_studio_response_complete(
    finish_reason: Option<&str>,
    reasoning_enabled: bool,
) -> Result<(), AppError> {
    if finish_reason == Some("length") {
        let message = if reasoning_enabled {
            "LM Studio response was truncated. Reasoning models need a large output budget for thinking plus JSON — raise max output tokens in LM Studio or disable reasoning for instruct models."
        } else {
            "LM Studio response was truncated. Increase the model output limit in LM Studio or choose a model with a larger context window."
        };
        return Err(AppError::new("ai_process_failed", message));
    }

    Ok(())
}

fn extract_lm_studio_delta_content(payload: &serde_json::Value) -> Option<String> {
    payload
        .get("choices")
        .and_then(|value| value.as_array())
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("delta"))
        .and_then(|delta| delta.get("content"))
        .and_then(|content| content.as_str())
        .map(str::to_string)
}

fn classify_lm_studio_error(status: reqwest::StatusCode, body: &str) -> &'static str {
    let lower = body.to_lowercase();
    if status.as_u16() == 401 || lower.contains("unauthorized") || lower.contains("api key") {
        return "ai_auth_required";
    }

    if lower.contains("json_schema")
        || lower.contains("response_format")
        || lower.contains("structured")
        || lower.contains("schema")
    {
        return "ai_schema_rejected";
    }

    "ai_process_failed"
}

fn process_lm_studio_sse_line(
    line: &str,
    app: Option<&AppHandle>,
    run_id: &str,
    accumulated_content: &mut String,
    accumulated_reasoning: &mut String,
    finish_reason: &mut Option<String>,
) {
    let trimmed = line.trim();
    if !trimmed.starts_with("data:") {
        return;
    }

    let data = trimmed.trim_start_matches("data:").trim();
    if data.is_empty() || data == "[DONE]" {
        return;
    }

    let Ok(payload) = serde_json::from_str::<serde_json::Value>(data) else {
        return;
    };

    if let Some(reason) = extract_lm_studio_finish_reason(&payload) {
        *finish_reason = Some(reason);
    }

    if let Some(content) = extract_lm_studio_stream_content(&payload) {
        if !content.is_empty() {
            emit_run_progress(app, run_id, "stdout", &content);
            accumulated_content.push_str(&content);
        }
    }

    if let Some(reasoning) = extract_lm_studio_stream_reasoning_content(&payload) {
        if !reasoning.is_empty() {
            accumulated_reasoning.push_str(&reasoning);
        }
    }
}

fn drain_lm_studio_sse_buffer(
    buffer: &mut String,
    app: Option<&AppHandle>,
    run_id: &str,
    accumulated_content: &mut String,
    accumulated_reasoning: &mut String,
    finish_reason: &mut Option<String>,
) {
    while let Some(newline_index) = buffer.find('\n') {
        let line = buffer[..newline_index].to_string();
        buffer.drain(..=newline_index);
        process_lm_studio_sse_line(
            &line,
            app,
            run_id,
            accumulated_content,
            accumulated_reasoning,
            finish_reason,
        );
    }
}

async fn run_lm_studio(
    app: Option<&AppHandle>,
    run_id: &str,
    config: &LmStudioConfig,
    request: &AiRunRequest,
    stream: bool,
) -> Result<AiRunResponse, AppError> {
    let model = config
        .model
        .as_ref()
        .or(request.model.as_ref())
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            AppError::new(
                "ai_tool_unavailable",
                "No LM Studio model is selected. Choose a model in Settings → AI.",
            )
        })?
        .to_string();

    let base_url = lm_studio_base_url(config);
    let url = format!("{base_url}/v1/chat/completions");
    let reasoning_enabled = lm_studio_reasoning_enabled(config);
    let body = build_lm_studio_request_body(
        &model,
        &request.prompt,
        &request.schema,
        config,
        stream,
    );

    let http_request = apply_lm_studio_auth(lm_studio_http_client(config).post(url), config)
        .header("Content-Type", "application/json")
        .json(&body);

    let start = Instant::now();
    let response = http_request.send().await.map_err(|error| {
        let (code, message) = classify_lm_studio_transport_error(&error);
        AppError::with_details(code, message, error.to_string())
    })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::with_details(
            classify_lm_studio_error(status, &body),
            "LM Studio request failed.",
            if body.trim().is_empty() {
                format!("HTTP {status}")
            } else {
                body
            },
        ));
    }

    let stdout = if stream {
        let mut accumulated_content = String::new();
        let mut accumulated_reasoning = String::new();
        let mut buffer = String::new();
        let mut finish_reason = None;

        let mut response = response;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|error| {
                let (code, message) = classify_lm_studio_transport_error(&error);
                AppError::with_details(code, message, error.to_string())
            })?
        {
            buffer.push_str(&String::from_utf8_lossy(&chunk));
            drain_lm_studio_sse_buffer(
                &mut buffer,
                app,
                run_id,
                &mut accumulated_content,
                &mut accumulated_reasoning,
                &mut finish_reason,
            );
        }

        if !buffer.trim().is_empty() {
            process_lm_studio_sse_line(
                &buffer,
                app,
                run_id,
                &mut accumulated_content,
                &mut accumulated_reasoning,
                &mut finish_reason,
            );
        }

        ensure_lm_studio_response_complete(finish_reason.as_deref(), reasoning_enabled)?;
        resolve_lm_studio_output(
            Some(accumulated_content),
            Some(accumulated_reasoning),
        )
        .ok_or_else(|| {
            AppError::new(
                "ai_process_failed",
                "LM Studio returned an empty response.",
            )
        })?
    } else {
        let payload: serde_json::Value = response.json().await?;
        let finish_reason = extract_lm_studio_finish_reason(&payload);
        ensure_lm_studio_response_complete(finish_reason.as_deref(), reasoning_enabled)?;
        let stdout = resolve_lm_studio_output(
            extract_lm_studio_message_content(&payload),
            extract_lm_studio_reasoning_content(&payload),
        )
        .ok_or_else(|| {
            AppError::new(
                "ai_process_failed",
                "LM Studio returned a response without message content.",
            )
        })?;
        ensure_lm_studio_has_output(&stdout, reasoning_enabled)?;
        stdout
    };

    if stdout.trim().is_empty() {
        return Err(AppError::new(
            "ai_process_failed",
            "LM Studio returned an empty response.",
        ));
    }

    let stdout = normalize_lm_studio_stdout(stdout);
    ensure_lm_studio_stdout_is_json_candidate(&stdout, reasoning_enabled)?;

    Ok(AiRunResponse {
        tool: LM_STUDIO_TOOL_ID.to_string(),
        stdout,
        stderr: String::new(),
        duration_ms: start.elapsed().as_millis(),
    })
}

pub async fn run_ai_tool(
    app: &AppHandle,
    request: AiRunRequest,
) -> Result<AiRunResponse, AppError> {
    let has_progress = request
        .run_id
        .as_ref()
        .is_some_and(|value| !value.trim().is_empty());
    let run_id = request
        .run_id
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "anonymous".to_string());
    let progress_app = has_progress.then(|| app.clone());

    if request.tool == LM_STUDIO_TOOL_ID {
        let config = request.lm_studio.clone().unwrap_or_default();
        let status = detect_lm_studio(&config).await;
        if !status.available {
            return Err(AppError::with_details(
                "ai_tool_unavailable",
                "LM Studio is not available. Check the server URL and loaded model in Settings → AI.",
                status.error.unwrap_or_else(|| status.version.unwrap_or_default()),
            ));
        }

        return run_lm_studio(
            progress_app.as_ref(),
            &run_id,
            &config,
            &request,
            true,
        )
        .await;
    }

    let tool_paths = request.tool_paths.unwrap_or_default();
    let tool = resolve_cli_tool(&request.tool, &tool_paths).await?;
    let binary_path = resolve_binary_path(&tool, &tool_paths);

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

#[cfg(test)]
mod lm_studio_tests {
    use super::{
        extract_first_json_object, looks_like_json_output, normalize_lm_studio_stdout,
        resolve_lm_studio_output,
    };

    #[test]
    fn prefers_message_content_over_reasoning_content() {
        let resolved = resolve_lm_studio_output(
            Some("{\"answer\":1}".to_string()),
            Some("{\"answer\":2}".to_string()),
        );

        assert_eq!(resolved.as_deref(), Some("{\"answer\":1}"));
    }

    #[test]
    fn falls_back_to_reasoning_content_when_content_is_empty() {
        let resolved = resolve_lm_studio_output(
            Some("   ".to_string()),
            Some("{\"answer\":2}".to_string()),
        );

        assert_eq!(resolved.as_deref(), Some("{\"answer\":2}"));
    }

    #[test]
    fn extracts_json_from_reasoning_prose() {
        let stdout = normalize_lm_studio_stdout(
            "Analysis notes...\n{\"score\":75,\"matchedKeywords\":[\"typescript\"]}".to_string(),
        );

        assert!(looks_like_json_output(&stdout));
        assert_eq!(
            extract_first_json_object(&stdout).as_deref(),
            Some("{\"score\":75,\"matchedKeywords\":[\"typescript\"]}")
        );
    }

    #[test]
    fn rejects_reasoning_only_prose() {
        assert!(!looks_like_json_output(
            "The candidate matches TypeScript but lacks four years of experience."
        ));
    }
}
