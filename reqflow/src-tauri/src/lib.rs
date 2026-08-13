mod ai;
mod storage;

#[cfg(desktop)]
const MENU_SETTINGS: &str = "morfra-settings";
#[cfg(desktop)]
const MENU_NEW_PROJECT: &str = "morfra-new-project";
#[cfg(desktop)]
const MENU_OPEN_PROJECT: &str = "morfra-open-project";

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
        .on_menu_event(|app, event| {
            #[cfg(desktop)]
            {
                use tauri::{Emitter, Manager};
                if let Some(window) = app.get_webview_window("main") {
                    let emitted = match event.id().as_ref() {
                        MENU_SETTINGS => window.emit("morfra-open-settings", "appearance"),
                        MENU_NEW_PROJECT => window.emit("morfra-new-project", ()),
                        MENU_OPEN_PROJECT => window.emit("morfra-open-project", ()),
                        _ => return,
                    };
                    let _ = emitted;
                    let _ = window.set_focus();
                }
            }
        })
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
            storage::commands::storage_add_attachment,
            storage::commands::storage_list_attachments,
            storage::commands::storage_remove_attachment,
            storage::commands::storage_replace_attachment,
            storage::commands::storage_attachment_path,
            storage::lifecycle_commands::storage_rename_project,
            storage::lifecycle_commands::storage_rename_table,
            storage::lifecycle_commands::storage_update_table_emoji,
            storage::lifecycle_commands::storage_delete_table,
            storage::lifecycle_commands::storage_restore_deleted_table,
            storage::lifecycle_commands::storage_reorder_tables,
            storage::lifecycle_commands::storage_create_view,
            storage::lifecycle_commands::storage_rename_view,
            storage::lifecycle_commands::storage_duplicate_view,
            storage::lifecycle_commands::storage_delete_view,
            storage::lifecycle_commands::storage_reorder_views,
            storage::lifecycle_commands::storage_get_view_config,
            storage::lifecycle_commands::storage_update_view_config,
            storage::lifecycle_commands::storage_get_detail_fields,
            storage::lifecycle_commands::storage_update_detail_fields,
            storage::field_commands::storage_load_table_data,
            storage::field_commands::storage_create_field,
            storage::field_commands::storage_update_field,
            storage::field_commands::storage_delete_field,
            storage::field_commands::storage_create_field_group,
            storage::field_commands::storage_rename_field_group,
            storage::field_commands::storage_delete_field_group,
            storage::field_commands::storage_move_field,
            storage::field_commands::storage_reorder_field_groups,
            storage::field_commands::storage_reorder_fields,
            storage::field_commands::storage_create_field_option,
            storage::field_commands::storage_update_field_option,
            storage::field_commands::storage_reorder_field_options,
            storage::field_commands::storage_get_field_option_usage,
            storage::field_commands::storage_delete_field_option,
            storage::record_commands::storage_create_record,
            storage::record_commands::storage_update_cell,
            storage::record_commands::storage_delete_record,
            storage::record_commands::storage_apply_table_mutation,
            storage::record_commands::storage_reorder_records,
            storage::record_commands::storage_move_board_card,
            storage::record_commands::storage_get_activity_binding,
            storage::record_commands::storage_update_activity_binding,
            storage::record_commands::storage_load_activity_events,
            storage::record_commands::storage_update_activity_note,
            storage::record_commands::storage_create_activity_comment,
            storage::record_commands::storage_delete_activity_event,
            storage::record_commands::storage_get_detail_tabs,
            storage::record_commands::storage_load_record_detail_content,
            storage::record_commands::storage_save_record_detail_content,
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

                let settings = MenuItemBuilder::with_id(MENU_SETTINGS, "设置…")
                    .accelerator("CmdOrCtrl+Comma")
                    .build(app)?;
                let app_menu = SubmenuBuilder::new(app, "Morfra")
                    .about(None)
                    .separator()
                    .item(&settings)
                    .separator()
                    .services()
                    .separator()
                    .hide()
                    .hide_others()
                    .show_all()
                    .separator()
                    .quit()
                    .build()?;
                let file_menu = SubmenuBuilder::new(app, "文件")
                    .text(MENU_NEW_PROJECT, "新建项目…")
                    .text(MENU_OPEN_PROJECT, "打开项目…")
                    .build()?;
                let edit_menu = SubmenuBuilder::new(app, "编辑")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;
                let window_menu = SubmenuBuilder::new(app, "窗口")
                    .minimize()
                    .fullscreen()
                    .separator()
                    .bring_all_to_front()
                    .build()?;
                let menu = MenuBuilder::new(app)
                    .items(&[&app_menu, &file_menu, &edit_menu, &window_menu])
                    .build()?;
                app.set_menu(menu)?;
            }

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
