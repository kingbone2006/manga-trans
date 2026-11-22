use serde::Serialize;
use std::{fs, io::Write, path::{Path, PathBuf}};
use tauri::Manager;

mod commands {
    use super::*;
    #[derive(Debug, Serialize)]
    pub struct ModelEntry { pub name: String, pub path: String, pub extension: String, pub size_bytes: u64, pub kind: String, pub ready: bool, pub reason: Option<String> }
    fn safe_parent(path: &Path) -> Result<&Path, String> { path.parent().ok_or_else(|| "Đường dẫn project không có thư mục cha.".to_string()) }
    #[tauri::command]
    pub fn app_info() -> serde_json::Value { serde_json::json!({ "version": env!("CARGO_PKG_VERSION"), "backend": "tauri-rust", "vision": false, "inpainting": false, "gpu_telemetry": false }) }
    #[tauri::command]
    pub fn save_project_atomic(path: String, content: String) -> Result<(), String> { let target=PathBuf::from(path); let parent=safe_parent(&target)?; fs::create_dir_all(parent).map_err(|e|format!("Không thể tạo thư mục project: {e}"))?; let temp=target.with_extension("mangatrans.tmp"); let mut file=fs::File::create(&temp).map_err(|e|format!("Không thể tạo file tạm: {e}"))?; file.write_all(content.as_bytes()).map_err(|e|format!("Không thể ghi project: {e}"))?; file.sync_all().map_err(|e|format!("Không thể flush project: {e}"))?; if target.exists(){fs::copy(&target,target.with_extension("mangatrans.bak")).map_err(|e|format!("Không thể tạo backup: {e}"))?;} fs::rename(&temp,&target).map_err(|e|format!("Không thể công bố project: {e}")) }
    #[tauri::command]
    pub fn read_project(path: String) -> Result<String, String> { fs::read_to_string(path).map_err(|e|format!("Không thể đọc project: {e}")) }
    #[tauri::command]
    pub fn model_directory(app: tauri::AppHandle) -> Result<String, String> { let dir=app.path().app_data_dir().map_err(|e|format!("Không lấy được thư mục dữ liệu: {e}"))?.join("models"); fs::create_dir_all(&dir).map_err(|e|format!("Không thể tạo thư mục models: {e}"))?; Ok(dir.to_string_lossy().to_string()) }
    #[tauri::command]
    pub fn scan_models(path: String) -> Result<Vec<ModelEntry>, String> { let root=PathBuf::from(path); if !root.exists(){return Ok(Vec::new());} let mut entries=Vec::new(); for item in fs::read_dir(root).map_err(|e|format!("Không thể quét models: {e}"))? { let item=item.map_err(|e|e.to_string())?; let path=item.path(); if !path.is_file(){continue;} let extension=path.extension().and_then(|x|x.to_str()).unwrap_or_default().to_ascii_lowercase(); if extension!="gguf"&&extension!="mmproj"{continue;} let metadata=fs::metadata(&path).map_err(|e|e.to_string())?; let kind=if extension=="mmproj"{"vision-encoder"}else{"llm"}; entries.push(ModelEntry{name:path.file_name().unwrap_or_default().to_string_lossy().to_string(),path:path.to_string_lossy().to_string(),extension:extension.clone(),size_bytes:metadata.len(),kind:kind.to_string(),ready:extension=="gguf",reason:if extension=="mmproj"{Some("mmproj cần được ghép với GGUF tương thích; chưa tự load.".to_string())}else{None}}); } entries.sort_by(|a,b|a.name.to_lowercase().cmp(&b.name.to_lowercase())); Ok(entries) }
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(){ tauri::Builder::default().plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_opener::init()).invoke_handler(tauri::generate_handler![commands::app_info,commands::save_project_atomic,commands::read_project,commands::model_directory,commands::scan_models]).run(tauri::generate_context!()).expect("error while running MangaTrans"); }
#[cfg(test)]
mod tests { #[test] fn backend_capabilities_are_explicit(){ let info=super::commands::app_info(); assert_eq!(info["vision"],false); assert_eq!(info["inpainting"],false); } }
