import { describe, expect, it } from 'vitest';
import { createProject, MangaPage } from './model';
import { advancePage, cancelPipeline, claimNextPage, createPipeline, failPage, pausePipeline, queueRepairJob, retryPage, startPipeline } from './pipeline';

const page = (id: string, status: MangaPage['status'] = 'pending'): MangaPage => ({ id, fileName: `${id}.png`, sourceUrl: '', order: 0, status, regions: [] });

describe('pipeline state machine', () => {
  it('runs one page at a time and retries only failed pages', () => {
    let state = startPipeline(createPipeline([page('a'), page('b')]));
    state = claimNextPage(state);
    expect(state.activePageId).toBe('a');
    expect(claimNextPage(state).activePageId).toBe('a');
    state = advancePage(state, 'a', 'translation');
    state = advancePage(state, 'a', 'completed');
    state = claimNextPage(state);
    expect(state.activePageId).toBe('b');
    state = failPage(state, 'b', 'temporary');
    expect(retryPage(state, 'b').jobs.find((job) => job.pageId === 'b')?.stage).toBe('queued');
  });
  it('pauses and cancels without reviving completed work', () => {
    let state = startPipeline(createPipeline([page('a')]));
    state = pausePipeline(state);
    expect(claimNextPage(state).activePageId).toBeUndefined();
    state = startPipeline(state);
    state = claimNextPage(state);
    state = cancelPipeline(state);
    expect(state.jobs[0]?.stage).toBe('cancelled');
  });
  it('waits repair jobs until the source page is reviewable', () => {
    const job = { id: 'r', pageId: 'a', kind: 'rewrite', prompt: 'shorten', status: 'queued' as const, inputRevision: '1' };
    expect(queueRepairJob(job, [page('a', 'pending')]).status).toBe('waiting-page');
    expect(queueRepairJob(job, [page('a', 'needs-review')]).status).toBe('queued');
  });
});
