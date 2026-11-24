import { MangaPage, MangaProject } from './model';
import { VisionPageAdapter } from './visionAdapter';
import { pageRevision } from './repairOps';

/**
 * ============================================================================
 * Vision Pipeline (Giai đoạn 1: Vision OCR & Bounding Box Extraction)
 * ----------------------------------------------------------------------------
 * Nhiệm vụ:
 * 1. Duyệt qua từng trang truyện theo đúng thứ tự (order: 0, 1, 2, ...).
 * 2. Gửi ảnh trang tới Vision Model (9Router hoặc local Qwen2.5-VL).
 * 3. Nhận diện các bong bóng thoại, trích xuất tọa độ bbox [x, y, width, height] và câu tiếng Nhật gốc.
 * 4. Giữ nguyên (không ghi đè) những vùng thoại đã được người dùng duyệt (`status: 'approved'`).
 * 5. Báo cáo tiến độ thời gian thực qua callback `onEvent`.
 * ============================================================================
 */

export type VisionPipelineEvent = {
  pageId: string;
  stage: 'started' | 'completed' | 'needs-review' | 'failed';
  message?: string;
  index: number;
  total: number;
};

export type VisionPipelineResult = {
  project: MangaProject;
  completed: number;
  failed: number;
  events: VisionPipelineEvent[];
};

export async function runVisionPipeline(
  project: MangaProject,
  adapter: VisionPageAdapter,
  onEvent?: (event: VisionPipelineEvent) => void
): Promise<VisionPipelineResult> {
  const events: VisionPipelineEvent[] = [];
  let completed = 0;
  let failed = 0;

  // Sắp xếp các trang theo thứ tự đọc
  const pages = [...project.pages].sort((a, b) => a.order - b.order);
  let next = project;

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]!;
    const started: VisionPipelineEvent = {
      pageId: page.id,
      stage: 'started',
      index,
      total: pages.length,
    };
    events.push(started);
    onEvent?.(started);

    try {
      // Gọi Vision Adapter phân tích trang truyện
      const result = await adapter.analyzePage({
        inputHash: page.sourceUrl,
        imageDataUrl: page.sourceUrl,
        instruction:
          'Analyze this manga page. Detect all speech bubbles and text. Return JSON only in this format: {"regions":[{"id":"r1","x":10,"y":20,"width":30,"height":15,"sourceText":"...","confidence":0.95,"sourceLanguage":"ja","kind":"speech"}]}. Note: Coordinates x, y, width, height must be percentages (0 to 100) of image dimensions.',
        promptRevision: pageRevision(page),
        parseResponse: true,
      });

      if (!result.parsed) throw new Error('Vision response chưa được parse.');
      const parsed = result.parsed;
      const hasLowConfidence = parsed.warnings.length > 0;

      // Hợp nhất các vùng mới nhận diện với các vùng đã duyệt trước đó
      next = {
        ...next,
        pages: next.pages.map((item) => {
          if (item.id !== page.id) return item;
          const existing = new Map(item.regions.map((region) => [region.id, region]));
          const merged = parsed.regions.map((region) => {
            const old = existing.get(region.id);
            // Vùng đã được người dùng duyệt (approved) được bảo vệ tuyệt đối
            return old?.status === 'approved'
              ? old
              : { ...region, translation: old?.translation ?? '' };
          });
          return {
            ...item,
            regions: merged,
            status: hasLowConfidence ? 'needs-review' : 'needs-review',
            error: undefined,
          };
        }),
      };

      completed += 1;
      const event: VisionPipelineEvent = {
        pageId: page.id,
        stage: hasLowConfidence ? 'needs-review' : 'completed',
        index,
        total: pages.length,
        message: hasLowConfidence ? parsed.warnings.join(' ') : undefined,
      };
      events.push(event);
      onEvent?.(event);
      // Nhường CPU cho UI event loop để giao diện luôn mượt mà, không bị Not Responding
      await new Promise((r) => setTimeout(r, 15));
    } catch (error) {
      failed += 1;
      const event: VisionPipelineEvent = {
        pageId: page.id,
        stage: 'failed',
        index,
        total: pages.length,
        message: error instanceof Error ? error.message : 'Vision pipeline thất bại.',
      };
      events.push(event);
      onEvent?.(event);
      next = {
        ...next,
        pages: next.pages.map((item) =>
          item.id === page.id ? { ...item, status: 'failed', error: event.message } : item
        ),
      };
    }
  }

  return { project: next, completed, failed, events };
}

