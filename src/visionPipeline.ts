import { MangaPage, MangaProject } from './model';
import { VisionPageAdapter } from './visionAdapter';
import { pageRevision } from './repairOps';

export type VisionPipelineEvent = { pageId: string; stage: 'started' | 'completed' | 'needs-review' | 'failed'; message?: string; index: number; total: number };
export type VisionPipelineResult = { project: MangaProject; completed: number; failed: number; events: VisionPipelineEvent[] };

export async function runVisionPipeline(project: MangaProject, adapter: VisionPageAdapter, onEvent?: (event: VisionPipelineEvent) => void): Promise<VisionPipelineResult> {
  const events: VisionPipelineEvent[] = []; let completed = 0; let failed = 0;
  const pages = [...project.pages].sort((a, b) => a.order - b.order);
  let next = project;
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]!; const started = { pageId: page.id, stage: 'started' as const, index, total: pages.length }; events.push(started); onEvent?.(started);
    try {
      const result = await adapter.analyzePage({ inputHash: page.sourceUrl, imageDataUrl: page.sourceUrl, instruction: 'Analyze this manga page. Return JSON only: {"regions":[{"id":"stable-id","x":0,"y":0,"width":10,"height":10,"sourceText":"","confidence":0,"sourceLanguage":"","kind":"speech"}]}', promptRevision: pageRevision(page), parseResponse: true });
      if (!result.parsed) throw new Error('Vision response chưa được parse.');
      const parsed = result.parsed; const hasLowConfidence = parsed.warnings.length > 0;
      next = { ...next, pages: next.pages.map((item) => { if (item.id !== page.id) return item; const existing = new Map(item.regions.map((region) => [region.id, region])); const merged = parsed.regions.map((region) => { const old = existing.get(region.id); return old?.status === 'approved' ? old : { ...region, translation: old?.translation ?? '' }; }); return { ...item, regions: merged, status: hasLowConfidence ? 'needs-review' : 'needs-review', error: undefined }; }) };
      completed += 1; const event = { pageId: page.id, stage: hasLowConfidence ? 'needs-review' as const : 'completed' as const, index, total: pages.length, message: hasLowConfidence ? parsed.warnings.join(' ') : undefined }; events.push(event); onEvent?.(event);
    } catch (error) { failed += 1; const event = { pageId: page.id, stage: 'failed' as const, index, total: pages.length, message: error instanceof Error ? error.message : 'Vision pipeline thất bại.' }; events.push(event); onEvent?.(event); next = { ...next, pages: next.pages.map((item) => item.id === page.id ? { ...item, status: 'failed', error: event.message } : item) }; }
  }
  return { project: next, completed, failed, events };
}
