import { describe, expect, it } from 'vitest';
import { diagnoseLayout } from './layout';
const base = (id: string, x: number, y: number) => ({ id, x, y, width: 10, height: 10, sourceText: '', translation: 'Một câu dịch rất dài để kiểm tra nguy cơ tràn vùng', status: 'needs-review' as const, fontSize: 10, textColor: '#fff', outlineColor: '#fff' });
describe('layout diagnostics', () => { it('reports bounds, small text, overflow, contrast and overlap', () => { const issues = diagnoseLayout({ id: 'p', fileName: 'p.png', sourceUrl: '', order: 0, status: 'needs-review', regions: [base('a', 80, 90), base('b', 85, 92)] }); expect(issues.map((x) => x.kind)).toEqual(expect.arrayContaining(['out-of-bounds', 'too-small', 'overflow', 'contrast', 'overlap'])); }); });
