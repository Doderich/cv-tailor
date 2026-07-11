use tauri::{
    menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    App, Emitter, Manager,
};

const MENU_EVENT: &str = "app-menu";

pub fn install(app: &App) -> tauri::Result<()> {
    let settings = MenuItemBuilder::with_id("settings", "Settings…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;
    let new_application = MenuItemBuilder::with_id("new_application", "New Application")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let command_palette = MenuItemBuilder::with_id("command_palette", "Command Palette…")
        .accelerator("CmdOrCtrl+K")
        .build(app)?;
    let export_pdf = MenuItemBuilder::with_id("export_pdf", "Export PDF…")
        .accelerator("CmdOrCtrl+Shift+E")
        .build(app)?;
    let workspace = MenuItemBuilder::with_id("workspace", "Workspace")
        .accelerator("CmdOrCtrl+1")
        .build(app)?;
    let check_for_updates = MenuItemBuilder::with_id("check_for_updates", "Check for Updates…")
        .build(app)?;

    let about = AboutMetadata {
        name: Some("CV Tailor".into()),
        version: Some(app.package_info().version.to_string()),
        copyright: Some("Copyright © 2026 Malte Budig".into()),
        credits: Some(
            "Tailor CVs to job applications with local-first privacy.\n\nhttps://github.com/Doderich/cv-tailor"
                .into(),
        ),
        ..Default::default()
    };

    let app_submenu = SubmenuBuilder::new(app, "CV Tailor")
        .about(Some(about))
        .separator()
        .item(&settings)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .item(&check_for_updates)
        .separator()
        .quit()
        .build()?;

    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(&new_application)
        .item(&export_pdf)
        .separator()
        .item(&command_palette)
        .build()?;

    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .separator()
        .select_all()
        .build()?;

    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(&workspace)
        .item(&command_palette)
        .build()?;

    let window_submenu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .fullscreen()
        .separator()
        .close_window()
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &app_submenu,
            &file_submenu,
            &edit_submenu,
            &view_submenu,
            &window_submenu,
        ])
        .build()?;

    app.set_menu(menu)?;

    let settings_id = settings.id().clone();
    let new_application_id = new_application.id().clone();
    let command_palette_id = command_palette.id().clone();
    let export_pdf_id = export_pdf.id().clone();
    let workspace_id = workspace.id().clone();
    let check_for_updates_id = check_for_updates.id().clone();

    app.handle().on_menu_event(move |app, event| {
        let action = if event.id() == &settings_id {
            Some("settings")
        } else if event.id() == &new_application_id {
            Some("new_application")
        } else if event.id() == &command_palette_id {
            Some("command_palette")
        } else if event.id() == &export_pdf_id {
            Some("export_pdf")
        } else if event.id() == &workspace_id {
            Some("workspace")
        } else if event.id() == &check_for_updates_id {
            Some("check_for_updates")
        } else {
            None
        };

        if let Some(action) = action {
            emit_menu_action(app, action);
        }
    });

    Ok(())
}

fn emit_menu_action<R: tauri::Runtime>(app: &tauri::AppHandle<R>, action: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit(MENU_EVENT, action);
        return;
    }

    let _ = app.emit(MENU_EVENT, action);
}
