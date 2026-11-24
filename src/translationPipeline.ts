/**
 * ============================================================================
 * Translation Pipeline (Giai đoạn 2: Contextual Translation & Normalization)
 * ----------------------------------------------------------------------------
 * Nhiệm vụ:
 * 1. Thu thập toàn bộ vùng thoại cần dịch của từng trang (bỏ qua vùng đã approved).
 * 2. Đưa Context (tóm tắt cốt truyện, ghi chú, glossary, hồ sơ nhân vật) vào prompt dịch.
 * 3. Gửi yêu cầu dịch qua ProviderClient (hỗ trợ OpenAI-compatible, 9Router, local server).
 * 4. Parse phản hồi JSON an toàn (chịu được markdown code fence ```json).
 * 5. Cập nhật câu dịch vào `region.translation` và chẩn đoán tràn khung (diagnoseLayout).
 * ============================================================================
 */
import { MangaPage, MangaProject, TextRegion } from './model';
import { ProviderSettings } from './model';
import { sendChat, ProviderResponse } from './providerClient';
import { diagnoseLayout } from './layout';

export type TranslationRequestPayload = {
  targetLanguage: string;
  sourceLanguage?: string | null;
  regions: Array<{ id: string; sourceText: string; kind?: string }>;
  glossary?: Array<{ source: string; target: string }>;
  characters?: Array<{ name: string; pronouns?: string; speechStyle?: string }>;
  contextSummary?: string;
  notes?: string;
};

export function buildTranslationPrompt(payload: TranslationRequestPayload): string {
  const parts: string[] = [];
  parts.push(`You are an expert manga localizer. Translate the text into "${payload.targetLanguage}".`);
  if (payload.sourceLanguage) {
    parts.push(`Source language: "${payload.sourceLanguage}".`);
  }
  if (payload.glossary && payload.glossary.length > 0) {
    parts.push('Glossary:');
    payload.glossary.forEach((item) => parts.push(`- "${item.source}" => "${item.target}"`));
  }
  if (payload.characters && payload.characters.length > 0) {
    parts.push('Characters:');
    payload.characters.forEach((char) => parts.push(`- ${char.name} (${char.pronouns || 'default'}): ${char.speechStyle || 'natural'}`));
  }
  if (payload.contextSummary) parts.push(`Context: ${payload.contextSummary}`);
  if (payload.notes) parts.push(`Notes: ${payload.notes}`);

  parts.push('Respond ONLY with JSON: {"translations": [{"id": "...", "translation": "..."}]}');
  parts.push(JSON.stringify(payload.regions));
  return parts.join('\n\n');
}

export function parseTranslationResponse(content: unknown): { translations: Record<string, string> } {
  let decoded: unknown = content;
  if (typeof content === 'string') {
    let cleaned = content.trim();
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
      throw new Error('Translation response không phải JSON hợp lệ.');
    }
  }
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error('Translation response không phải object JSON.');
  }
  const root = decoded as Record<string, unknown>;
  const list = root.translations;
  if (!Array.isArray(list)) throw new Error('Translation response thiếu mảng translations.');

  const map: Record<string, string> = {};
  for (const item of list) {
    if (item && typeof item === 'object') {
      const id = String((item as Record<string, unknown>).id || '');
      const translation = String((item as Record<string, unknown>).translation || '');
      if (id) map[id] = translation;
    }
  }
  return { translations: map };
}

export type TranslationPipelineOptions = {
  settings: ProviderSettings;
  apiKey?: string;
  consentToCloud: boolean;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  onProgress?: (info: { pageIndex: number; totalPages: number; pageName: string; stage: string }) => void;
};

export async function translateProjectPages(
  project: MangaProject,
  options: TranslationPipelineOptions
): Promise<MangaProject> {
  const updatedPages: MangaPage[] = [];
  const enabledGlossary = (project.context?.glossary ?? [])
    .filter((g) => g.enabled)
    .map((g) => ({ source: g.source, target: g.target }));
  const enabledCharacters = (project.context?.characters ?? [])
    .filter((c) => c.enabled)
    .map((c) => ({ name: c.name, pronouns: c.pronouns, speechStyle: c.speechStyle }));
  const includeContext = project.context?.includeInExternalRequests ?? false;

  for (let i = 0; i < project.pages.length; i++) {
    const page = project.pages[i]!;
    options.onProgress?.({ pageIndex: i, totalPages: project.pages.length, pageName: page.fileName, stage: 'translating' });
    const toTranslate = page.regions.filter((r) => r.sourceText.trim() && r.status !== 'approved');
    if (toTranslate.length === 0) {
      updatedPages.push(page);
      continue;
    }

    const payload: TranslationRequestPayload = {
      targetLanguage: project.targetLanguage,
      sourceLanguage: page.sourceLanguage || project.sourceLanguage,
      regions: toTranslate.map((r) => ({ id: r.id, sourceText: r.sourceText, kind: r.kind })),
      glossary: enabledGlossary.length > 0 ? enabledGlossary : undefined,
      characters: enabledCharacters.length > 0 ? enabledCharacters : undefined,
      contextSummary: includeContext ? project.context?.summary : undefined,
      notes: includeContext ? project.context?.notes : undefined,
    };

    try {
      const response: ProviderResponse = await sendChat({
        baseUrl: options.settings.baseUrl,
        apiKey: options.apiKey,
        consentToCloud: options.consentToCloud,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
        request: {
          model: options.settings.model,
          messages: [{ role: 'user', content: buildTranslationPrompt(payload) }],
          temperature: 0.3,
        },
      });
      const parsed = parseTranslationResponse(response.choices?.[0]?.message?.content);
      const mergedRegions: TextRegion[] = page.regions.map((reg) => {
        if (reg.status === 'approved') return reg; // Protect approved
        const trans = parsed.translations[reg.id];
        if (trans !== undefined) return { ...reg, translation: trans, status: 'needs-review' };
        return reg;
      });
      const updatedPage: MangaPage = {
        ...page,
        regions: mergedRegions,
        status: mergedRegions.some((r) => r.status === 'needs-review') ? 'needs-review' : 'approved',
        error: undefined,
      };
      const layoutIssues = diagnoseLayout(updatedPage);
      if (layoutIssues.some((issue) => issue.severity === 'warning')) {
        updatedPage.status = 'needs-review';
      }
      updatedPages.push(updatedPage);
      // Nhường CPU cho UI event loop để giao diện luôn phản hồi
      await new Promise((r) => setTimeout(r, 15));
    } catch (err) {
      updatedPages.push({ ...page, status: 'failed', error: err instanceof Error ? err.message : 'Translation request thất bại.' });
      await new Promise((r) => setTimeout(r, 15));
    }
  }

  return { ...project, pages: updatedPages, updatedAt: new Date().toISOString() };
}

