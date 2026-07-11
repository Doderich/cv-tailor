fn main() {
    tauri_build::build();

    #[cfg(target_os = "macos")]
    schedule_display_binary_symlink();
}

#[cfg(target_os = "macos")]
fn schedule_display_binary_symlink() {
    use std::path::PathBuf;
    use std::thread;
    use std::time::Duration;

    let profile = std::env::var("PROFILE").unwrap_or_else(|_| "debug".into());
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR");
    let target_dir = PathBuf::from(manifest_dir)
        .join("target")
        .join(profile);
    let source = target_dir.join("cv-tailor");
    let link = target_dir.join("CV Tailor");

    println!("cargo:rerun-if-changed=build.rs");

    thread::spawn(move || {
        for _ in 0..600 {
            if source.exists() {
                let _ = std::fs::remove_file(&link);
                if std::os::unix::fs::symlink("cv-tailor", &link).is_ok() {
                    return;
                }
            }

            thread::sleep(Duration::from_millis(50));
        }
    });
}
