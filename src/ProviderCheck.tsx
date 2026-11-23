import { useState } from 'react';
import { MangaProject } from './model';
import { checkConnection } from './providerClient';

export function ProviderCheck({ project, apiKey, consent, close }: { project: MangaProject; apiKey: string; consent: boolean; close: () => void }) {
  const provider = project.provider;
  const [state, setState] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const run = async () => { if (!provider) return; setState('checking'); setMessage('Đang gửi request text-only kiểm tra kết nối...'); try { const result = await checkConnection({ baseUrl: provider.baseUrl, model: provider.model, apiKey, consentToCloud: consent }); setState('ok'); setMessage(`${result.message} Model: ${result.model ?? provider.model}.`); } catch (error) { const failure = error as Error & { kind?: string; attempts?: number }; setState('error'); setMessage(`${failure.message}${failure.kind ? ` [${failure.kind}]` : ''}${failure.attempts ? ` Sau ${failure.attempts} lần thử.` : ''}`); } };
  return <div className="modal-backdrop"><section className="settings-modal"><div className="inspector-tabs"><b>Kiểm tra kết nối provider</b><button onClick={close}>Đóng</button></div><p className="hint">Chỉ gửi một request văn bản tối thiểu khi bạn bấm nút. Không gửi ảnh và không lưu API key.</p><div className="capability-box"><div>Provider: {provider?.kind ?? 'chưa chọn'}</div><div>Endpoint: {provider?.baseUrl || 'chưa cấu hình'}</div><div>Model/route: {provider?.model || 'chưa cấu hình'}</div><div>Dữ liệu cloud: {consent ? 'đã cho phép theo phiên' : 'chưa cho phép'}</div></div>{message && <p className={`layout-issue ${state === 'error' ? 'error' : state === 'ok' ? 'status-ok' : ''}`}>{message}</p>}<button className="primary" disabled={state === 'checking' || !provider} onClick={() => void run()}>{state === 'checking' ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</button></section></div>;
}
