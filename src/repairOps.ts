import { MangaPage, RepairJob } from './model';
export function pageRevision(page: MangaPage): string { return `${page.id}:${page.regions.map((region) => `${region.id}:${region.sourceText}:${region.translation}:${region.status}`).join('|')}`; }
export function reconcileRepairJob(job: RepairJob, page: MangaPage): RepairJob { return job.inputRevision === pageRevision(page) ? job : { ...job, status: 'failed', error: 'Trang đã thay đổi sau khi job được tạo; cần tạo lại hoặc xác nhận rebase.' }; }
export function startRepairJob(job: RepairJob, page: MangaPage): RepairJob { const reconciled = reconcileRepairJob(job, page); return reconciled.status === 'failed' ? reconciled : { ...reconciled, status: 'running' }; }
export function completeRepairJob(job: RepairJob): RepairJob { return job.status === 'running' ? { ...job, status: 'needs-review' } : job; }
export function retryRepairJob(job: RepairJob): RepairJob { return ['failed', 'cancelled'].includes(job.status) ? { ...job, status: 'queued', error: undefined } : job; }
export function cancelRepairJob(job: RepairJob): RepairJob { return ['queued', 'waiting-page', 'failed'].includes(job.status) ? { ...job, status: 'cancelled' } : job; }
export function prioritizeRepairJob(jobs: RepairJob[], jobId: string): RepairJob[] { const index = jobs.findIndex((job) => job.id === jobId); if (index <= 0) return jobs; const copy = [...jobs]; const [job] = copy.splice(index, 1); copy.unshift(job!); return copy; }
