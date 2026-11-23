import { describe, expect, it } from 'vitest';
import { buildExportPlan, uniqueFolderName } from './exportPlan';
import { createProject } from './model';
const page = (id: string, fileName: string, outputFileName?: string) => ({ id, fileName, sourceUrl: '', order: 0, status: 'approved' as const, regions: [], outputFileName });
describe('export planning', () => { it('creates safe suffixed destination names', () => { expect(uniqueFolderName('Tên: truyện', 'pt-BR', ['Tên_ truyện pt'])).toBe('Tên_ truyện pt (2)'); }); it('detects duplicate output names before writing', () => { const p = createProject('Demo'); const plan = buildExportPlan(p, [page('a', 'a.png', 'same.png'), page('b', 'b.png', 'same.png')], []); expect(plan.collisions).toEqual(['same.png']); }); });
