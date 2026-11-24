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
export type NativeHttpResponse = {
  status: number;
  body: string;
  ok: boolean;
};

/** Gọi HTTP request qua backend Rust để tránh hoàn toàn lỗi CORS và Private Network Access của WebView */
export async function nativeHttpRequest(
  url: string,
  method = 'GET',
  headers: Record<string, string> = {},
  body?: string
): Promise<NativeHttpResponse> {
  if (!isDesktopRuntime()) throw new Error('Native HTTP chỉ khả dụng trong Tauri desktop.');
  return invoke<NativeHttpResponse>('native_http_request', { url, method, headers, body });
}

/**
 * Universal Fetch:
 * Trong môi trường Tauri desktop, gọi qua nativeHttpRequest (Rust ureq) để vượt qua mọi rào cản CORS & loopback isolation.
 * Trong môi trường test/web, sử dụng window.fetch tiêu chuẩn.
 */
export async function universalFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isDesktopRuntime()) {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET');
      const headers: Record<string, string> = {};
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((v, k) => { headers[k] = v; });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([k, v]) => { headers[k] = v; });
        } else {
          Object.assign(headers, init.headers);
        }
      }
      const body = typeof init?.body === 'string' ? init.body : undefined;
      const resp = await nativeHttpRequest(url, method, headers, body);
      return new Response(resp.body, {
        status: resp.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Fallback to fetch if native invoke fails
    }
  }
  return fetch(input, init);
}



