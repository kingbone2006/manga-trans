import { describe, expect, it } from 'vitest';
import { parseVisionResponse, VisionResponseError } from './visionParser';
describe('vision response parser', () => {
  it('validates regions and marks low confidence for review', () => { const result = parseVisionResponse({ regions: [{ id: 'a', x: 1, y: 2, width: 30, height: 20, sourceText: 'こんにちは', confidence: 0.4, sourceLanguage: 'ja' }] }); expect(result.regions[0]).toMatchObject({ sourceText: 'こんにちは', sourceLanguage: 'ja', status: 'needs-review' }); expect(result.warnings).toHaveLength(1); });
  it('accepts JSON strings and rejects invalid bounds/schema', () => {
    expect(parseVisionResponse('{"regions":[]}').regions).toEqual([]);
    expect(parseVisionResponse('```json\n{"regions":[]}\n```').regions).toEqual([]);
    expect(() => parseVisionResponse({ regions: [{ x: 90, y: 0, width: 20, height: 5, sourceText: 'x' }] })).toThrow(VisionResponseError);
    expect(() => parseVisionResponse({ items: [] })).toThrow(/regions/);
  });
  it('rejects invalid confidence and does not silently repair malformed output', () => { expect(() => parseVisionResponse({ regions: [{ x: 0, y: 0, width: 10, height: 10, sourceText: 'x', confidence: 2 }] })).toThrow(/Confidence/); expect(() => parseVisionResponse('not json')).toThrow(VisionResponseError); });
});
