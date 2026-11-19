#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      #[cfg(desktop)]
      {
        use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
        let fullscreen = MenuItem::with_id(app, "toggle-fullscreen", "全屏 (F11)", true, None::<&str>)?;
        let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
        let refresh = MenuItem::with_id(app, "refresh", "刷新", true, None::<&str>)?;
        let separator = PredefinedMenuItem::separator();
        let menu = Menu::with_items(app, &[&fullscreen, &separator, &refresh, &quit])?;
        app.set_menu(menu)?;
        app.on_menu_event(|app, event| match event.id.as_ref() {
          "toggle-fullscreen" => {
            if let Some(w) = app.get_webview_window("main") {
              let _ = w.set_fullscreen(!w.is_fullscreen().unwrap_or(false));
            }
          }
          "refresh" => {
            if let Some(w) = app.get_webview_window("main") {
              let _ = w.eval("window.location.reload()");
            }
          }
          "quit" => { app.exit(0); }
          _ => {}
        });
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri app");
}
