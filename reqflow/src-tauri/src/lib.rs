mod ai;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ai::stream::ActiveRequestRegistry::default())
        .manage(std::sync::Mutex::new(storage::StorageState::default()))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_upload::init())
        .invoke_handler(tauri::generate_handler![
            ai::commands::set_ai_provider_secret,
            ai::commands::ai_provider_secret_status,
            ai::commands::delete_ai_provider_secret,
            ai::commands::list_ai_models,
            ai::commands::test_ai_provider,
            ai::commands::start_ai_chat,
            ai::commands::cancel_ai_chat,
            storage::commands::storage_create_project,
            storage::commands::storage_open_project,
            storage::commands::storage_close_project,
            storage::commands::storage_create_table,
            storage::commands::storage_undo,
            storage::commands::storage_run_benchmark,
            storage::commands::storage_backup_project,
            storage::commands::storage_list_backups,
            storage::commands::storage_restore_project,
            storage::lifecycle_commands::storage_rename_project,
            storage::lifecycle_commands::storage_rename_table,
            storage::lifecycle_commands::storage_delete_table,
            storage::lifecycle_commands::storage_reorder_tables,
            storage::lifecycle_commands::storage_create_view,
            storage::lifecycle_commands::storage_rename_view,
            storage::lifecycle_commands::storage_duplicate_view,
            storage::lifecycle_commands::storage_delete_view,
            storage::lifecycle_commands::storage_reorder_views,
        ])
        .setup(|app| {
            // 调试模式自动弹出 WebView devtools 面板，本机右键菜单没有触发出
            // "Inspect Element"，用 API 直接打开更可靠，不依赖右键。仅 debug
            // build 生效，release 打包不受影响。
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            #[cfg(not(debug_assertions))]
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
