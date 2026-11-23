import { buildVisionRequest, cacheKey, endpointCapability } from './provider';
import { ProviderResponse, sendChat, RequestOptions } from './providerClient';
import { ProviderSettings } from './model';
import { parseVisionResponse, VisionParseResult } from './visionParser';

export type VisionPageInput = { inputHash: string; imageDataUrl: string; instruction: string; promptRevision: string; parseResponse?: boolean; confidenceThreshold?: number };
export type VisionPageResult = { response: ProviderResponse; parsed?: VisionParseResult; cacheHit: boolean; requestNumber: number; providerKind: ProviderSettings['kind']; model: string };
export type VisionAdapterOptions = { settings: ProviderSettings; apiKey?: string; consentToCloud: boolean; maxCloudRequests?: number; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; maxRetries?: number };
export class VisionPageAdapter {
  private readonly cache = new Map<string, ProviderResponse>();
  private requests = 0;
  constructor(private readonly options: VisionAdapterOptions) {}
  get requestCount(): number { return this.requests; }
  clearCache(): void { this.cache.clear(); }
  async analyzePage(input: VisionPageInput): Promise<VisionPageResult> {
    const settings = this.options.settings; const capability = endpointCapability(settings);
    if (!capability.vision) throw Object.assign(new Error('Provider/model chưa xác minh hỗ trợ vision; không dùng OCR fallback.'), { kind: 'vision-unsupported' });
    if (!input.imageDataUrl.startsWith('data:image/')) throw Object.assign(new Error('Payload ảnh không hợp lệ.'), { kind: 'payload' });
    const key = cacheKey(input.inputHash, settings, input.promptRevision); const cached = this.cache.get(key);
    if (cached) return { response: cached, cacheHit: true, requestNumber: this.requests, providerKind: settings.kind, model: settings.model };
    if (capability.remote && !this.options.consentToCloud) throw Object.assign(new Error('Cần consent trước khi gửi ảnh lên cloud.'), { kind: 'configuration' });
    if (capability.remote && this.options.maxCloudRequests !== undefined && this.requests >= Math.max(0, this.options.maxCloudRequests)) throw Object.assign(new Error('Đã đạt giới hạn request cloud của project.'), { kind: 'rate-limit' });
    const request = buildVisionRequest(settings, input.imageDataUrl, input.instruction);
    const response = await sendChat({ baseUrl: settings.baseUrl, apiKey: this.options.apiKey, request, consentToCloud: this.options.consentToCloud, fetchImpl: this.options.fetchImpl, sleep: this.options.sleep, maxRetries: this.options.maxRetries });
    this.requests += 1; this.cache.set(key, response);
    const parsed = input.parseResponse ? parseVisionResponse(response.choices?.[0]?.message?.content, input.confidenceThreshold) : undefined;
    return { response, parsed, cacheHit: false, requestNumber: this.requests, providerKind: settings.kind, model: settings.model };
  }
}
