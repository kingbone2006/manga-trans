import { describe, expect, it } from 'vitest';
import { createProject } from './model';
import { exportablePages, removePage, reorderPages, renameProject, setPageSourceLanguage, templateFileName } from './projectOps';
const page = (id: string, status: 'pending' | 'approved' = 'pending') => ({ id, fileName: `${id}.png`, sourceUrl: '', order: 0, status, regions: [] });
describe('project operations', () => {
  it('renames, reorders and removes pages while preserving selection', () => { const p = { ...createProject(), pages: [page('a'), page('b')], selectedPageId: 'b' }; const renamed = renameProject(p, 'A:/Truyện?'); const moved = reorderPages(renamed, 1, 0); expect(moved.name).toBe('A__Truyện_'); expect(moved.pages.map((x) => x.id)).toEqual(['b', 'a']); expect(removePage(moved, 'b').selectedPageId).toBe('a'); });
  it('renders template variables and source-language override', () => { const p = { ...createProject('Demo'), pages: [page('p', 'approved')] }; const localized = setPageSourceLanguage(p, 'p', 'ja'); expect(localized.pages[0]!.sourceLanguage).toBe('ja'); expect(templateFileName('{page:000}_{source_name}_{lang}.{ext}', localized, localized.pages[0]!, 1)).toBe('002_p_vi.png'); });
  it('separates approved export pages from blocked pages', () => { const p = { ...createProject(), pages: [page('ok', 'approved'), page('wait')] }; expect(exportablePages(p).pages).toHaveLength(1); expect(exportablePages(p).blocked).toHaveLength(1); });
});
