import { describe, expect, it, vi } from 'vitest';
import { sendChat } from './providerClient';

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
});
