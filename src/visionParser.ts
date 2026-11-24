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
    let cleaned = raw.trim();
    const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonMatch) {
      cleaned = jsonMatch[1].trim();
    } else {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        cleaned = cleaned.slice(start, end + 1);
      }
    }
    try {
      decoded = JSON.parse(cleaned);
    } catch {
      throw new VisionResponseError('Vision response không phải JSON hợp lệ.');
    }
  }
  const root = objectValue(decoded);
  const list = root.regions;
  if (!Array.isArray(list)) throw new VisionResponseError('Vision response thiếu mảng regions.');

  // Tự động phát hiện nếu model trả về tọa độ dạng pixel (giá trị > 100) thay vì phần trăm 0..100
  const isPixelSpace = list.some((e: any) => {
    return (typeof e?.x === 'number' && e.x > 100) ||
           (typeof e?.y === 'number' && e.y > 100) ||
           (typeof e?.width === 'number' && e.width > 100) ||
           (typeof e?.height === 'number' && e.height > 100);
  });

  let scaleW = 100;
  let scaleH = 100;
  if (isPixelSpace) {
    const maxX = Math.max(...list.map((e: any) => (Number(e?.x) || 0) + (Number(e?.width) || 0)));
    const maxY = Math.max(...list.map((e: any) => (Number(e?.y) || 0) + (Number(e?.height) || 0)));
    scaleW = maxX > 1000 ? Math.max(maxX, 1280) : 1000;
    scaleH = maxY > 1000 ? Math.max(maxY, 1800) : 1000;
  }

  const warnings: string[] = [];
  const regions = list.map((entry, index) => {
    const item = objectValue(entry);
    let x = number(item.x, `regions[${index}].x`);
    let y = number(item.y, `regions[${index}].y`);
    let width = number(item.width, `regions[${index}].width`);
    let height = number(item.height, `regions[${index}].height`);

    if (isPixelSpace) {
      x = (x / scaleW) * 100;
      y = (y / scaleH) * 100;
      width = (width / scaleW) * 100;
      height = (height / scaleH) * 100;
      width = Math.min(width, 100 - x);
      height = Math.min(height, 100 - y);
    } else {
      if (width <= 0 || height <= 0 || x < 0 || y < 0 || x + width > 100 || y + height > 100) {
        throw new VisionResponseError(`Vùng ${index + 1} vượt biên hoặc có kích thước không hợp lệ.`);
      }
    }

    const confidence = item.confidence === undefined ? undefined : number(item.confidence, `regions[${index}].confidence`);
    if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
      throw new VisionResponseError(`Confidence vùng ${index + 1} phải nằm trong 0..1.`);
    }

    const sourceText = text(item.sourceText, `regions[${index}].sourceText`);
    
    // Linh hoạt nhận diện loại vùng (speech, narration, heading, title, sfx, other)
    let kind: TextRegion['kind'] = 'speech';
    if (item.kind !== undefined) {
      const k = String(item.kind).toLowerCase();
      if (['speech', 'narration', 'sound-effect', 'other'].includes(k)) {
        kind = k as TextRegion['kind'];
      } else if (k.includes('head') || k.includes('title')) {
        kind = 'narration';
      } else if (k.includes('sound') || k.includes('sfx')) {
        kind = 'sound-effect';
      } else {
        kind = 'other';
      }
    }

    const status = confidence !== undefined && confidence < confidenceThreshold ? 'needs-review' : 'pending';
    if (status === 'needs-review') warnings.push(`Vùng ${index + 1} có confidence thấp (${confidence}).`);

    return {
      id: typeof item.id === 'string' && item.id ? item.id : `vision-region-${index + 1}`,
      x: clamp(x),
      y: clamp(y),
      width: Math.max(1, width),
      height: Math.max(1, height),
      sourceText,
      translation: '',
      confidence,
      sourceLanguage: typeof item.sourceLanguage === 'string' ? item.sourceLanguage : null,
      kind,
      status,
      fontSize: 24,
      textColor: '#111827',
      outlineColor: '#ffffff',
    } satisfies TextRegion;
  });

  return { regions, warnings };
}
