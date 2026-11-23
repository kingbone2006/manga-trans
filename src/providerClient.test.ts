import { describe, expect, it, vi } from 'vitest';
import { checkConnection, sendChat } from './providerClient';

const request = { model: 'mock', messages: [{ role: 'user' as const, content: 'hello' }] };

describe('OpenAI-compatible client', () => {
  it('requires cloud consent and never sends before it is granted', async () => {
    const fetchImpl = vi.fn();
    await expect(sendChat({ baseUrl: 'https://cloud.example/v1', request, consentToCloud: false, fetchImpl })).rejects.toMatchObject({ kind: 'configuration' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('honors Retry-After and retries only bounded technical errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response('busy', { status: 429, headers: { 'Retry-After': '0' } })).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ok' }), { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(sendChat({ baseUrl: 'http://127.0.0.1:1234/v1', request, consentToCloud: false, fetchImpl, sleep })).resolves.toMatchObject({ id: 'ok' });
    expect(fetchImpl).toHaveBeenCalledTimes(2); expect(sleep).toHaveBeenCalled();
  });
  it('does not retry authentication errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }));
    await expect(sendChat({ baseUrl: 'http://127.0.0.1:1234/v1', request, consentToCloud: false, fetchImpl })).rejects.toMatchObject({ kind: 'auth', attempts: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('checks connection with a text-only request and no image payload', async () => { const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'mock-model' }), { status: 200 })); await expect(checkConnection({ baseUrl: 'http://127.0.0.1:1234/v1', model: 'mock', consentToCloud: false, fetchImpl })).resolves.toMatchObject({ ok: true }); const body = JSON.parse(fetchImpl.mock.calls[0]![1].body as string); expect(body.messages[0].content).toBe('Reply with OK only.'); });
  it('fetches provider models and identifies vision capabilities', async () => {
    const mockJson = {
      data: [
        { id: 'openai/gpt-4o' },
        { id: 'google/gemini-2.5-flash' },
        { id: 'meta/llama-3.1-8b-instruct' },
        { id: 'C:\\models\\Qwen2.5-VL-7B.gguf' },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(mockJson), { status: 200 }));
    const { fetchProviderModels } = await import('./providerClient');
    const models = await fetchProviderModels('https://api.9router.com/v1', 'secret-key', fetchImpl);
    expect(models).toHaveLength(4);
    expect(models[0]).toEqual({ id: 'openai/gpt-4o', name: 'openai/gpt-4o', vision: true });
    expect(models[1]).toEqual({ id: 'google/gemini-2.5-flash', name: 'google/gemini-2.5-flash', vision: true });
    expect(models[2]).toEqual({ id: 'meta/llama-3.1-8b-instruct', name: 'meta/llama-3.1-8b-instruct', vision: false });
    expect(models[3]).toEqual({ id: 'C:\\models\\Qwen2.5-VL-7B.gguf', name: 'Qwen2.5-VL-7B.gguf', vision: true });
  });

  it('checks live provider status with latency calculation', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const { checkProviderLiveStatus } = await import('./providerClient');
    const status = await checkProviderLiveStatus('http://127.0.0.1:8080/v1', 'Qwen', '', fetchImpl);
    expect(status.connected).toBe(true);
    expect(typeof status.latencyMs).toBe('number');
  });

});
