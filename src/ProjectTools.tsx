import { useState } from 'react';
import { RepairPanel } from './RepairPanel';
import { MangaPage, MangaProject, RepairJob, createProject } from './model';
import { pageRevision } from './repairOps';
import {
  PipelineState,
  advancePage,
  cancelPipeline,
  claimNextPage,
  createPipeline,
  pausePipeline,
  retryPage,
  startPipeline,
} from './pipeline';

/**
 * ============================================================================
 * ProjectTools Modal
 * ----------------------------------------------------------------------------
 * Quản lý công cụ chuyên sâu cho dự án dịch truyện:
 * 1. Ngữ cảnh (Context): Tóm tắt cốt truyện, ghi chú, bảng thuật ngữ (Glossary), hồ sơ nhân vật.
 * 2. Hàng chờ sửa (Repair Queue): Sửa các lỗi bong bóng (tràn khung, đọc sai, lệch thứ tự, giọng điệu).
 * 3. Mô phỏng xử lý hàng loạt (Batch Pipeline Simulation).
 * ============================================================================
 */
export function ProjectTools({
  project,
  page,
  edit,
  close,
}: {
  project: MangaProject;
  page: MangaPage | null;
  edit: (fn: (value: MangaProject) => MangaProject) => void;
  close: () => void;
}) {
  const [tab, setTab] = useState<'context' | 'repairs' | 'batch'>('context');
  const [prompt, setPrompt] = useState('');
  const [pipe, setPipe] = useState<PipelineState>(() => createPipeline(project.pages));

  const context = project.context ?? createProject().context!;
  const jobs = project.repairJobs ?? [];

  // Cập nhật một phần của Project Context
  const updateContext = (patch: Partial<typeof context>) =>
    edit((v) => ({ ...v, context: { ...context, ...patch } }));

  // Thêm một tác vụ sửa lỗi (repair job) vào hàng chờ
  const addJob = (kind: string, text: string) => {
    if (!page) return;
    const job: RepairJob = {
      id: crypto.randomUUID(),
      pageId: page.id,
      regionId: page.regions[0]?.id,
      kind,
      prompt: text,
      status: 'queued',
      inputRevision: pageRevision(page),
    };
    edit((v) => ({ ...v, repairJobs: [...(v.repairJobs ?? []), job] }));
    setPrompt('');
  };

  // Bước tiếp theo trong mock pipeline
  const step = () => {
    let next = pipe;
    if (next.control === 'idle') next = startPipeline(next);
    if (next.control === 'running' && !next.activePageId) next = claimNextPage(next);
    if (next.activePageId) {
      const current = next.jobs.find((j) => j.pageId === next.activePageId)?.stage;
      const stages = ['vision', 'translation', 'layout', 'needs-review', 'completed'] as const;
      const i = Math.max(0, stages.indexOf(current as (typeof stages)[number]));
      next = advancePage(next, next.activePageId, stages[Math.min(i + 1, stages.length - 1)]!);
    }
    setPipe(next);
  };

  return (
    <div className="modal-backdrop">
      <section className="settings-modal tools-modal">
        {/* Tiêu đề & Nút đóng */}
        <div className="inspector-tabs">
          <b>Công cụ quản lý dự án (Project Tools)</b>
          <button onClick={close} title="Đóng cửa sổ">
            ✕
          </button>
        </div>

        {/* Tab chuyển đổi */}
        <div className="tool-tabs">
          <button
            className={tab === 'context' ? 'active-tab' : ''}
            onClick={() => setTab('context')}
          >
            Ngữ cảnh & Nhân vật
          </button>
          <button
            className={tab === 'repairs' ? 'active-tab' : ''}
            onClick={() => setTab('repairs')}
          >
            Hàng chờ sửa ({jobs.length})
          </button>
          <button className={tab === 'batch' ? 'active-tab' : ''} onClick={() => setTab('batch')}>
            Mô phỏng Pipeline
          </button>
        </div>

        {/* Nội dung Tab */}
        {tab === 'context' && <ContextPanel context={context} update={updateContext} />}
        {tab === 'repairs' && (
          <RepairPanel
            page={page}
            jobs={jobs}
            prompt={prompt}
            setPrompt={setPrompt}
            addJob={addJob}
            edit={edit}
          />
        )}
        {tab === 'batch' && (
          <BatchPanel project={project} pipe={pipe} step={step} setPipe={setPipe} />
        )}
      </section>
    </div>
  );
}

/**
 * ============================================================================
 * ContextPanel
 * ----------------------------------------------------------------------------
 * Quản lý ngữ cảnh cốt truyện, thuật ngữ dịch đồng bộ (Glossary) và tính cách nhân vật.
 * Các thông tin này sẽ được tự động đưa vào prompt dịch AI để câu dịch thống nhất.
 * ============================================================================
 */
function ContextPanel({
  context,
  update,
}: {
  context: NonNullable<MangaProject['context']>;
  update: (patch: Partial<NonNullable<MangaProject['context']>>) => void;
}) {
  return (
    <div className="editor-form">
      <label>
        Tóm tắt cốt truyện (Synopsis)
        <textarea
          rows={3}
          placeholder="Tóm tắt ngắn nội dung bộ truyện để AI dịch sát ngữ cảnh..."
          value={context.summary}
          onChange={(e) => update({ summary: e.target.value })}
        />
      </label>

      <label>
        Ghi chú dịch thuật (Notes)
        <textarea
          rows={2}
          placeholder="Ghi chú về văn phong, bối cảnh lịch sử, lưu ý đặc biệt..."
          value={context.notes}
          onChange={(e) => update({ notes: e.target.value })}
        />
      </label>

      <label className="check-row">
        <input
          type="checkbox"
          checked={context.includeInExternalRequests}
          onChange={(e) => update({ includeInExternalRequests: e.target.checked })}
        />
        <span>Cho phép đưa ngữ cảnh này vào prompt gửi tới AI Provider (khuyên dùng)</span>
      </label>

      {/* Bảng thuật ngữ Glossary */}
      <div className="subsection">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b>Bảng thuật ngữ đồng bộ (Glossary)</b>
          <button
            onClick={() =>
              update({
                glossary: [
                  ...context.glossary,
                  { id: crypto.randomUUID(), source: '', target: '', enabled: true },
                ],
              })
            }
            className="btn-primary"
            style={{ padding: '3px 8px', fontSize: '11px' }}
          >
            + Thêm thuật ngữ
          </button>
        </div>

        {context.glossary.map((x) => (
          <div className="list-row" key={x.id}>
            <input
              value={x.source}
              placeholder="Từ gốc (vd: 伯爵様)"
              onChange={(e) =>
                update({
                  glossary: context.glossary.map((y) =>
                    y.id === x.id ? { ...y, source: e.target.value } : y
                  ),
                })
              }
            />
            <input
              value={x.target}
              placeholder="Bản dịch (vd: Ngài Bá tước)"
              onChange={(e) =>
                update({
                  glossary: context.glossary.map((y) =>
                    y.id === x.id ? { ...y, target: e.target.value } : y
                  ),
                })
              }
            />
            <button
              className="danger"
              onClick={() =>
                update({ glossary: context.glossary.filter((y) => y.id !== x.id) })
              }
              title="Xóa thuật ngữ"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Hồ sơ nhân vật */}
      <div className="subsection">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b>Hồ sơ nhân vật (Character Profiles)</b>
          <button
            onClick={() =>
              update({
                characters: [
                  ...context.characters,
                  { id: crypto.randomUUID(), name: '', enabled: true },
                ],
              })
            }
            className="btn-primary"
            style={{ padding: '3px 8px', fontSize: '11px' }}
          >
            + Thêm nhân vật
          </button>
        </div>

        {context.characters.map((x) => (
          <div className="character-card" key={x.id}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                style={{ flex: 1 }}
                placeholder="Tên nhân vật (vd: Maria)"
                value={x.name}
                onChange={(e) =>
                  update({
                    characters: context.characters.map((y) =>
                      y.id === x.id ? { ...y, name: e.target.value } : y
                    ),
                  })
                }
              />
              <input
                style={{ flex: 1 }}
                placeholder="Xưng hô (vd: ta - ngươi / tiểu thư)"
                value={x.pronouns ?? ''}
                onChange={(e) =>
                  update({
                    characters: context.characters.map((y) =>
                      y.id === x.id ? { ...y, pronouns: e.target.value } : y
                    ),
                  })
                }
              />
              <button
                className="danger"
                onClick={() =>
                  update({ characters: context.characters.filter((y) => y.id !== x.id) })
                }
                title="Xóa nhân vật"
              >
                ✕
              </button>
            </div>
            <textarea
              rows={2}
              placeholder="Đặc điểm giọng điệu/lời thoại (vd: kiêu sa, quý tộc, hay cười ohohoho...)"
              value={x.speechStyle ?? ''}
              onChange={(e) =>
                update({
                  characters: context.characters.map((y) =>
                    y.id === x.id ? { ...y, speechStyle: e.target.value } : y
                  ),
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * BatchPanel
 * ----------------------------------------------------------------------------
 * Bảng mô phỏng tiến trình hàng loạt theo máy trạng thái pipeline.
 * ============================================================================
 */
function BatchPanel({
  project,
  pipe,
  step,
  setPipe,
}: {
  project: MangaProject;
  pipe: PipelineState;
  step: () => void;
  setPipe: (v: PipelineState) => void;
}) {
  return (
    <div className="editor-form">
      <p className="hint">
        Bảng điều khiển trạng thái tiến trình xử lý hàng loạt giữa các giai đoạn: Vision → Dịch thuật
        → Dàn chữ (Layout) → Duyệt.
      </p>

      <div className="progress-line">
        <b>Trạng thái: {pipe.control}</b>
        <span>
          Hoàn thành: {pipe.jobs.filter((j) => j.stage === 'completed').length}/{pipe.jobs.length}{' '}
          trang
        </span>
      </div>

      <div className="subsection" style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {pipe.jobs.map((j) => (
          <div className="queue-row" key={j.pageId}>
            <span>{project.pages.find((p) => p.id === j.pageId)?.fileName ?? j.pageId}</span>
            <span className="badge-status badge-pending">{j.stage}</span>
            <small>{j.attempts} lần thử</small>
          </div>
        ))}
      </div>

      <div className="button-row">
        <button onClick={() => setPipe(startPipeline(pipe))}>Bắt đầu</button>
        <button onClick={() => setPipe(pausePipeline(pipe))}>Tạm dừng</button>
        <button onClick={step}>Bước tiếp theo</button>
        <button onClick={() => setPipe(cancelPipeline(pipe))}>Hủy bỏ</button>
        <button
          onClick={() =>
            setPipe(
              retryPage(pipe, pipe.jobs.find((j) => j.stage === 'failed')?.pageId ?? '')
            )
          }
        >
          Thử lại trang lỗi
        </button>
      </div>
    </div>
  );
}
