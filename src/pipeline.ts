import { MangaPage, RepairJob, ReviewStatus } from './model';

export type PipelineStage = 'queued' | 'vision' | 'translation' | 'layout' | 'needs-review' | 'completed' | 'failed' | 'cancelled';
export type QueueControl = 'running' | 'paused' | 'cancelled' | 'idle';

export interface PageJob { pageId: string; stage: PipelineStage; attempts: number; error?: string; provider?: string; }
export interface PipelineState { control: QueueControl; jobs: PageJob[]; activePageId?: string; }

export function createPipeline(pages: MangaPage[]): PipelineState {
  return { control: 'idle', jobs: pages.map((page) => ({ pageId: page.id, stage: 'queued', attempts: 0 })) };
}

export function startPipeline(state: PipelineState): PipelineState {
  if (state.control === 'cancelled') return state;
  return { ...state, control: 'running' };
}

export function pausePipeline(state: PipelineState): PipelineState { return state.control === 'running' ? { ...state, control: 'paused' } : state; }
export function resumePipeline(state: PipelineState): PipelineState { return state.control === 'paused' ? { ...state, control: 'running' } : state; }
export function cancelPipeline(state: PipelineState): PipelineState { return { ...state, control: 'cancelled', jobs: state.jobs.map((job) => ['completed', 'failed'].includes(job.stage) ? job : { ...job, stage: 'cancelled' }) }; }

export function claimNextPage(state: PipelineState): PipelineState {
  if (state.control !== 'running' || state.activePageId) return state;
  const next = state.jobs.find((job) => job.stage === 'queued' || job.stage === 'failed');
  if (!next) return { ...state, control: 'idle' };
  return { ...state, activePageId: next.pageId, jobs: state.jobs.map((job) => job.pageId === next.pageId ? { ...job, stage: 'vision', attempts: job.attempts + 1, error: undefined } : job) };
}

export function advancePage(state: PipelineState, pageId: string, stage: PipelineStage): PipelineState {
  if (state.activePageId !== pageId) return state;
  const terminal = ['completed', 'failed', 'cancelled'].includes(stage);
  return { ...state, activePageId: terminal ? undefined : pageId, jobs: state.jobs.map((job) => job.pageId === pageId ? { ...job, stage } : job) };
}

export function failPage(state: PipelineState, pageId: string, error: string): PipelineState {
  if (state.activePageId !== pageId) return state;
  return { ...state, activePageId: undefined, jobs: state.jobs.map((job) => job.pageId === pageId ? { ...job, stage: 'failed', error } : job) };
}

export function retryPage(state: PipelineState, pageId: string): PipelineState {
  return { ...state, jobs: state.jobs.map((job) => job.pageId === pageId && job.stage === 'failed' ? { ...job, stage: 'queued', error: undefined } : job) };
}

export function canAutoApprove(status: ReviewStatus, confidence: number | undefined, threshold: number): boolean {
  return status === 'needs-review' && confidence !== undefined && confidence >= threshold;
}

export function queueRepairJob(job: RepairJob, pages: MangaPage[]): RepairJob {
  const page = pages.find((item) => item.id === job.pageId);
  if (!page || !['approved', 'needs-review'].includes(page.status)) return { ...job, status: 'waiting-page' };
  return { ...job, status: 'queued' };
}
