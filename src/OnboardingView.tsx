import { MangaProject } from './model';
import {
  nextOnboarding,
  onboardingSteps,
  previousOnboarding,
  restartOnboarding,
  skipOnboarding,
} from './onboarding';

/**
 * ============================================================================
 * Onboarding Component
 * ----------------------------------------------------------------------------
 * Hướng dẫn từng bước (Step-by-step wizard) cho người dùng mới khi mở MangaTrans:
 * - Bước 1: Chào mừng và giới thiệu tính năng.
 * - Bước 2: Chọn phương thức AI (9Router online / Local RTX 4050 / Custom).
 * - Bước 3: Chọn ngôn ngữ đích (mặc định Tiếng Việt).
 * - Bước 4: Chính sách quyền riêng tư dữ liệu ảnh.
 * - Bước 5: Hoàn tất và bắt đầu sử dụng.
 * ============================================================================
 */
export function Onboarding({
  project,
  edit,
  close,
}: {
  project: MangaProject;
  edit: (fn: (p: MangaProject) => MangaProject) => void;
  close: () => void;
}) {
  const state = project.onboarding ?? restartOnboarding();
  const step = onboardingSteps[state.lastStep];

  const finish = (next: typeof state) => edit((p) => ({ ...p, onboarding: next }));

  const renderContent = () => {
    switch (step) {
      case 'welcome':
        return (
          <>
            <h2>Chào mừng đến với MangaTrans</h2>
            <p className="hint">
              Ứng dụng hỗ trợ nhận diện chữ tiếng Nhật trên tranh bằng Vision AI, dịch sát ngữ cảnh và thay thế
              trực tiếp lời thoại tiếng Việt vào từng trang truyện tranh.
            </p>
          </>
        );

      case 'ai-choice':
        return (
          <>
            <h2>Chọn cấu hình AI Provider</h2>
            <p className="hint">
              Bạn có thể dùng 9Router online, model cục bộ (RTX 4050 GPU), hoặc LM Studio.
            </p>
            <label>
              Phương thức AI khuyên dùng:
              <select
                value={project.provider?.kind ?? 'custom-openai-compatible'}
                onChange={(e) =>
                  edit((p) => ({
                    ...p,
                    provider: {
                      ...p.provider!,
                      kind: e.target.value as NonNullable<MangaProject['provider']>['kind'],
                    },
                  }))
                }
              >
                <option value="9router-cloud">9Router online (Đa dạng model Vision)</option>
                <option value="lm-studio-local">Local AI (Chạy offline trên RTX 4050)</option>
                <option value="custom-openai-compatible">Tùy chỉnh OpenAI-compatible</option>
              </select>
            </label>
          </>
        );

      case 'target-language':
        return (
          <>
            <h2>Chọn ngôn ngữ đích</h2>
            <p className="hint">MangaTrans sẽ dịch tất cả các bong bóng thoại sang ngôn ngữ này.</p>
            <label>
              Ngôn ngữ bản dịch:
              <select
                value={project.targetLanguage}
                onChange={(e) => edit((p) => ({ ...p, targetLanguage: e.target.value }))}
              >
                <option value="vi">Tiếng Việt (vi)</option>
                <option value="en">English (en)</option>
                <option value="ja">日本語 (ja)</option>
              </select>
            </label>
          </>
        );

      case 'privacy':
        return (
          <>
            <h2>Bảo vệ quyền riêng tư & dữ liệu</h2>
            <p className="hint">
              Ảnh truyện của bạn không bao giờ tự động tải lên mạng nếu bạn không bật xác nhận gửi dữ liệu lên Cloud.
            </p>
          </>
        );

      case 'offline-demo':
        return (
          <>
            <h2>Kiểm tra giao diện & Dàn chữ</h2>
            <p className="hint">
              Sau khi dịch, bạn có thể xem trước bản dịch ngay trên trang truyện, tùy chỉnh cỡ chữ, màu sắc.
            </p>
          </>
        );

      default:
        return (
          <>
            <h2>Sẵn sàng bắt đầu!</h2>
            <p className="hint">
              Bạn có thể bấm "+ Folder" để nạp bộ truyện, kiểm tra AI Provider và bấm "Start dịch".
            </p>
          </>
        );
    }
  };

  return (
    <div className="modal-backdrop">
      <section className="settings-modal onboarding">
        <div className="progress-line" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <b>
            Bước {state.lastStep + 1}/{onboardingSteps.length}
          </b>
          <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>{step}</span>
        </div>

        {renderContent()}

        <div className="button-row" style={{ marginTop: '16px' }}>
          <button
            disabled={state.lastStep === 0}
            onClick={() => finish(previousOnboarding(state))}
          >
            ← Quay lại
          </button>

          {state.lastStep < onboardingSteps.length - 1 ? (
            <button
              className="btn-primary"
              onClick={() => finish(nextOnboarding(state))}
            >
              Tiếp tục →
            </button>
          ) : (
            <button
              className="btn-success"
              onClick={() => {
                finish({ ...state, completed: true });
                close();
              }}
            >
              Hoàn tất & Bắt đầu
            </button>
          )}

          <button
            onClick={() => {
              finish(skipOnboarding(state));
              close();
            }}
            style={{ marginLeft: 'auto' }}
          >
            Bỏ qua
          </button>
        </div>
      </section>
    </div>
  );
}
