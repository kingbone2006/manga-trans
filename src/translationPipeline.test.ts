import { describe, expect, it, vi } from 'vitest';
import { createProject, TextRegion } from './model';
import { buildTranslationPrompt, parseTranslationResponse, translateProjectPages } from './translationPipeline';

describe('translationPipeline', () => {
  it('builds comprehensive translation prompt with context and glossary', () => {
    const prompt = buildTranslationPrompt({
      targetLanguage: 'vi',
      sourceLanguage: 'ja',
      regions: [{ id: 'r1', sourceText: 'こんにちは', kind: 'speech' }],
      glossary: [{ source: 'Sensei', target: 'Thầy' }],
      characters: [{ name: 'Taro', pronouns: 'anh ấy', speechStyle: 'polite' }],
      contextSummary: 'Two students talking in school.',
      notes: 'Keep it casual.',
    });
    expect(prompt).toContain('Translate the text into "vi"');
    expect(prompt).toContain('Source language: "ja"');
    expect(prompt).toContain('"Sensei" => "Thầy"');
    expect(prompt).toContain('Taro (anh ấy): polite');
    expect(prompt).toContain('Context: Two students talking in school.');
    expect(prompt).toContain('こんにちは');
  });

  it('parses valid translation response with or without markdown code fences', () => {
    const rawWithFence = '```json\n{"translations": [{"id": "r1", "translation": "Xin chào"}]}\n```';
    const parsed = parseTranslationResponse(rawWithFence);
    expect(parsed.translations['r1']).toBe('Xin chào');
  });

  it('translates project pages while strictly preserving approved regions', async () => {
    const project = createProject('Test Translation');
    project.targetLanguage = 'vi';
    const approvedRegion: TextRegion = {
      id: 'r_approved',
      x: 0,
      y: 0,
      width: 20,
      height: 20,
      sourceText: 'Stop!',
      translation: 'Dừng lại (Đã duyệt)!',
      status: 'approved',
    };
    const pendingRegion: TextRegion = {
      id: 'r_pending',
      x: 30,
      y: 30,
      width: 20,
      height: 20,
      sourceText: 'Help me!',
      translation: '',
      status: 'pending',
    };

    project.pages = [
      {
        id: 'p1',
        fileName: '01.png',
        sourceUrl: 'data:image/png;base64,abc',
        order: 0,
        status: 'pending',
        regions: [approvedRegion, pendingRegion],
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                translations: [
                  { id: 'r_approved', translation: 'Không nên ghi đè' },
                  { id: 'r_pending', translation: 'Cứu tôi với!' },
                ],
              }),
            },
          },
        ],
      }),
    });

    const result = await translateProjectPages(project, {
      settings: {
        kind: 'custom-openai-compatible',
        baseUrl: 'http://mock-api/v1',
        model: 'test-model',
        hasApiKey: false,
        vision: true,
        enabled: true,
      },
      consentToCloud: true,
      fetchImpl: mockFetch as never,
    });

    const translatedPage = result.pages[0]!;
    const preserved = translatedPage.regions.find((r) => r.id === 'r_approved')!;
    const updated = translatedPage.regions.find((r) => r.id === 'r_pending')!;

    expect(preserved.translation).toBe('Dừng lại (Đã duyệt)!');
    expect(preserved.status).toBe('approved');
    expect(updated.translation).toBe('Cứu tôi với!');
    expect(updated.status).toBe('needs-review');
    expect(translatedPage.status).toBe('needs-review');
  });
});
