import { ChatRequest, ProviderErrorClass, classifyProviderError } from './provider';

export type ProviderResponse = { id?: string; choices?: Array<{ message?: { content?: unknown } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
export type RequestOptions = { baseUrl: string; apiKey?: string; request: ChatRequest; consentToCloud: boolean; timeoutMs?: number; maxRetries?: number; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; };
export type ClientFailure = Error & { kind: ProviderErrorClass; attempts: number; retryAfterMs?: number; };

function failure(message: string, kind: ProviderErrorClass, attempts: number, retryAfterMs?: number): ClientFailure { const error = new Error(message) as ClientFailure; error.kind = kind; error.attempts = attempts; error.retryAfterMs = retryAfterMs; return error; }
function retryAfterMs(response: Response): number | undefined { const value = response.headers.get('retry-after'); if (!value) return undefined; const seconds = Number(value); if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 120_000); const date = Date.parse(value); return Number.isFinite(date) ? Math.max(0, Math.min(date - Date.now(), 120_000)) : undefined; }

export async function sendChat(options: RequestOptions): Promise<ProviderResponse> {
  if (!options.baseUrl.trim()) throw failure('Chưa cấu hình base URL.', 'configuration', 0);
  if (!options.request.model.trim()) throw failure('Chưa cấu hình model/route.', 'configuration', 0);
  if (!options.consentToCloud && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?/i.test(options.baseUrl)) throw failure('Cần xác nhận trước khi gửi dữ liệu lên cloud.', 'configuration', 0);
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxRetries = Math.max(0, Math.min(options.maxRetries ?? 2, 5));
  const timeoutMs = Math.max(1000, Math.min(options.timeoutMs ?? 60_000, 300_000));
  const endpoint = `${options.baseUrl.replace(/\/$/, '')}/chat/completions`;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}) }, body: JSON.stringify(options.request) });
      clearTimeout(timeout);
      if (response.ok) return await response.json() as ProviderResponse;
      const retryMs = retryAfterMs(response); const body = await response.text(); const kind = classifyProviderError(response.status, body);
      if (attempt < maxRetries && (kind === 'rate-limit' || kind === 'temporary' || kind === 'payload')) { await sleep(retryMs ?? Math.min(1000 * 2 ** attempt, 10_000)); continue; }
      throw failure(`Provider trả lỗi HTTP ${response.status}.`, kind, attempt + 1, retryMs);
    } catch (error) {
      clearTimeout(timeout);
      if ((error as ClientFailure).kind) throw error;
      const kind: ProviderErrorClass = (error as DOMException).name === 'AbortError' ? 'timeout-unknown' : 'temporary';
      if (attempt < maxRetries && kind === 'temporary') { await sleep(Math.min(1000 * 2 ** attempt, 10_000)); continue; }
      throw failure(kind === 'timeout-unknown' ? 'Timeout: provider có thể đã nhận request; không retry mù quáng.' : 'Không thể kết nối provider.', kind, attempt + 1);
    }
  }
  throw failure('Provider thất bại sau số lần thử cho phép.', 'unknown', maxRetries + 1);
}
