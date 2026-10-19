//! Tauri shell. All CAM logic lives in TypeScript (packages/core) so it is unit-testable
//! and shared with a future web build. Rust is reserved for native integration and,
//! later, heavy geometry if profiling shows the need (docs/engineering/30-architecture.md).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running ArcFlow");
}
