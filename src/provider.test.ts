import { describe, expect, it } from 'vitest';
import { buildVisionRequest, classifyProviderError, endpointCapability, isSafeToRetry, shouldFallback } from './provider';

const cloud = { kind: '9router-cloud' as const, baseUrl: 'https://9router.com/v1', model: 'vision-route', hasApiKey: true, vision: true, enabled: true };

describe('provider policy', () => {
  it('classifies errors without hiding auth failures', () => {
    expect(classifyProviderError(401, 'Unauthorized')).toBe('auth');
    expect(classifyProviderError(429, 'quota exceeded')).toBe('rate-limit');
    expect(shouldFallback('auth', 'online-first-local-fallback')).toBe(false);
    expect(shouldFallback('rate-limit', 'online-first-local-fallback')).toBe(true);
  });
  it('distinguishes local and remote endpoints', () => {
    expect(endpointCapability(cloud).remote).toBe(true);
    expect(endpointCapability({ ...cloud, kind: 'lm-studio-local', baseUrl: 'http://127.0.0.1:1234/v1' }).remote).toBe(false);
  });
  it('builds vision payload only for declared vision providers', () => {
    const request = buildVisionRequest(cloud, 'data:image/png;base64,AA==', 'Read this page');
    expect(request.messages[0]?.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'image_url' })]));
    expect(() => buildVisionRequest({ ...cloud, vision: false }, 'data:image/png;base64,AA==', 'x')).toThrow(/vision/);
    expect(isSafeToRetry('auth')).toBe(false);
  });
});
