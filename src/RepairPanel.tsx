import { useState } from 'react';
import { MangaPage, MangaProject, RepairJob } from './model';
import {
  startRepairJob,
  completeRepairJob,
  cancelRepairJob,
  prioritizeRepairJob,
  retryRepairJob,
} from './repairOps';

export const REPAIR_PRESETS = [
  { key: 'overflow', label: 'Tràn khung', text: 'Viết lại ngắn gọn để vừa vùng, giữ nguyên ý, giọng và quan hệ xưng hô.' },
  { key: 'read-error', label: 'Đọc sai / Bỏ sót', text: 'Dùng vision model đọc lại riêng vùng đã tô, cập nhật nội dung nhận diện rồi dịch lại.' },
  { key: 'missed-bubble', label: 'Bỏ sót thoại/hiệu ứng', text: 'Phân tích vùng đã tô để thêm vùng chữ mới, đọc và dịch mà không làm mất các vùng đã có.' },
  { key: 'unnatural', label: 'Chưa tự nhiên', text: 'Dịch lại tự nhiên hơn theo ngữ cảnh, hồ sơ nhân vật và glossary; không sửa vùng khác.' },
  { key: 'reading-order', label: 'Sai thứ tự đọc', text: 'Sắp xếp lại thứ tự đọc hoặc liên kết đúng vùng với nhân vật.' },
  { key: 'voice', label: 'Sai giọng nhân vật', text: 'Viết lại theo hồ sơ và cách nói của nhân vật nhưng giữ nguyên nghĩa.' },
  { key: 'speaker', label: 'Sai tên / người nói', text: 'Dùng hồ sơ nhân vật và vùng liên quan để hiệu chỉnh người nói.' },
  { key: 'leftover', label: 'Sót chữ / lỗi nền', text: 'Làm sạch hoặc inpaint vùng được đánh dấu nếu backend hỗ trợ.' },
  { key: 'expand', label: 'Mở rộng bong bóng', text: 'Đề xuất mở rộng bong bóng để tạo thêm diện tích.' },
  { key: 'styling', label: 'Sai cỡ / kiểu chữ', text: 'Chỉnh vị trí, xuống dòng, cỡ chữ hoặc style trong vùng được chọn.' },
];

export function RepairPanel({
  page,
  jobs,
  prompt,
  setPrompt,
  addJob,
  edit,
}: {
  page: MangaPage | null;
  jobs: RepairJob[];
  prompt: string;
  setPrompt: (v: string) => void;
  addJob: (k: string, p: string) => void;
  edit: (fn: (v: MangaProject) => MangaProject) => void;
}) {
  const [selectedPreset, setSelectedPreset] = useState('overflow');

  const startAll = () => {
    edit((v) => {
      const nextJobs = (v.repairJobs ?? []).map((job) => {
        if (job.status !== 'queued') return job;
        const targetPage = v.pages.find((p) => p.id === job.pageId);
        if (!targetPage) return job;
        return completeRepairJob(startRepairJob(job, targetPage));
      });
      return { ...v, repairJobs: nextJobs };
    });
  };

  const approveJob = (job: RepairJob) => {
    edit((v) => ({
      ...v,
      pages: v.pages.map((p) => {
        if (p.id !== job.pageId) return p;
        return {
          ...p,
          status: 'approved',
          regions: p.regions.map((r) => (r.id === job.regionId ? { ...r, status: 'approved' } : r)),
        };
      }),
      repairJobs: (v.repairJobs ?? []).map((j) => (j.id === job.id ? { ...j, status: 'approved' } : j)),
    }));
  };

  const retry = (id: string) =>
    edit((v) => ({ ...v, repairJobs: (v.repairJobs ?? []).map((job) => (job.id === id ? retryRepairJob(job) : job)) }));
  const cancel = (id: string) =>
    edit((v) => ({ ...v, repairJobs: (v.repairJobs ?? []).map((job) => (job.id === id ? cancelRepairJob(job) : job)) }));
  const prioritize = (id: string) =>
    edit((v) => ({ ...v, repairJobs: prioritizeRepairJob(v.repairJobs ?? [], id) }));

  const cur = REPAIR_PRESETS.find((p) => p.key === selectedPreset);

  return (
    <div className="editor-form">
      <p className="hint">
        Hàng chờ sửa: mỗi yêu cầu gắn với ID ổn định của trang/vùng, kiểm tra revision chống xung đột.
        Ở chế độ thủ công, kết quả sửa luôn về trạng thái "Cần duyệt" và chỉ hoàn tất sau khi bấm Duyệt.
      </p>

      <label>
        Chọn lỗi preset
        <select value={selectedPreset} onChange={(e) => setSelectedPreset(e.target.value)}>
          {REPAIR_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <p className="hint">{cur?.text}</p>

      <label>
        Prompt tùy chỉnh (tùy chọn)
        <textarea
          placeholder="Chỉ dẫn bổ sung..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>

      <div className="button-row">
        <button
          disabled={!page}
          onClick={() => {
            const final = prompt.trim() ? `${cur?.text ?? ''} ${prompt}` : (cur?.text ?? 'Xử lý.');
            addJob(selectedPreset, final);
          }}
        >
          + Thêm vào hàng chờ sửa
        </button>
        <button disabled={!jobs.some((j) => j.status === 'queued')} onClick={startAll}>
          Start sửa
        </button>
      </div>

      <div className="subsection">
        <b>Danh sách công việc sửa ({jobs.length})</b>
        {jobs.length === 0 && <p className="empty">Chưa có job sửa nào.</p>}
        {jobs.map((j) => (
          <div className="queue-row" key={j.id}>
            <div>
              <b>{j.kind}</b>
              <small style={{ display: 'block' }}>{j.prompt}</small>
            </div>
            <span className={j.status === 'needs-review' ? 'status-ok' : 'status'}>
              {j.status}
              {j.error ? ` · ${j.error}` : ''}
            </span>
            <div className="button-row">
              {j.status === 'needs-review' && (
                <button className="primary" onClick={() => approveJob(j)}>
                  Duyệt (Approve)
                </button>
              )}
              {['failed', 'cancelled'].includes(j.status) && (
                <button onClick={() => retry(j.id)}>Thử lại</button>
              )}
              {['queued', 'waiting-page'].includes(j.status) && (
                <>
                  <button onClick={() => prioritize(j.id)}>Ưu tiên</button>
                  <button onClick={() => cancel(j.id)}>Hủy</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
