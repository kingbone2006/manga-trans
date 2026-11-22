export type ReviewStatus = 'pending' | 'in-progress' | 'needs-review' | 'approved' | 'failed';

export interface TextRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceText: string;
  translation: string;
  confidence?: number;
  status: ReviewStatus;
  fontSize?: number;
  textColor?: string;
  outlineColor?: string;
}

export interface MangaPage {
  id: string;
  fileName: string;
  sourceUrl: string;
  order: number;
  status: ReviewStatus;
  regions: TextRegion[];
}

export interface MangaProject {
  formatVersion: 1;
  name: string;
  targetLanguage: string;
  sourceLanguage: string | null;
  selectedPageId: string | null;
  pages: MangaPage[];
  updatedAt: string;
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
  return 0;
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
  return project as MangaProject;
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
