use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Cursor, Read, Write},
    path::{Path, PathBuf},
};
use tauri::Manager;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

#[derive(Debug, Serialize, Deserialize)]
pub struct Manifest {
    pub format_version: u32,
    pub app: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GpuTelemetry {
    pub available: bool,
    pub adapter_name: String,
    pub vendor_id: u32,
    pub dedicated_vram_bytes: u64,
    pub shared_vram_bytes: u64,
    pub budget_vram_bytes: Option<u64>,
    pub current_usage_vram_bytes: Option<u64>,
    pub power_watts: Option<f32>,
    pub temperature_celsius: Option<f32>,
    pub fan_speed_rpm: Option<u32>,
    pub note: String,
}

mod commands {
    use super::*;
    #[derive(Debug, Serialize)]
    pub struct ModelEntry { pub name: String, pub path: String, pub extension: String, pub size_bytes: u64, pub kind: String, pub ready: bool, pub reason: Option<String> }
    fn safe_parent(path: &Path) -> Result<&Path, String> { path.parent().ok_or_else(|| "Đường dẫn project không có thư mục cha.".to_string()) }
    #[derive(Debug, Serialize, Deserialize)]
    pub struct NativeHttpResponse {
        pub status: u16,
        pub body: String,
        pub ok: bool,
    }

    #[tauri::command]
    pub async fn native_http_request(
        url: String,
        method: String,
        headers: std::collections::HashMap<String, String>,
        body: Option<String>,
    ) -> Result<NativeHttpResponse, String> {
        tauri::async_runtime::spawn_blocking(move || {
            let response = if method.eq_ignore_ascii_case("POST") {
                let mut req = ureq::post(&url);
                for (k, v) in headers {
                    req = req.header(&k, &v);
                }
                if let Some(b) = body {
                    req.send(b.as_bytes())
                } else {
                    req.send(b"".as_slice())
                }
            } else {
                let mut req = ureq::get(&url);
                for (k, v) in headers {
                    req = req.header(&k, &v);
                }
                req.call()
            };
            match response {
                Ok(mut resp) => {
                    let status = resp.status().as_u16();
                    let body = resp.body_mut().read_to_string().unwrap_or_default();
                    Ok(NativeHttpResponse {
                        status,
                        body,
                        ok: status >= 200 && status < 300,
                    })
                }
                Err(e) => Err(format!("Lỗi kết nối native: {e}")),
            }
        })
        .await
        .map_err(|e| format!("Task spawn error: {e}"))?
    }

    #[tauri::command]
    pub fn app_info() -> serde_json::Value { serde_json::json!({ "version": env!("CARGO_PKG_VERSION"), "backend": "tauri-rust", "vision": false, "inpainting": false, "gpu_telemetry": true }) }

    #[tauri::command]
    pub fn save_project_atomic(path: String, content: String) -> Result<(), String> {
        let target = PathBuf::from(&path);
        let parent = safe_parent(&target)?;
        fs::create_dir_all(parent).map_err(|e| format!("Không thể tạo thư mục project: {e}"))?;

        let temp = target.with_extension("mangatrans.tmp");
        let file = fs::File::create(&temp).map_err(|e| format!("Không thể tạo file tạm: {e}"))?;

        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        let manifest = serde_json::to_string_pretty(&Manifest {
            format_version: 1,
            app: "manga-trans".to_string(),
        }).map_err(|e| e.to_string())?;

        zip.start_file("manifest.json", options).map_err(|e| format!("Lỗi ghi manifest: {e}"))?;
        zip.write_all(manifest.as_bytes()).map_err(|e| format!("Lỗi ghi manifest: {e}"))?;

        zip.start_file("project.json", options).map_err(|e| format!("Lỗi ghi project.json: {e}"))?;
        zip.write_all(content.as_bytes()).map_err(|e| format!("Lỗi ghi project content: {e}"))?;

        let file = zip.finish().map_err(|e| format!("Không thể hoàn tất zip: {e}"))?;
        file.sync_all().map_err(|e| format!("Không thể flush project: {e}"))?;

        if target.exists() {
            let _ = fs::copy(&target, target.with_extension("mangatrans.bak"));
        }
        fs::rename(&temp, &target).map_err(|e| format!("Không thể công bố project: {e}"))
    }

    #[tauri::command]
    pub fn read_project(path: String) -> Result<String, String> {
        let raw_bytes = fs::read(&path).map_err(|e| format!("Không thể đọc project: {e}"))?;
        let cursor = Cursor::new(&raw_bytes);
        if let Ok(mut archive) = ZipArchive::new(cursor) {
            for i in 0..archive.len() {
                let file = archive.by_index(i).map_err(|e| format!("Lỗi đọc zip index {i}: {e}"))?;
                let enclosed = file.enclosed_name().ok_or_else(|| "Zip Slip: tên file không an toàn".to_string())?;
                if enclosed.starts_with("..") || enclosed.is_absolute() {
                    return Err("Zip Slip: đường dẫn không an toàn".to_string());
                }
            }
            let mut project_file = archive.by_name("project.json").map_err(|_| "Tệp .mangatrans thiếu project.json trong container.".to_string())?;
            let mut content = String::new();
            project_file.read_to_string(&mut content).map_err(|e| format!("Không thể đọc project.json: {e}"))?;
            return Ok(content);
        }
        String::from_utf8(raw_bytes).map_err(|_| "Tệp không phải định dạng .mangatrans hợp lệ.".to_string())
    }
    #[derive(Debug, serde::Deserialize)]
    pub struct ExportFile { pub file_name: String, pub data_base64: String }
    #[derive(Debug, Serialize)]
    pub struct ExportReport { pub folder: String, pub files_written: usize, pub files_failed: Vec<String>, pub status: String }
    fn safe_name(value: &str) -> String { let mut name = value.chars().map(|c| if "<>:\"/\\|?*".contains(c) || c.is_control() { '_' } else { c }).collect::<String>(); while name.ends_with('.') || name.ends_with(' ') { name.pop(); } if name.is_empty() { "export".to_string() } else { name.chars().take(120).collect() } }
    #[tauri::command]
    pub fn export_images(parent: String, folder_name: String, files: Vec<ExportFile>) -> Result<ExportReport, String> {
        let root = PathBuf::from(parent); fs::create_dir_all(&root).map_err(|e| format!("Không thể tạo thư mục đích: {e}"))?;
        let base = safe_name(&folder_name); let mut target = root.join(&base); let mut suffix = 2; while target.exists() { target = root.join(format!("{base} ({suffix})")); suffix += 1; }
        let staging = root.join(format!(".{}.staging-{}", base, std::process::id())); if staging.exists() { fs::remove_dir_all(&staging).map_err(|e| e.to_string())?; } fs::create_dir_all(&staging).map_err(|e| format!("Không thể tạo staging: {e}"))?;
        let mut written = 0; let mut failed = Vec::new();
        for file in files { let name = safe_name(&file.file_name); match base64::Engine::decode(&base64::engine::general_purpose::STANDARD, file.data_base64) { Ok(bytes) => match fs::write(staging.join(&name), bytes) { Ok(()) => written += 1, Err(_) => failed.push(name) }, Err(_) => failed.push(name) } }
        if written == 0 { let _ = fs::remove_dir_all(&staging); return Ok(ExportReport { folder: target.to_string_lossy().to_string(), files_written: 0, files_failed: failed, status: "cancelled".to_string() }); }
        fs::rename(&staging, &target).map_err(|e| format!("Không thể công bố export: {e}"))?;
        Ok(ExportReport { folder: target.to_string_lossy().to_string(), files_written: written, files_failed: failed.clone(), status: if failed.is_empty() { "completed".to_string() } else { "partial".to_string() } })
    }
    #[tauri::command]
    pub fn model_directory(app: tauri::AppHandle) -> Result<String, String> { let dir=app.path().app_data_dir().map_err(|e|format!("Không lấy được thư mục dữ liệu: {e}"))?.join("models"); fs::create_dir_all(&dir).map_err(|e|format!("Không thể tạo thư mục models: {e}"))?; Ok(dir.to_string_lossy().to_string()) }
    #[tauri::command]
    pub fn scan_models(path: String) -> Result<Vec<ModelEntry>, String> { let root=PathBuf::from(path); if !root.exists(){return Ok(Vec::new());} let mut entries=Vec::new(); for item in fs::read_dir(root).map_err(|e|format!("Không thể quét models: {e}"))? { let item=item.map_err(|e|e.to_string())?; let path=item.path(); if !path.is_file(){continue;} let extension=path.extension().and_then(|x|x.to_str()).unwrap_or_default().to_ascii_lowercase(); if extension!="gguf"&&extension!="mmproj"{continue;} let metadata=fs::metadata(&path).map_err(|e|e.to_string())?; let kind=if extension=="mmproj"{"vision-encoder"}else{"llm"}; entries.push(ModelEntry{name:path.file_name().unwrap_or_default().to_string_lossy().to_string(),path:path.to_string_lossy().to_string(),extension:extension.clone(),size_bytes:metadata.len(),kind:kind.to_string(),ready:false,reason:Some(if extension=="mmproj"{"mmproj cần được ghép với GGUF tương thích; chưa tự load.".to_string()}else{"Thiếu mmproj tương ứng; chưa sẵn sàng cho vision.".to_string()})}); } let encoders: Vec<String> = entries.iter().filter(|e| e.extension=="mmproj").map(|e| e.name.trim_end_matches(".mmproj").to_ascii_lowercase()).collect(); for entry in entries.iter_mut().filter(|e| e.extension=="gguf") { let stem=entry.name.trim_end_matches(".gguf").to_ascii_lowercase(); if encoders.iter().any(|encoder| encoder==&stem || encoder.contains(&stem) || stem.contains(encoder)) { entry.ready=true; entry.reason=Some("Đủ cặp GGUF/mmproj; chỉ lập chỉ mục, chưa Load runtime.".to_string()); } }         entries.sort_by(|a,b|a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(entries)
    }
    #[tauri::command]
    pub fn get_gpu_telemetry() -> GpuTelemetry { query_windows_gpu() }
}

#[cfg(windows)]
fn query_windows_gpu() -> GpuTelemetry {
    use windows::Win32::Graphics::Dxgi::{CreateDXGIFactory1, IDXGIAdapter3, IDXGIFactory1, DXGI_MEMORY_SEGMENT_GROUP_LOCAL};
    use windows::core::Interface;
    unsafe {
        if let Ok(factory) = CreateDXGIFactory1::<IDXGIFactory1>() {
            let mut i = 0;
            while let Ok(adapter) = factory.EnumAdapters1(i) {
                if let Ok(desc) = adapter.GetDesc1() {
                    if (desc.Flags & 2) == 0 {
                        let len = desc.Description.iter().position(|&c| c == 0).unwrap_or(desc.Description.len());
                        let name = String::from_utf16_lossy(&desc.Description[..len]);
                        let mut budget = None; let mut usage = None;
                        if let Ok(adapter3) = adapter.cast::<IDXGIAdapter3>() {
                            let mut info = std::mem::zeroed();
                            if adapter3.QueryVideoMemoryInfo(0, DXGI_MEMORY_SEGMENT_GROUP_LOCAL, &mut info).is_ok() {
                                budget = Some(info.Budget); usage = Some(info.CurrentUsage);
                            }
                        }
                        return GpuTelemetry {
                            available: true,
                            adapter_name: name,
                            vendor_id: desc.VendorId,
                            dedicated_vram_bytes: desc.DedicatedVideoMemory as u64,
                            shared_vram_bytes: desc.SharedSystemMemory as u64,
                            budget_vram_bytes: budget,
                            current_usage_vram_bytes: usage,
                            power_watts: None,
                            temperature_celsius: None,
                            fan_speed_rpm: None,
                            note: "DXGI query thành công. Cảm biến hãng: không hiển thị số giả.".to_string(),
                        };
                    }
                }
                i += 1;
            }
        }
    }
    GpuTelemetry {
        available: false, adapter_name: "Không tìm thấy GPU DXGI".to_string(), vendor_id: 0,
        dedicated_vram_bytes: 0, shared_vram_bytes: 0, budget_vram_bytes: None, current_usage_vram_bytes: None,
        power_watts: None, temperature_celsius: None, fan_speed_rpm: None, note: "Không hỗ trợ".to_string(),
    }
}

#[cfg(not(windows))]
fn query_windows_gpu() -> GpuTelemetry {
    GpuTelemetry {
        available: false, adapter_name: "Phi Windows".to_string(), vendor_id: 0,
        dedicated_vram_bytes: 0, shared_vram_bytes: 0, budget_vram_bytes: None, current_usage_vram_bytes: None,
        power_watts: None, temperature_celsius: None, fan_speed_rpm: None, note: "Chỉ hỗ trợ Windows".to_string(),
    }
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::save_project_atomic,
            commands::read_project,
            commands::model_directory,
            commands::scan_models,
            commands::export_images,
            commands::get_gpu_telemetry,
            commands::native_http_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running MangaTrans");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn backend_capabilities_are_explicit() {
        let info = commands::app_info();
        assert_eq!(info["vision"], false);
        assert_eq!(info["inpainting"], false);
        assert_eq!(info["gpu_telemetry"], true);
    }

    #[test]
    fn zip_container_roundtrip_preserves_content() {
        let dir = std::env::temp_dir().join(format!("mangatrans_test_{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        let file_path = dir.join("test_proj.mangatrans");
        let content = r#"{"name":"test_proj","pages":[]}"#;

        let save_res = commands::save_project_atomic(
            file_path.to_string_lossy().to_string(),
            content.to_string(),
        );
        assert!(save_res.is_ok(), "save failed: {:?}", save_res);

        let read_res = commands::read_project(file_path.to_string_lossy().to_string());
        assert!(read_res.is_ok(), "read failed: {:?}", read_res);
        assert_eq!(read_res.unwrap(), content);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn gpu_telemetry_honest_sensors() {
        let telemetry = commands::get_gpu_telemetry();
        assert_eq!(telemetry.power_watts, None);
        assert_eq!(telemetry.temperature_celsius, None);
        assert_eq!(telemetry.fan_speed_rpm, None);
    }
}



