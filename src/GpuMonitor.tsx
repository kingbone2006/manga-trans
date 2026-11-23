import { useEffect, useState } from 'react';
import { NativeGpuTelemetry, getGpuTelemetry, isDesktopRuntime } from './native';

export function GpuMonitor({ close }: { close: () => void }) {
  const [telemetry, setTelemetry] = useState<NativeGpuTelemetry | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const data = await getGpuTelemetry();
      setTelemetry(data);
    } catch {
      setTelemetry(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTelemetry();
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      void fetchTelemetry();
    }, 2000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  const formatBytes = (bytes?: number | null) => {
    if (bytes === undefined || bytes === null || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(0)} MB`;
  };

  return (
    <div className="modal-backdrop">
      <section className="settings-modal gpu-modal">
        <div className="inspector-tabs">
          <b>Giám sát GPU theo thời gian thực</b>
          <button onClick={close}>Đóng</button>
        </div>

        <p className="hint">
          Đọc thông số trực tiếp từ Windows DXGI. Cảm biến nhiệt độ/công suất phụ thuộc driver hãng và hiển thị trung thực là "Không khả dụng" khi chưa tích hợp API độc quyền (không giả lập số liệu).
        </p>

        {!isDesktopRuntime() && (
          <p className="status">Chế độ Web: Giám sát GPU phần cứng chỉ khả dụng khi chạy trên ứng dụng desktop Tauri.</p>
        )}

        {isDesktopRuntime() && !telemetry && (
          <p className="empty">{loading ? 'Đang truy vấn GPU...' : 'Không tìm thấy adapter DXGI khả dụng.'}</p>
        )}

        {telemetry && (
          <div className="editor-form">
            <div className="status-grid">
              <label>
                Adapter GPU
                <input readOnly value={telemetry.adapter_name} />
              </label>

              <label>
                VRAM Dedicated
                <input readOnly value={formatBytes(telemetry.dedicated_vram_bytes)} />
              </label>

              <label>
                VRAM Shared
                <input readOnly value={formatBytes(telemetry.shared_vram_bytes)} />
              </label>

              <label>
                Budget VRAM
                <input readOnly value={formatBytes(telemetry.budget_vram_bytes)} />
              </label>

              <label>
                Mức dùng VRAM hiện tại
                <input readOnly value={formatBytes(telemetry.current_usage_vram_bytes)} />
              </label>

              <label>
                Nhiệt độ (°C)
                <input readOnly value={telemetry.temperature_celsius !== null ? `${telemetry.temperature_celsius}°C` : 'Không khả dụng'} />
              </label>

              <label>
                Công suất (W)
                <input readOnly value={telemetry.power_watts !== null ? `${telemetry.power_watts} W` : 'Không khả dụng'} />
              </label>

              <label>
                Tốc độ quạt (RPM)
                <input readOnly value={telemetry.fan_speed_rpm !== null ? `${telemetry.fan_speed_rpm} RPM` : 'Không khả dụng'} />
              </label>
            </div>

            <p className="hint">Nguồn dữ liệu: {telemetry.note}</p>

            <div className="button-row">
              <button onClick={() => void fetchTelemetry()}>{loading ? 'Đang đọc...' : 'Làm mới ngay'}</button>
              <button onClick={() => setAutoRefresh(!autoRefresh)}>
                {autoRefresh ? 'Tắt tự động cập nhật' : 'Bật tự cập nhật (2s)'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
