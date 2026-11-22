import { invoke } from '@tauri-apps/api/core';

export type NativeInfo = { version: string; backend: string; vision: boolean; inpainting: boolean; gpu_telemetry: boolean };

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

export async function scanNativeModels(path: string) {
  if (!isDesktopRuntime()) return [];
  return invoke<Array<{ name: string; path: string; extension: string; size_bytes: number; kind: string; ready: boolean; reason?: string }>>('scan_models', { path });
}
