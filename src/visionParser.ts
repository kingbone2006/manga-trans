import { TextRegion } from './model';

export type VisionRegionCandidate = { id?: string; x: number; y: number; width: number; height: number; sourceText: string; confidence?: number; sourceLanguage?: string | null; kind?: 'speech' | 'narration' | 'sound-effect' | 'other'; };
export type VisionParseResult = { regions: TextRegion[]; warnings: string[] };
export class VisionResponseError extends Error { readonly kind = 'vision-unsupported'; }

function objectValue(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new VisionResponseError('Vision response không phải object.'); return value as Record<string, unknown>; }
function number(value: unknown, field: string): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new VisionResponseError(`Vision response thiếu ${field} hợp lệ.`); return value; }
function text(value: unknown, field: string): string { if (typeof value !== 'string') throw new VisionResponseError(`Vision response thiếu ${field}.`); return value; }
function clamp(value: number): number { return Math.max(0, Math.min(100, value)); }

export function parseVisionResponse(raw: unknown, confidenceThreshold = 0.7): VisionParseResult {
  let decoded: unknown = raw;
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    try { decoded = JSON.parse(cleaned); } catch { throw new VisionResponseError('Vision response không phải JSON hợp lệ.'); }
  }
  const root = objectValue(decoded); const list = root.regions;
  if (!Array.isArray(list)) throw new VisionResponseError('Vision response thiếu mảng regions.');
  const warnings: string[] = [];
  const regions = list.map((entry, index) => { const item = objectValue(entry); const x = number(item.x, `regions[${index}].x`); const y = number(item.y, `regions[${index}].y`); const width = number(item.width, `regions[${index}].width`); const height = number(item.height, `regions[${index}].height`); if (width <= 0 || height <= 0 || x < 0 || y < 0 || x + width > 100 || y + height > 100) throw new VisionResponseError(`Vùng ${index + 1} vượt biên hoặc có kích thước không hợp lệ.`); const confidence = item.confidence === undefined ? undefined : number(item.confidence, `regions[${index}].confidence`); if (confidence !== undefined && (confidence < 0 || confidence > 1)) throw new VisionResponseError(`Confidence vùng ${index + 1} phải nằm trong 0..1.`); const sourceText = text(item.sourceText, `regions[${index}].sourceText`); const kind = item.kind === undefined ? undefined : (['speech', 'narration', 'sound-effect', 'other'].includes(String(item.kind)) ? item.kind as TextRegion['kind'] : (() => { throw new VisionResponseError(`Loại vùng ${index + 1} không hợp lệ.`); })()); const status = confidence !== undefined && confidence < confidenceThreshold ? 'needs-review' : 'pending'; if (status === 'needs-review') warnings.push(`Vùng ${index + 1} có confidence thấp (${confidence}).`); return { id: typeof item.id === 'string' && item.id ? item.id : `vision-region-${index + 1}`, x: clamp(x), y: clamp(y), width, height, sourceText, translation: '', confidence, sourceLanguage: typeof item.sourceLanguage === 'string' ? item.sourceLanguage : null, kind, status, fontSize: 24, textColor: '#111827', outlineColor: '#ffffff' } satisfies TextRegion; });
  return { regions, warnings };
}
