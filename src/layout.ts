import { MangaPage, TextRegion } from './model';
export type LayoutIssueKind = 'overflow' | 'too-small' | 'out-of-bounds' | 'overlap' | 'contrast';
export type LayoutIssue = { kind: LayoutIssueKind; regionId: string; message: string; severity: 'warning' | 'error' };
export function diagnoseLayout(page: MangaPage): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  for (const region of page.regions) {
    if (region.x < 0 || region.y < 0 || region.x + region.width > 100 || region.y + region.height > 100) issues.push({ kind: 'out-of-bounds', regionId: region.id, message: 'Vùng vượt khỏi biên ảnh.', severity: 'error' });
    if ((region.fontSize ?? 24) < 12) issues.push({ kind: 'too-small', regionId: region.id, message: 'Cỡ chữ có thể quá nhỏ để đọc.', severity: 'warning' });
    if (region.translation.length > Math.max(20, region.width * region.height * 0.12)) issues.push({ kind: 'overflow', regionId: region.id, message: 'Bản dịch có nguy cơ tràn vùng; cần kiểm tra preview.', severity: 'warning' });
    if ((region.textColor ?? '#111827').toLowerCase() === (region.outlineColor ?? '#ffffff').toLowerCase()) issues.push({ kind: 'contrast', regionId: region.id, message: 'Màu chữ và viền giống nhau, tương phản kém.', severity: 'warning' });
  }
  for (let i = 0; i < page.regions.length; i += 1) for (let j = i + 1; j < page.regions.length; j += 1) { const a = page.regions[i]!; const b = page.regions[j]!; if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) issues.push({ kind: 'overlap', regionId: a.id, message: `Chồng lấn với vùng ${b.id.slice(-6)}.`, severity: 'warning' }); }
  return issues;
}
