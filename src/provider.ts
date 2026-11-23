import { ProviderKind, ProviderSettings, TranslationStrategy } from './model';

export type ProviderErrorClass = 'auth' | 'policy' | 'rate-limit' | 'temporary' | 'vision-unsupported' | 'payload' | 'timeout-unknown' | 'cancelled' | 'configuration' | 'unknown';
export type ProviderCapability = { remote: boolean; vision: boolean; streaming: boolean; inpainting: boolean; maxContext?: number };

export type ChatRequest = { model: string; messages: Array<{ role: 'system' | 'user' | 'assistant'; content: unknown }>; temperature?: number; stream?: boolean; };

export function classifyProviderError(status: number | undefined, message: string): ProviderErrorClass {
  const text = message.toLowerCase();
  if (status === 401 || status === 403 || text.includes('api key') || text.includes('unauthorized')) return 'auth';
  if (status === 429 || text.includes('rate limit') || text.includes('quota')) return 'rate-limit';
  if (status === 408 || text.includes('timeout')) return 'timeout-unknown';
  if (status === 413 || text.includes('too large') || text.includes('context')) return 'payload';
  if (status === 415 || text.includes('vision') || text.includes('image')) return 'vision-unsupported';
  if (status !== undefined && status >= 500) return 'temporary';
  if (text.includes('policy') || text.includes('content')) return 'policy';
  return 'unknown';
}

export function shouldFallback(kind: ProviderErrorClass, strategy: TranslationStrategy): boolean {
  if (strategy === 'online-only' || strategy === 'local-only') return false;
  return ['rate-limit', 'temporary', 'vision-unsupported', 'payload'].includes(kind);
}

export function endpointCapability(settings: ProviderSettings): ProviderCapability {
  const remote = settings.kind !== 'lm-studio-local' && (settings.kind === '9router-cloud' || (settings.baseUrl.length > 0 && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(settings.baseUrl)));
  return { remote, vision: settings.vision, streaming: true, inpainting: false };
}

export function buildVisionRequest(settings: ProviderSettings, imageDataUrl: string, instruction: string): ChatRequest {
  if (!settings.vision) throw new Error('Provider/model chưa khai báo hỗ trợ vision; không fallback sang OCR.');
  if (!settings.model.trim()) throw new Error('Chưa cấu hình model/route.');
  return { model: settings.model, messages: [{ role: 'user', content: [{ type: 'text', text: instruction }, { type: 'image_url', image_url: { url: imageDataUrl } }] }], temperature: 0.1 };
}

export function cacheKey(inputHash: string, settings: ProviderSettings, promptRevision: string): string {
  return [inputHash, settings.kind, settings.baseUrl, settings.model, settings.vision ? 'vision' : 'text', promptRevision].join('|');
}

export function isSafeToRetry(kind: ProviderErrorClass): boolean { return kind === 'rate-limit' || kind === 'temporary' || kind === 'payload'; }
