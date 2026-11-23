/**
 * ============================================================================
 * Tauri Native Bridge (Rust FFI Interop)
 * ----------------------------------------------------------------------------
 * Cầu nối giữa Frontend (React/TypeScript) và Backend hệ thống viết bằng Rust:
 * 1. `save_project_atomic`: Lưu file an toàn bằng cơ chế ghi tạm `.tmp` rồi rename, chống hỏng file khi mất điện/crash.
 * 2. `read_project`: Đọc file dự án `.mangatrans` từ ổ đĩa native.
 * 3. `export_images`: Xuất hàng loạt ảnh đã thay chữ ra thư mục vật lý.
 * 4. `scan_models`: Quét file GGUF / mmproj trong thư mục `models/`.
 * 5. `get_gpu_telemetry`: Đọc trực tiếp thông số VRAM, Adapter GPU từ Windows DXGI.
 * ============================================================================
 */
import { invoke } from '@tauri-apps/api/core';

export type NativeInfo = {
  version: string;
  backend: string;
  vision: boolean;
  inpainting: boolean;
  gpu_telemetry: boolean;
};

/** Kiểm tra xem ứng dụng đang chạy trong môi trường Desktop Tauri hay Web browser */
export function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Lưu file dự án bằng cơ chế atomic (ghi file tmp trước, rename sau) */
export async function saveProjectAtomic(path: string, content: string): Promise<void> {
  if (!isDesktopRuntime()) throw new Error('Atomic project save chỉ khả dụng trong Tauri.');
  await invoke('save_project_atomic', { path, content });
}

/** Đọc file dự án từ ổ cứng native */
export async function readProjectNative(path: string): Promise<string> {
  if (!isDesktopRuntime()) throw new Error('Native project read chỉ khả dụng trong Tauri.');
  return invoke<string>('read_project', { path });
}

/** Lấy thông tin phiên bản backend Rust */
export async function getNativeInfo(): Promise<NativeInfo | null> {
  if (!isDesktopRuntime()) return null;
  return invoke<NativeInfo>('app_info');
}

/** Lấy đường dẫn thư mục models mặc định */
export async function getModelsDirectory(): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  return invoke<string>('model_directory');
}

export type NativeExportReport = {
  folder: string;
  files_written: number;
  files_failed: string[];
  status: 'completed' | 'partial' | 'cancelled';
};

/** Xuất danh sách ảnh base64 đã dịch ra thư mục cha được chọn */
export async function exportImages(
  parent: string,
  folderName: string,
  files: Array<{ file_name: string; data_base64: string }>
): Promise<NativeExportReport | null> {
  if (!isDesktopRuntime()) return null;
  return invoke<NativeExportReport>('export_images', { parent, folderName, files });
}

export type NativeModelEntry = {
  name: string;
  path: string;
  extension: string;
  size_bytes: number;
  kind: string;
  ready: boolean;
  reason?: string;
};

/** Quét danh sách file GGUF / mmproj trong thư mục models */
export async function scanNativeModels(path: string): Promise<NativeModelEntry[]> {
  if (!isDesktopRuntime()) return [];
  return invoke<NativeModelEntry[]>('scan_models', { path });
}

export type NativeGpuTelemetry = {
  available: boolean;
  adapter_name: string;
  vendor_id: number;
  dedicated_vram_bytes: number;
  shared_vram_bytes: number;
  budget_vram_bytes: number | null;
  current_usage_vram_bytes: number | null;
  power_watts: number | null;
  temperature_celsius: number | null;
  fan_speed_rpm: number | null;
  note: string;
};

/** Đọc thông số GPU và VRAM thời gian thực từ Windows DXGI */
export async function getGpuTelemetry(): Promise<NativeGpuTelemetry | null> {
  if (!isDesktopRuntime()) return null;
  return invoke<NativeGpuTelemetry>('get_gpu_telemetry');
}


