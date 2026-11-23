import { invoke } from '@tauri-apps/api/core';

export type NativeInfo = { version: string; backend: string; vision: boolean; inpainting: boolean; gpu_telemetry: boolean };
export async function saveProjectAtomic(path: string, content: string): Promise<void> { if (!isDesktopRuntime()) throw new Error('Atomic project save chỉ khả dụng trong Tauri.'); await invoke('save_project_atomic', { path, content }); }
export async function readProjectNative(path: string): Promise<string> { if (!isDesktopRuntime()) throw new Error('Native project read chỉ khả dụng trong Tauri.'); return invoke<string>('read_project', { path }); }

export function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function getNativeInfo(): Promise<NativeInfo | null> {
  if (!isDesktopRuntime()) return null;
  return invoke<NativeInfo>('app_info');
}

export async function getModelsDirectory(): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  return invoke<string>('model_directory');
}

export type NativeExportReport = { folder: string; files_written: number; files_failed: string[]; status: 'completed' | 'partial' | 'cancelled' };
export async function exportImages(parent: string, folderName: string, files: Array<{ file_name: string; data_base64: string }>): Promise<NativeExportReport | null> { if (!isDesktopRuntime()) return null; return invoke<NativeExportReport>('export_images', { parent, folderName, files }); }

export type NativeModelEntry = { name: string; path: string; extension: string; size_bytes: number; kind: string; ready: boolean; reason?: string };
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

export async function getGpuTelemetry(): Promise<NativeGpuTelemetry | null> {
  if (!isDesktopRuntime()) return null;
  return invoke<NativeGpuTelemetry>('get_gpu_telemetry');
}

