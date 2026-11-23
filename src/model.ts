/**
 * ============================================================================
 * MangaTrans Core Data Models
 * ----------------------------------------------------------------------------
 * Định nghĩa cấu trúc dữ liệu cốt lõi cho toàn bộ ứng dụng:
 * - MangaProject: Đối tượng dự án lưu trữ file `.mangatrans`
 * - MangaPage: Thông tin trang truyện (ảnh, thứ tự, trạng thái duyệt, danh sách vùng)
 * - TextRegion: Tọa độ bbox (% 0..100) của bong bóng thoại, text OCR gốc & câu dịch
 * - ProviderSettings: Cấu hình kết nối AI (9Router, LM Studio, Ollama, v.v.)
 * ============================================================================
 */

/** Trạng thái duyệt của từng trang hoặc từng vùng thoại */
export type ReviewStatus = 'pending' | 'in-progress' | 'needs-review' | 'approved' | 'failed';

/** Phân loại vùng văn bản trên manga: thoại nhân vật, dẫn chuyện, hiệu ứng âm thanh SFX */
export type TextRegionKind = 'speech' | 'narration' | 'sound-effect' | 'other';

/**
 * TextRegion: Đại diện cho một bong bóng thoại hoặc khối văn bản trên trang
 * - Tọa độ x, y, width, height được chuẩn hóa dạng phần trăm (0 đến 100%) so với kích thước gốc của ảnh
 */
export interface TextRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceText: string;
  translation: string;
  confidence?: number;
  sourceLanguage?: string | null;
  kind?: TextRegionKind;
  status: ReviewStatus;
  fontSize?: number;
  textColor?: string;
  outlineColor?: string;
}

export type ProviderKind = '9router-cloud' | 'lm-studio-local' | 'custom-openai-compatible';
export type TranslationStrategy = 'online-first-local-fallback' | 'online-only' | 'local-only' | 'ask-before-switch';
export type RepairJobStatus = 'waiting-page' | 'queued' | 'running' | 'needs-review' | 'approved' | 'failed' | 'cancelled';

/** Mục trong bảng thuật ngữ để AI dịch nhất quán các danh từ riêng / xưng hô */
export interface GlossaryEntry {
  id: string;
  source: string;
  target: string;
  note?: string;
  enabled: boolean;
}

/** Hồ sơ nhân vật: giúp AI dịch đúng giọng điệu và đại từ xưng hô */
export interface CharacterProfile {
  id: string;
  name: string;
  pronouns?: string;
  relationship?: string;
  speechStyle?: string;
  enabled: boolean;
}

/** Tác vụ sửa lỗi cục bộ cho vùng thoại gặp sự cố (tràn khung, đọc sai, lệch thứ tự) */
export interface RepairJob {
  id: string;
  pageId: string;
  regionId?: string;
  kind: string;
  prompt: string;
  status: RepairJobStatus;
  inputRevision: string;
  error?: string;
}

/** Cấu hình kết nối tới AI Provider (9Router, Local server, LM Studio) */
export interface ProviderSettings {
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  vision: boolean;
  enabled: boolean;
}

/** Toàn bộ thông tin ngữ cảnh truyện được đưa vào prompt dịch AI */
export interface ProjectContext {
  summary: string;
  notes: string;
  glossary: GlossaryEntry[];
  characters: CharacterProfile[];
  includeInExternalRequests: boolean;
}

export interface ExportRecord {
  id: string;
  createdAt: string;
  folderName: string;
  language: string;
  pageIds: string[];
  status: 'completed' | 'partial' | 'cancelled';
}

export interface ProjectOnboarding {
  completed: boolean;
  skipped: boolean;
  lastStep: number;
}



export interface MangaPage {
  id: string;
  fileName: string;
  sourceUrl: string;
  order: number;
  status: ReviewStatus;
  regions: TextRegion[];
  sourceLanguage?: string | null;
  outputFileName?: string;
  outputTemplate?: string;
  error?: string;
}

export interface MangaProject {
  formatVersion: 1;
  name: string;
  targetLanguage: string;
  sourceLanguage: string | null;
  selectedPageId: string | null;
  pages: MangaPage[];
  updatedAt: string;
  strategy?: TranslationStrategy;
  provider?: ProviderSettings;
  context?: ProjectContext;
  repairJobs?: RepairJob[];
  exports?: ExportRecord[];
  onboarding?: ProjectOnboarding;
  outputTemplate?: string;
}

export function createProject(name = 'Project chưa đặt tên'): MangaProject {
  return {
    formatVersion: 1,
    name,
    targetLanguage: 'vi',
    sourceLanguage: null,
    selectedPageId: null,
    pages: [],
    updatedAt: new Date().toISOString(),
    strategy: 'ask-before-switch',
    provider: { kind: 'custom-openai-compatible', baseUrl: '', model: '', hasApiKey: false, vision: false, enabled: false },
    context: { summary: '', notes: '', glossary: [], characters: [], includeInExternalRequests: false },
    repairJobs: [],
    exports: [],
    onboarding: { completed: false, skipped: false, lastStep: 0 },
  };
}

export function naturalCompare(left: string, right: string): number {
  const tokenize = (value: string) => value.toLocaleLowerCase().split(/(\d+)/).map((part) => {
    const number = Number(part);
    return Number.isNaN(number) ? part : number;
  });
  const a = tokenize(left);
  const b = tokenize(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if (a[index] === undefined) return -1;
    if (b[index] === undefined) return 1;
    if (a[index] === b[index]) continue;
    return a[index]! < b[index]! ? -1 : 1;
  }
  return left.localeCompare(right);
}

export function serializeProject(project: MangaProject): string {
  return JSON.stringify({ ...project, updatedAt: new Date().toISOString() }, null, 2);
}

export function parseProject(raw: string): MangaProject {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('Project không phải JSON hợp lệ.'); }
  if (!parsed || typeof parsed !== 'object') throw new Error('Project không hợp lệ.');
  const project = parsed as Partial<MangaProject>;
  if (project.formatVersion !== 1 || !Array.isArray(project.pages) || typeof project.name !== 'string') {
    throw new Error('Phiên bản project không được hỗ trợ.');
  }
  return {
    ...project,
    strategy: project.strategy ?? 'ask-before-switch',
    provider: project.provider ?? { kind: 'custom-openai-compatible', baseUrl: '', model: '', hasApiKey: false, vision: false, enabled: false },
    context: project.context ?? { summary: '', notes: '', glossary: [], characters: [], includeInExternalRequests: false },
    repairJobs: project.repairJobs ?? [],
    exports: project.exports ?? [],
    onboarding: project.onboarding ?? { completed: false, skipped: false, lastStep: 0 },
  } as MangaProject;
}

export function sanitizeFileName(value: string, fallback = 'project'): string {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').trim();
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned) ? `_${cleaned}` : cleaned;
  return (reserved || fallback).slice(0, 120);
}

export function languageFolderCode(language: string): string {
  const normalized = language.trim().toLowerCase().split('-')[0];
  return normalized || 'und';
}

export function outputFileName(page: MangaPage, index: number, project: MangaProject): string {
  const extension = page.fileName.includes('.') ? page.fileName.split('.').pop()!.toLowerCase() : 'png';
  return `${String(index + 1).padStart(3, '0')}.${sanitizeFileName(extension, 'png')}`;
}
