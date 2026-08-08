mod ai;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ai::stream::ActiveRequestRegistry::default())
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
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
