import { useEffect, useState } from 'react';
import { openPath } from '@tauri-apps/plugin-opener';
import { getModelsDirectory, isDesktopRuntime, NativeModelEntry, scanNativeModels } from './native';

/**
 * ============================================================================
 * ModelManager Modal
 * ----------------------------------------------------------------------------
 * Quản lý và lập chỉ mục các file model AI chạy offline trong thư mục `models/`.
 * 
 * Nguyên tắc hoạt động:
 * - Ứng dụng đọc trực tiếp danh sách file `.gguf` từ thư mục `models/` qua Tauri native scan.
 * - Mô hình Vision-Language Model (VLM) như Qwen2.5-VL yêu cầu đủ cặp:
 *   1. File base model trọng số GGUF (vd: `Qwen2.5-VL-3B-Instruct.Q4_K_M.gguf`)
 *   2. File Vision Projector tương ứng (vd: `mmproj-fp16.gguf` hoặc `.mmproj`)
 * - Trạng thái `ready` chỉ bật khi phát hiện đủ cặp model + vision projector.
 * ============================================================================
 */
export function ModelManager({ close }: { close: () => void }) {
  const [directory, setDirectory] = useState('');
  const [entries, setEntries] = useState<NativeModelEntry[]>([]);
  const [error, setError] = useState('');

  // Quét các file model trong đường dẫn được chỉ định
  const scan = async (path: string) => {
    try {
      setError('');
      const list = await scanNativeModels(path);
      setEntries(list);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể quét thư mục models.');
    }
  };

  // Làm mới và tìm đường dẫn thư mục `models/` của ứng dụng
  const refresh = async () => {
    if (!isDesktopRuntime()) {
      setError('Quản lý model local cần chạy trong bản desktop Tauri.');
      return;
    }
    const path = await getModelsDirectory();
    if (!path) return;
    setDirectory(path);
    await scan(path);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="modal-backdrop">
      <section className="settings-modal tools-modal">
        <div className="inspector-tabs">
          <b>Quản lý model offline cục bộ (Local GGUF Models)</b>
          <button onClick={close} title="Đóng">✕</button>
        </div>

        <p className="hint">
          Ứng dụng phát hiện tự động các mô hình GGUF và Vision Projector trong thư mục <code>models/</code>.
          VLM chỉ sẵn sàng khi có đủ file model và file mmproj tương ứng.
        </p>

        <label>
          Đường dẫn thư mục models
          <input readOnly value={directory} placeholder="Đang tìm thư mục models..." />
        </label>

        <div className="button-row">
          <button disabled={!directory} onClick={() => void openPath(directory)}>
            📁 Mở thư mục models trên Windows
          </button>
          <button className="btn-primary" onClick={() => void refresh()}>
            🔄 Quét lại
          </button>
        </div>

        {error && <p className="layout-issue error">{error}</p>}
        {!entries.length && !error && (
          <p className="empty">Chưa tìm thấy file `.gguf` hoặc `.mmproj` trong thư mục models.</p>
        )}

        <div className="subsection" style={{ maxHeight: '280px', overflowY: 'auto' }}>
          {entries.map((entry) => (
            <div className="queue-row" key={entry.path}>
              <div>
                <b>{entry.name}</b>
                <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                  {Math.round(entry.size_bytes / 1024 / 1024)} MB · Loại: {entry.kind}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={entry.ready ? 'status-ok' : 'status'}>
                  {entry.ready ? '🟢 Đủ cặp Vision' : 'Chưa đủ cặp'}
                </span>
                {entry.reason && (
                  <small style={{ display: 'block', color: 'var(--text-dim)', fontSize: '10px' }}>
                    {entry.reason}
                  </small>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

