import { describe, expect, it } from 'vitest';
import { createProject, languageFolderCode, naturalCompare, outputFileName, parseProject, sanitizeFileName, serializeProject } from './model';

describe('project model', () => {
  it('sorts padded page names naturally', () => {
    expect(['10.jpg', '2.jpg', '001.jpg', '1.jpg'].sort(naturalCompare)).toEqual([
      '001.jpg', '1.jpg', '2.jpg', '10.jpg',
    ]);
  });

  it('round-trips a versioned project', () => {
    const project = createProject('Demo');
    project.pages.push({ id: 'page-1', fileName: '01.png', sourceUrl: 'data:image/png;base64,AA==', order: 0, status: 'pending', regions: [] });
    const restored = parseProject(serializeProject(project));
    expect(restored.name).toBe('Demo');
    expect(restored.pages[0]?.fileName).toBe('01.png');
  });

  it('rejects unsupported project data', () => {
    expect(() => parseProject('{"formatVersion": 2, "name": "x", "pages": []}')).toThrow();
  });

  it('sanitizes Windows names and language codes', () => {
    expect(sanitizeFileName('CON: chapter?.png')).toBe('CON_ chapter_.png');
    expect(languageFolderCode('pt-BR')).toBe('pt');
    const project = createProject('Demo');
    expect(outputFileName({ id: 'p', fileName: 'page.webp', sourceUrl: '', order: 0, status: 'pending', regions: [] }, 1, project)).toBe('002.webp');
  });
});
