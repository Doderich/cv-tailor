pub mod ai;
pub mod api;
pub mod cloud_backup;
pub mod error;

pub use ai::{
    detect_ai_tools, list_lm_studio_models, run_ai_tool, suggest_ai_tool_paths, AiRunProgressEvent,
    AiRunRequest, AiRunResponse, AiToolPaths, AiToolStatus, LmStudioConfig, LmStudioModel,
    ProgressSink, AI_RUN_PROGRESS_EVENT,
};
pub use api::{ai_routes, cloud_backup_routes, serve, shared_state, state_from_env, GatewayState};
pub use cloud_backup::{
    config_from_env, download_backup, list_backups, test_connection, upload_backup,
    CloudBackupConfig, CloudBackupDownloadRequest, CloudBackupDownloadResponse,
    CloudBackupListRequest, CloudBackupListResponse, CloudBackupObjectMeta,
    CloudBackupTestResponse, CloudBackupUploadRequest, CloudBackupUploadResponse,
};
pub use error::AppError;
