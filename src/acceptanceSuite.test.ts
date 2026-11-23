import { describe, expect, it } from 'vitest';
import {
  createProject,
  languageFolderCode,
  naturalCompare,
  outputFileName,
  parseProject,
  sanitizeFileName,
  serializeProject,
} from './model';
import { defaultExportPlan } from './exportPlan';
import { pageRevision, reconcileRepairJob } from './repairOps';
import { classifyProviderError, shouldFallback, cacheKey } from './provider';
import { templateFileName, reorderPages } from './projectOps';

describe('Specification Acceptance Test Cases (PROMPT_AI_MANGA_TRANSLATOR Table 9)', () => {
  it('TC-PROJ-01: saves and restores project state faithfully in .mangatrans format', () => {
    const proj = createProject('Truyện Test');
    proj.targetLanguage = 'vi';
    proj.pages = [
      {
        id: 'p1',
        fileName: '01.png',
        sourceUrl: 'data:image/png;base64,sample',
        order: 0,
        status: 'needs-review',
        regions: [
          {
            id: 'r1',
            x: 10,
            y: 10,
            width: 30,
            height: 20,
            sourceText: 'Hello',
            translation: 'Xin chào',
            status: 'approved',
          },
        ],
      },
    ];
    const serialized = serializeProject(proj);
    const parsed = parseProject(serialized);
    expect(parsed.name).toBe('Truyện Test');
    expect(parsed.pages.length).toBe(1);
    expect(parsed.pages[0]!.regions[0]!.translation).toBe('Xin chào');
    expect(parsed.pages[0]!.regions[0]!.status).toBe('approved');
  });

  it('TC-LANG-01 & TC-EXPORT-DEST-01: resolves target language folder code correctly', () => {
    expect(languageFolderCode('vi')).toBe('vi');
    expect(languageFolderCode('en')).toBe('en');
    expect(languageFolderCode('ja')).toBe('ja');
    expect(languageFolderCode('pt-BR')).toBe('pt');
    expect(languageFolderCode('yue')).toBe('yue');
  });

  it('TC-ORDER-01: naturally sorts numbered page names correctly (10 comes after 2)', () => {
    const files = ['10.jpg', '01.jpg', '2.jpg', '001.jpg', '1.jpg'];
    files.sort(naturalCompare);
    expect(files.indexOf('2.jpg')).toBeLessThan(files.indexOf('10.jpg'));
    expect(files.indexOf('001.jpg')).toBeLessThan(files.indexOf('2.jpg'));
    expect(files.indexOf('01.jpg')).toBeLessThan(files.indexOf('2.jpg'));
    expect(files.indexOf('1.jpg')).toBeLessThan(files.indexOf('2.jpg'));
  });

  it('TC-NAME-01: formats output file template with variables and padding', () => {
    const proj = createProject('MyManga');
    const page = { id: 'p1', fileName: 'raw_01.png', sourceUrl: '', order: 0, status: 'pending' as const, regions: [] };
    const name1 = templateFileName('{page:000}.{ext}', proj, page, 0);
    expect(name1).toBe('001.png');

    const name2 = templateFileName('{project}_p{page:00}.{ext}', proj, page, 0);
    expect(name2).toBe('MyManga_p01.png');
  });

  it('TC-REPAIR-RACE-01: detects conflict when page was modified after repair job creation', () => {
    const page = {
      id: 'p1',
      fileName: '01.png',
      sourceUrl: '',
      order: 0,
      status: 'pending' as const,
      regions: [{ id: 'r1', x: 0, y: 0, width: 10, height: 10, sourceText: 'A', translation: 'B', status: 'pending' as const }],
    };
    const rev1 = pageRevision(page);
    const job = {
      id: 'j1',
      pageId: 'p1',
      kind: 'overflow',
      prompt: 'Shorten text',
      status: 'queued' as const,
      inputRevision: rev1,
    };

    // No edit -> reconciliation succeeds
    expect(reconcileRepairJob(job, page).status).toBe('queued');

    // Page modified in parallel
    const modifiedPage = {
      ...page,
      regions: [{ ...page.regions[0]!, translation: 'User edited manually' }],
    };
    const reconciled = reconcileRepairJob(job, modifiedPage);
    expect(reconciled.status).toBe('failed');
    expect(reconciled.error).toContain('Trang đã thay đổi');
  });

  it('TC-FALLBACK-GUARD-01: never auto-fallbacks on authentication errors or policy rejections', () => {
    expect(shouldFallback('auth', 'online-first-local-fallback')).toBe(false);
    expect(shouldFallback('policy', 'online-first-local-fallback')).toBe(false);
    expect(shouldFallback('cancelled', 'online-first-local-fallback')).toBe(false);
    expect(shouldFallback('configuration', 'online-first-local-fallback')).toBe(false);

    // Only technical retryable/fallback errors trigger local fallback
    expect(shouldFallback('rate-limit', 'online-first-local-fallback')).toBe(true);
    expect(shouldFallback('temporary', 'online-first-local-fallback')).toBe(true);
    expect(shouldFallback('vision-unsupported', 'online-first-local-fallback')).toBe(true);
    expect(shouldFallback('payload', 'online-first-local-fallback')).toBe(true);
  });

  it('TC-CLOUD-CACHE-01: builds unique deterministic cache key to avoid duplicate cloud requests', () => {
    const settings = {
      kind: '9router-cloud' as const,
      baseUrl: 'https://api.9router.com/v1',
      model: 'qwen-vl',
      hasApiKey: true,
      vision: true,
      enabled: true,
    };
    const key1 = cacheKey('hash123', settings, 'rev1');
    const key2 = cacheKey('hash123', settings, 'rev1');
    const key3 = cacheKey('hash123', settings, 'rev2');
    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it('TC-EXPORT-STATE-01 & TC-EXPORT-DEST-01: export plan sanitizes windows reserved chars and generates unique target folder', () => {
    const proj = createProject('Truyện: Siêu Cấp? / Test*');
    proj.targetLanguage = 'vi';
    proj.pages = [
      {
        id: 'p1',
        fileName: '01.png',
        sourceUrl: '',
        order: 0,
        status: 'approved',
        regions: [{ id: 'r1', x: 0, y: 0, width: 10, height: 10, sourceText: 'a', translation: 'b', status: 'approved' }],
      },
    ];

    const plan1 = defaultExportPlan(proj, []);
    expect(plan1.folderName).toBe('Truyện_ Siêu Cấp_ _ Test_ vi');

    // Re-export when folder already exists -> increments suffix
    const plan2 = defaultExportPlan(proj, ['Truyện_ Siêu Cấp_ _ Test_ vi']);
    expect(plan2.folderName).toBe('Truyện_ Siêu Cấp_ _ Test_ vi (2)');
  });
});
