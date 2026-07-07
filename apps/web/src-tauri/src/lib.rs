mod ai;
mod commands;
mod errors;
mod pdf_export;
mod storage;
mod web_fetch;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_app_state,
            commands::save_app_state,
            commands::detect_ai_tools,
            commands::run_ai_tool,
            commands::fetch_url_text,
            commands::export_generated_cv_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
