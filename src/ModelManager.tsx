import { useEffect, useState } from 'react';
import { openPath } from '@tauri-apps/plugin-opener';
import { getModelsDirectory, isDesktopRuntime, NativeModelEntry, scanNativeModels } from './native';

export function ModelManager({ close }: { close: () => void }) {
  const [directory, setDirectory] = useState('');
  const [entries, setEntries] = useState<NativeModelEntry[]>([]);
  const [error, setError] = useState('');
  const scan = async (path: string) => { try { setError(''); setEntries(await scanNativeModels(path)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể quét thư mục models.'); } };
  const refresh = async () => { if (!isDesktopRuntime()) { setError('Quản lý model local cần chạy trong bản desktop Tauri.'); return; } const path = await getModelsDirectory(); if (!path) return; setDirectory(path); await scan(path); };
  useEffect(() => { void refresh(); }, []);
  return <div className="modal-backdrop"><section className="settings-modal tools-modal"><div className="inspector-tabs"><b>Quản lý model local</b><button onClick={close}>Đóng</button></div><p className="hint">Ứng dụng chỉ lập chỉ mục, không tự tải hoặc Load model. VLM chỉ sẵn sàng khi có đủ GGUF và mmproj tương ứng.</p><label>Thư mục models<input readOnly value={directory} placeholder="Chưa xác định"/></label><div className="button-row"><button disabled={!directory} onClick={() => void openPath(directory)}>Mở thư mục models</button><button onClick={() => void refresh()}>Quét lại</button></div>{error && <p className="layout-issue error">{error}</p>} {!entries.length && !error && <p className="empty">Chưa có file `.gguf` hoặc `.mmproj`.</p>}<div className="subsection">{entries.map((entry) => <div className="queue-row" key={entry.path}><span><b>{entry.name}</b><small>{Math.round(entry.size_bytes / 1024 / 1024)} MB · {entry.kind}</small></span><span className={entry.ready ? 'status-ok' : 'status'}>{entry.ready ? 'Đủ cặp, sẵn sàng kiểm tra' : 'Chưa sẵn sàng'}</span><small>{entry.reason}</small></div>)}</div></section></div>;
}
