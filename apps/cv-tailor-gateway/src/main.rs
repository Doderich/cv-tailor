use std::path::PathBuf;

use cv_tailor_native::{serve, state_from_env};

fn load_env_files() {
    // Prefer repo-root / apps/web .env when launched via `pnpm run gateway:*`
    let candidates = [
        PathBuf::from("apps/web/.env"),
        PathBuf::from(".env"),
        PathBuf::from("apps/cv-tailor-gateway/.env"),
    ];
    for path in candidates {
        if path.is_file() {
            match dotenvy::from_path(&path) {
                Ok(()) => log::info!("Loaded env from {}", path.display()),
                Err(error) => log::warn!("Could not load {}: {error}", path.display()),
            }
        }
    }

    // Prefer CV_TAILOR_GATEWAY_TOKEN; accept VITE_* only as a process-env alias (never shipped to JS).
    if std::env::var_os("CV_TAILOR_GATEWAY_TOKEN").is_none() {
        if let Ok(token) = std::env::var("VITE_AI_GATEWAY_TOKEN") {
            if !token.trim().is_empty() {
                std::env::set_var("CV_TAILOR_GATEWAY_TOKEN", token);
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    load_env_files();

    let state = state_from_env();
    if state.token.is_none() {
        log::warn!(
            "CV_TAILOR_GATEWAY_TOKEN is unset; AI routes are open to anyone who can reach the bind address"
        );
    }

    std::fs::create_dir_all(&state.data_dir)?;
    serve(state).await
}
