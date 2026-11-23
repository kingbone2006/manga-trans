import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import {
  exportImages,
  getGpuTelemetry,
  isDesktopRuntime,
  NativeGpuTelemetry,
  readProjectNative,
  saveProjectAtomic,
} from './native';
import {
  MangaPage,
  MangaProject,
  ProviderKind,
  TextRegion,
  TranslationStrategy,
  createProject,
  languageFolderCode,
  naturalCompare,
  outputFileName,
  parseProject,
  sanitizeFileName,
  serializeProject,
} from './model';
import { endpointCapability } from './provider';
import { ProjectTools } from './ProjectTools';
import { ModelManager } from './ModelManager';
import { ProviderCheck } from './ProviderCheck';
import { PipelineState, createPipeline } from './pipeline';
import { diagnoseLayout } from './layout';
import { Onboarding } from './OnboardingView';
import { defaultExportPlan } from './exportPlan';
import { removePage, reorderPages, renameProject, setProjectSourceLanguage, templateFileName } from './projectOps';
import { VisionPageAdapter } from './visionAdapter';
import { runVisionPipeline } from './visionPipeline';
import { translateProjectPages } from './translationPipeline';
import { GpuMonitor } from './GpuMonitor';
import {
  checkProviderLiveStatus,
  ConnectionStatus,
  fetchProviderModels,
  ProviderModelItem,
} from './providerClient';

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Không thể đọc ${file.name}.`));
    reader.readAsDataURL(file);
  });

export default function App() {
  const [project, setProject] = useState<MangaProject>(createProject());
  const [history, setHistory] = useState<MangaProject[]>([]);
  const [future, setFuture] = useState<MangaProject[]>([]);
  const [notice, setNotice] = useState('Sẵn sàng nhập ảnh truyện.');
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showProviderCheck, setShowProviderCheck] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [showGpu, setShowGpu] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !project.onboarding?.completed && !project.onboarding?.skipped
  );
  const [sessionApiKey, setSessionApiKey] = useState('');
  const [cloudConsent, setCloudConsent] = useState(false);
  const [, setPipeline] = useState<PipelineState>(() => createPipeline(project.pages));
  const [isTranslating, setIsTranslating] = useState(false);

  // Live AI Connection State
  const [aiStatus, setAiStatus] = useState<ConnectionStatus>({ connected: false, error: 'Chưa kết nối' });
  const [isCheckingAi, setIsCheckingAi] = useState(false);

  // Live GPU telemetry state for footer
  const [footerGpu, setFooterGpu] = useState<NativeGpuTelemetry | null>(null);

  useEffect(() => {
    const fetchGpu = async () => {
      try {
        const data = await getGpuTelemetry();
        setFooterGpu(data);
      } catch {
        setFooterGpu(null);
      }
    };
    void fetchGpu();
    const interval = setInterval(() => {
      void fetchGpu();
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const picker = useRef<HTMLInputElement>(null);
  const folderPicker = useRef<HTMLInputElement>(null);
  const page = project.pages.find((item) => item.id === project.selectedPageId) ?? null;
  const region = page?.regions.find((item) => item.id === selectedRegionId) ?? page?.regions[0] ?? null;

  const edit = (fn: (value: MangaProject) => MangaProject) => {
    setHistory((items) => [...items.slice(-49), project]);
    setFuture([]);
    setProject({ ...fn(project), updatedAt: new Date().toISOString() });
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [project, ...items]);
    setProject(previous);
    setHistory((items) => items.slice(0, -1));
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((items) => [...items, project]);
    setProject(next);
    setFuture((items) => items.slice(1));
  };

  // Monitor live AI status
  useEffect(() => {
    const checkLive = async () => {
      const p = project.provider;
      if (!p?.baseUrl?.trim()) {
        setAiStatus({ connected: false, error: 'Chưa cấu hình' });
        return;
      }
      setIsCheckingAi(true);
      try {
        const res = await checkProviderLiveStatus(p.baseUrl, p.model, sessionApiKey);
        setAiStatus(res);
      } catch {
        setAiStatus({ connected: false, error: 'Lỗi kết nối' });
      } finally {
        setIsCheckingAi(false);
      }
    };
    void checkLive();
    const interval = setInterval(() => {
      void checkLive();
    }, 10_000);
    return () => clearInterval(interval);
  }, [project.provider?.baseUrl, project.provider?.model, sessionApiKey]);

  const importImages = async (event: ChangeEvent<HTMLInputElement>, fromFolder = false) => {
    const files = Array.from(event.target.files ?? [])
      .filter((file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
      .sort((a, b) => naturalCompare(a.name, b.name));
    if (!files.length) {
      setNotice('Không có ảnh PNG, JPEG hoặc WebP hợp lệ.');
      return;
    }
    try {
      const pages: MangaPage[] = await Promise.all(
        files.map(async (file, order) => ({
          id: makeId('page'),
          fileName: file.name,
          sourceUrl: await fileToDataUrl(file),
          order,
          status: 'pending',
          regions: [],
        }))
      );
      const folderName = fromFolder ? files[0]?.webkitRelativePath?.split('/')[0] : undefined;
      const shouldRename = Boolean(
        folderName &&
          project.pages.length === 0 &&
          project.name === 'Project chưa đặt tên' &&
          window.confirm(`Đổi tên project thành “${folderName}”?`)
      );
      edit((value) => ({
        ...value,
        name: shouldRename ? folderName! : value.name,
        pages: [...value.pages, ...pages].map((item, index) => ({ ...item, order: index })),
        selectedPageId: value.selectedPageId ?? pages[0]!.id,
      }));
      setNotice(`Đã nhập ${files.length} trang${folderName ? ` từ folder ${folderName}` : ''}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể nhập ảnh.');
    }
    event.target.value = '';
  };

  const save = async () => {
    const content = serializeProject(project);
    try {
      if (isDesktopRuntime()) {
        const path =
          projectPath ??
          (await saveDialog({
            defaultPath: `${sanitizeFileName(project.name)}.mangatrans`,
            filters: [{ name: 'MangaTrans project', extensions: ['mangatrans'] }],
          }));
        if (typeof path !== 'string') return;
        await saveProjectAtomic(path, content);
        setProjectPath(path);
        setNotice(`Đã lưu atomic project: ${path}`);
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
        link.download = `${sanitizeFileName(project.name)}.mangatrans`;
        link.click();
        setNotice('Đã tải project .mangatrans.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể lưu project.');
    }
  };

  const saveAs = async () => {
    if (!isDesktopRuntime()) {
      setNotice('Save As native cần chạy bản desktop Tauri.');
      return;
    }
    const path = await saveDialog({
      defaultPath: `${sanitizeFileName(project.name)}.mangatrans`,
      filters: [{ name: 'MangaTrans project', extensions: ['mangatrans'] }],
    });
    if (typeof path !== 'string') return;
    try {
      await saveProjectAtomic(path, serializeProject(project));
      setProjectPath(path);
      setNotice(`Đã lưu bản mới tại ${path}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Save As thất bại.');
    }
  };

  const openNative = async () => {
    if (!isDesktopRuntime()) return;
    const path = await openDialog({
      multiple: false,
      filters: [{ name: 'MangaTrans project', extensions: ['mangatrans', 'json'] }],
      title: 'Mở project',
    });
    if (typeof path !== 'string') return;
    try {
      const opened = parseProject(await readProjectNative(path));
      setProject(opened);
      setProjectPath(path);
      setHistory([]);
      setFuture([]);
      setNotice(`Đã mở ${path}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể mở project.');
    }
  };

  const open = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const opened = parseProject(String(reader.result));
        setProject(opened);
        setHistory([]);
        setFuture([]);
        setNotice(`Đã mở ${file.name}.`);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Không thể mở project.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const addRegion = () => {
    if (!page) return;
    const added: TextRegion = {
      id: makeId('region'),
      x: 25,
      y: 25,
      width: 25,
      height: 15,
      sourceText: '',
      translation: '',
      status: 'needs-review',
      fontSize: 22,
      textColor: '#111827',
      outlineColor: '#ffffff',
    };
    edit((value) => ({
      ...value,
      pages: value.pages.map((item) =>
        item.id === page.id ? { ...item, regions: [...item.regions, added], status: 'needs-review' } : item
      ),
    }));
    setSelectedRegionId(added.id);
    setNotice('Đã thêm vùng chữ mới.');
  };

  const removeRegion = () => {
    if (!page || !region) return;
    edit((value) => ({
      ...value,
      pages: value.pages.map((item) =>
        item.id === page.id ? { ...item, regions: item.regions.filter((part) => part.id !== region.id) } : item
      ),
    }));
    setSelectedRegionId(null);
  };

  const rename = () => {
    const value = window.prompt('Tên project mới:', project.name);
    if (value?.trim()) edit((current) => renameProject(current, value.trim()));
  };

  const deleteCurrentPage = () => {
    if (!page || !window.confirm(`Xóa trang ${page.fileName}?`)) return;
    edit((current) => removePage(current, page.id));
    setSelectedRegionId(null);
    setNotice(`Đã xóa trang ${page.fileName}.`);
  };

  const movePage = (delta: number) => {
    if (!page) return;
    const index = project.pages.findIndex((item) => item.id === page.id);
    const target = index + delta;
    if (target < 0 || target >= project.pages.length) return;
    edit((current) => reorderPages(current, index, target));
  };

  const startTranslation = async () => {
    const provider = project.provider;
    if (!provider?.enabled) {
      setNotice('Provider chưa được kích hoạt. Hãy bấm vào "AI Provider" để bật.');
      setShowSettings(true);
      return;
    }
    if (!provider.model.trim() || !provider.baseUrl.trim()) {
      setNotice('Thiếu Model hoặc Base URL trong cài đặt AI.');
      setShowSettings(true);
      return;
    }
    const capability = endpointCapability(provider);
    if (!capability.vision) {
      setNotice('Provider/model chưa xác minh hỗ trợ vision; vui lòng tích xác minh vision.');
      setShowSettings(true);
      return;
    }
    if (capability.remote && !cloudConsent) {
      setNotice('Cần xác nhận cho phép gửi dữ liệu lên cloud trước khi bắt đầu.');
      setShowSettings(true);
      return;
    }
    if (!project.pages.length) {
      setNotice('Chưa có trang nào trong project để dịch.');
      return;
    }

    setIsTranslating(true);
    setPipeline(createPipeline(project.pages));
    setNotice('Giai đoạn 1/2: Đang nhận diện Vision AI và đọc thoại từng trang...');

    try {
      const adapter = new VisionPageAdapter({
        settings: provider,
        apiKey: sessionApiKey || undefined,
        consentToCloud: cloudConsent,
      });
      const visionResult = await runVisionPipeline(project, adapter, (event) => {
        setNotice(`Vision [${event.index + 1}/${event.total}]: ${event.stage}${event.message ? ` — ${event.message}` : ''}`);
      });
      setProject(visionResult.project);

      setNotice('Giai đoạn 2/2: Đang dịch ngữ cảnh câu chuyện sang Tiếng Việt...');
      const translated = await translateProjectPages(visionResult.project, {
        settings: provider,
        apiKey: sessionApiKey || undefined,
        consentToCloud: cloudConsent,
        onProgress: (info) => {
          setNotice(`Dịch trang [${info.pageIndex + 1}/${info.totalPages}] (${info.pageName})...`);
        },
      });

      setProject(translated);
      setPipeline((current) => ({
        ...current,
        control: 'idle',
        jobs: current.jobs.map((job) => {
          const p = translated.pages.find((item) => item.id === job.pageId);
          return {
            ...job,
            stage: p?.status === 'failed' ? 'failed' : p?.status === 'needs-review' ? 'needs-review' : 'completed',
            error: p?.error,
          };
        }),
      }));
      setNotice(`Dịch hoàn tất ${translated.pages.length} trang! Hãy kiểm tra preview và bấm "Xuất đã duyệt".`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Pipeline dịch gặp lỗi.');
    } finally {
      setIsTranslating(false);
    }
  };

  const exportAll = async () => {
    const plan = defaultExportPlan(project, (project.exports ?? []).map((item) => item.folderName));
    if (!plan.files.length) {
      setNotice('Chưa có trang đã duyệt để export.');
      return;
    }
    if (plan.collisions.length) {
      setNotice(`Tên file trùng: ${plan.collisions.join(', ')}.`);
      return;
    }
    if (!isDesktopRuntime()) {
      setNotice('Export folder thật chỉ khả dụng trong bản desktop Tauri.');
      return;
    }
    const parent = await openDialog({ directory: true, multiple: false, title: 'Chọn thư mục cha để export truyện đã dịch' });
    if (typeof parent !== 'string') return;
    try {
      const rendered = await Promise.all(
        plan.files.map(async (item) => {
          const source = project.pages.find((pageItem) => pageItem.id === item.pageId)!;
          const image = new Image();
          image.src = source.sourceUrl;
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error(`Không đọc được ${source.fileName}`));
          });
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas không khả dụng.');
          context.drawImage(image, 0, 0);
          source.regions.forEach((regionItem) => {
            const x = (regionItem.x / 100) * canvas.width;
            const y = (regionItem.y / 100) * canvas.height;
            const width = (regionItem.width / 100) * canvas.width;
            const height = (regionItem.height / 100) * canvas.height;
            context.fillStyle = 'rgba(255,255,255,.94)';
            context.beginPath();
            const r = 8;
            context.roundRect ? context.roundRect(x, y, width, height, r) : context.rect(x, y, width, height);
            context.fill();
            if (regionItem.translation) {
              context.fillStyle = regionItem.textColor ?? '#111827';
              context.font = `bold ${regionItem.fontSize ?? 24}px sans-serif`;
              context.textAlign = 'center';
              context.textBaseline = 'middle';
              context.fillText(regionItem.translation, x + width / 2, y + height / 2, width - 12);
            }
          });
          return { file_name: item.fileName, data_base64: canvas.toDataURL('image/png').split(',')[1] ?? '' };
        })
      );
      const report = await exportImages(parent, plan.folderName, rendered);
      if (!report) {
        setNotice("Export thất bại: không có phản hồi từ backend.");
        return;
      }
      setNotice("Đã xuất thành công " + report.files_written + " trang vào: " + report.folder);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Export thất bại.');
    }
  };

  const exportPage = async () => {
    if (!page) return;
    const image = new Image();
    image.src = page.sourceUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Không thể đọc ảnh nguồn để export.'));
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas không khả dụng.');
    context.drawImage(image, 0, 0);
    page.regions.forEach((item) => {
      const x = (item.x / 100) * canvas.width;
      const y = (item.y / 100) * canvas.height;
      const width = (item.width / 100) * canvas.width;
      const height = (item.height / 100) * canvas.height;
      context.fillStyle = 'rgba(255,255,255,.94)';
      context.beginPath();
      context.roundRect ? context.roundRect(x, y, width, height, 8) : context.rect(x, y, width, height);
      context.fill();
      if (item.translation) {
        context.fillStyle = item.textColor ?? '#111827';
        context.font = `bold ${item.fontSize ?? 24}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(item.translation, x + width / 2, y + height / 2, width - 12);
      }
    });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = outputFileName(page, page.order, project);
    link.click();
    setNotice(`Đã tải xuống ảnh trang ${page.order + 1}.`);
  };

  const hasTranslationResults = project.pages.some(
    (p) => p.regions.some((r) => r.translation.trim().length > 0) || p.status === 'approved'
  );
  const exportTooltip = isTranslating
    ? 'Đang chạy dịch, vui lòng chờ...'
    : !hasTranslationResults
    ? 'Chưa có kết quả dịch để xuất.'
    : 'Xuất các ảnh đã dịch ra thư mục';

  return (
    <div className="app-shell">
      {/* Topbar Header */}
      <header className="topbar">
        <div className="brand-section">
          <div className="brand-badge">M</div>
          <span className="brand-title">MangaTrans</span>
          <button className="project-name-btn" title="Bấm để đổi tên project" onClick={rename}>
            <span>{project.name}</span>
            <small>✎</small>
          </button>
        </div>

        <div className="topbar-center">
          {/* File Operations */}
          <div className="btn-group">
            <button onClick={() => picker.current?.click()} title="Nhập từng file ảnh lẻ">
              + Ảnh
            </button>
            <button onClick={() => folderPicker.current?.click()} title="Nhập trọn bộ folder truyện">
              + Folder
            </button>
            <button onClick={() => void openNative()} title="Mở file project .mangatrans">
              Mở
            </button>
            <label className="file-button" title="Mở file qua web browser">
              File Web
              <input hidden type="file" accept=".mangatrans,.json" onChange={open} />
            </label>
            <button disabled={!project.pages.length} onClick={() => void save()} title="Lưu nhanh">
              Lưu
            </button>
            <button disabled={!project.pages.length} onClick={() => void saveAs()} title="Lưu thành file mới">
              Save As
            </button>
          </div>

          <input
            ref={picker}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(event) => void importImages(event)}
          />
          <input
            ref={(node) => {
              folderPicker.current = node;
              if (node) node.setAttribute('webkitdirectory', '');
            }}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => void importImages(event, true)}
          />

          {/* Tools & Telemetry */}
          <div className="btn-group">
            <button onClick={() => setShowTools(true)} title="Glossary, nhân vật, ngữ cảnh">
              Context
            </button>
            <button onClick={() => setShowModels(true)} title="Quản lý model GGUF local">
              Models
            </button>
            <button onClick={() => setShowGpu(true)} title="Xem thông số RTX 4050 GPU">
              GPU
            </button>
            <button onClick={() => setShowOnboarding(true)} title="Hướng dẫn sử dụng">
              Trợ giúp
            </button>
          </div>

          {/* AI Provider Live Status Pill */}
          <div
            className={`ai-status-pill ${
              isCheckingAi ? 'checking' : aiStatus.connected ? 'connected' : 'disconnected'
            }`}
            onClick={() => setShowSettings(true)}
            title="Bấm để cấu hình hoặc kiểm tra AI Provider"
          >
            <span
              className={`pulse-dot ${
                isCheckingAi ? 'amber' : aiStatus.connected ? 'green' : 'red'
              }`}
            />
            <span>
              {isCheckingAi
                ? 'Đang kiểm tra AI...'
                : aiStatus.connected
                ? `AI: ${project.provider?.model || 'Sẵn sàng'}`
                : 'Chưa kết nối AI'}
            </span>
            {aiStatus.latencyMs !== undefined && (
              <span className="latency">{aiStatus.latencyMs}ms</span>
            )}
          </div>
        </div>

        <div className="topbar-right">
          <div className="btn-group">
            <button disabled={!history.length} onClick={undo} title="Hoàn tác (Ctrl+Z)">
              ↶
            </button>
            <button disabled={!future.length} onClick={redo} title="Làm lại (Ctrl+Y)">
              ↷
            </button>
          </div>

          <button
            className="btn-primary"
            disabled={isTranslating || !project.pages.length}
            onClick={() => void startTranslation()}
            title="Chạy nhận diện Vision và dịch tự động toàn bộ trang"
          >
            {isTranslating ? '⏳ Đang dịch...' : '⚡ Start dịch'}
          </button>

          <button disabled={!page} onClick={() => void exportPage()} title="Tải ảnh trang hiện tại">
            Xuất trang
          </button>

          <button
            className="btn-success"
            disabled={isTranslating || !hasTranslationResults}
            title={exportTooltip}
            onClick={exportAll}
          >
            Xuất đã duyệt ({project.pages.filter((p) => p.status === 'approved' || p.regions.some((r) => r.translation)).length})
          </button>
        </div>
      </header>

      {/* Modals */}
      {showOnboarding && <Onboarding project={project} edit={edit} close={() => setShowOnboarding(false)} />}
      {showSettings && (
        <ProviderSettings
          project={project}
          edit={edit}
          apiKey={sessionApiKey}
          setApiKey={setSessionApiKey}
          consent={cloudConsent}
          setConsent={setCloudConsent}
          close={() => setShowSettings(false)}
        />
      )}
      {showProviderCheck && (
        <ProviderCheck
          project={project}
          apiKey={sessionApiKey}
          consent={cloudConsent}
          close={() => setShowProviderCheck(false)}
        />
      )}
      {showTools && <ProjectTools project={project} page={page} edit={edit} close={() => setShowTools(false)} />}
      {showModels && <ModelManager close={() => setShowModels(false)} />}
      {showGpu && <GpuMonitor close={() => setShowGpu(false)} />}

      {/* Main Workspace */}
      <main className="workspace">
        <Sidebar
          project={project}
          edit={edit}
          selectRegion={setSelectedRegionId}
          movePage={movePage}
          deletePage={deleteCurrentPage}
        />

        {/* Center Canvas */}
        <section className="canvas-panel">
          <div className="panel-toolbar">
            <span className="file-label">{page?.fileName ?? 'Chưa chọn trang'}</span>
            <div className="zoom-controls">
              <button disabled={!page} onClick={() => setOverlay(!overlay)} title="Bật/tắt hiển thị bong bóng chữ">
                {overlay ? 'Ẩn overlay' : 'Hiện overlay'}
              </button>
              <button onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(1))))}>−</button>
              <span className="zoom-label">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(1))))}>+</button>
              <button onClick={() => setZoom(1)}>100%</button>
            </div>
          </div>

          <div className="canvas">
            <div className="image-wrap" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
              {page ? (
                <>
                  <img src={page.sourceUrl} alt={page.fileName} />
                  {overlay &&
                    page.regions.map((item) => (
                      <div
                        className={`region ${item.id === region?.id ? 'active' : ''}`}
                        key={item.id}
                        onClick={() => setSelectedRegionId(item.id)}
                        style={{
                          left: `${item.x}%`,
                          top: `${item.y}%`,
                          width: `${item.width}%`,
                          height: `${item.height}%`,
                        }}
                      >
                        {item.translation ? (
                          <em style={{ color: item.textColor ?? '#111827', fontSize: `${Math.max(11, (item.fontSize ?? 22) * 0.55)}px` }}>
                            {item.translation}
                          </em>
                        ) : (
                          <small style={{ color: '#6366f1', fontSize: '10px' }}>[Thoại]</small>
                        )}
                      </div>
                    ))}
                </>
              ) : (
                <div className="empty">
                  <h3>Bắt đầu dự án dịch truyện</h3>
                  <p>Bấm "+ Folder" hoặc "+ Ảnh" ở thanh trên để thêm các trang manga.</p>
                </div>
              )}
            </div>
          </div>

          <div className="canvas-footer">
            <span className="notice-text">{notice}</span>
            <button disabled={!page} onClick={addRegion} className="btn-primary" style={{ padding: '4px 10px' }}>
              + Thêm vùng chữ
            </button>
          </div>
        </section>

        {/* Right Inspector */}
        <aside className="inspector">
          <div className="inspector-tabs">
            <b>Thuộc tính vùng thoại</b>
            <span className="count">{page?.regions.length ?? 0} vùng</span>
          </div>
          {region && page ? (
            <Editor page={page} region={region} edit={edit} remove={removeRegion} />
          ) : (
            <div className="empty">Chọn hoặc thêm một vùng thoại trên ảnh để chỉnh sửa nội dung và kiểu chữ.</div>
          )}
        </aside>
      </main>

      {/* Footer Bar */}
      <footer>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>{aiStatus.connected ? `🟢 AI Online (${aiStatus.latencyMs ?? 0}ms)` : '🔴 AI Offline'} · MangaTrans v0.1.1</span>
          {footerGpu && (
            <span
              className="gpu-badge-footer"
              onClick={() => setShowGpu(true)}
              title="Nhấp để xem chi tiết GPU Telemetry"
            >
              🎮 <b>{footerGpu.adapter_name.replace('NVIDIA GeForce ', '').replace('Laptop GPU', '').trim()}</b>
              {' · '}
              <span>
                VRAM: {((footerGpu.current_usage_vram_bytes || 0) / (1024 * 1024 * 1024)).toFixed(1)} / {(footerGpu.dedicated_vram_bytes / (1024 * 1024 * 1024)).toFixed(1)} GB
              </span>
            </span>
          )}
        </div>
        <span>
          Nguồn:{' '}
          <select
            value={project.sourceLanguage ?? ''}
            onChange={(e) => edit((c) => setProjectSourceLanguage(c, e.target.value || null))}
          >
            <option value="">Tự động (Vision AI)</option>
            <option value="ja">日本語 (Nhật)</option>
            <option value="ko">한국어 (Hàn)</option>
            <option value="zh">中文 (Trung)</option>
            <option value="en">English (Anh)</option>
          </select>{' '}
          · Đích:{' '}
          <select
            value={project.targetLanguage}
            onChange={(e) => edit((c) => ({ ...c, targetLanguage: e.target.value }))}
          >
            <option value="vi">Tiếng Việt (vi)</option>
            <option value="en">English (en)</option>
            <option value="ja">日本語 (ja)</option>
          </select>{' '}
          · Thư mục xuất: <code>{languageFolderCode(project.targetLanguage)}</code> · Tên file:{' '}
          <code>{page ? templateFileName(project.outputTemplate ?? '{page:000}.{ext}', project, page, page.order) : '001.png'}</code>
        </span>
      </footer>
    </div>
  );
}
/**
 * ============================================================================
 * ProviderSettings Modal
 * ----------------------------------------------------------------------------
 * Cửa sổ cấu hình AI Provider (9Router, Local server RTX 4050, LM Studio, Ollama):
 * - Tự động tải danh sách Model có hỗ trợ Vision AI từ `/v1/models`.
 * - Tự động điền Base URL mặc định tương ứng với loại Provider được chọn.
 * - Hỗ trợ kiểm tra kết nối trực tiếp (Live ping test) kèm tính toán latency ms.
 * ============================================================================
 */


function ProviderSettings({
  project,
  edit,
  apiKey,
  setApiKey,
  consent,
  setConsent,
  close,
}: {
  project: MangaProject;
  edit: (fn: (value: MangaProject) => MangaProject) => void;
  apiKey: string;
  setApiKey: (value: string) => void;
  consent: boolean;
  setConsent: (value: boolean) => void;
  close: () => void;
}) {
  const provider = project.provider ?? createProject().provider!;
  const capability = endpointCapability(provider);

  const [availableModels, setAvailableModels] = useState<ProviderModelItem[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchMessage, setFetchMessage] = useState('');
  const [liveCheck, setLiveCheck] = useState<ConnectionStatus | null>(null);

  const handleFetchModels = async () => {
    let effectiveUrl = provider.baseUrl.trim();
    // 9Router chạy daemon cục bộ trên cổng 20128; tự động chuyển sang http://localhost:20128/v1 nếu gặp domain web
    if (!effectiveUrl || effectiveUrl === 'https://api.9router.com/v1') {
      effectiveUrl = 'http://localhost:20128/v1';
      edit((val) => ({ ...val, provider: { ...provider, baseUrl: effectiveUrl } }));
    }
    setFetchingModels(true);
    setFetchMessage('Đang kết nối để nạp danh sách model...');
    try {
      const models = await fetchProviderModels(effectiveUrl, apiKey);
      setAvailableModels(models);
      if (models.length > 0) {
        setFetchMessage(`Đã nạp thành công ${models.length} model từ ${effectiveUrl}!`);
        // Tự động ưu tiên chọn model Vision tốt nhất (nicegg nếu có, hoặc vision model đầu tiên)
        const preferred = models.find((m) => m.id === 'nicegg') || models.find((m) => m.vision) || models[0];
        if (preferred && (!provider.model.trim() || provider.model === 'openai/gpt-4o' || provider.model === 'Qwen')) {
          edit((val) => ({
            ...val,
            provider: {
              ...provider,
              baseUrl: effectiveUrl,
              model: preferred.id,
              vision: preferred.vision,
              enabled: true,
            },
          }));
        }
      } else {
        setFetchMessage('Không tìm thấy model nào từ endpoint này. Bạn có thể tự gõ tên model.');
      }
    } catch {
      setFetchMessage('Không thể kết nối tới endpoint để lấy model.');
    } finally {
      setFetchingModels(false);
    }
  };

  const handleTestConnection = async () => {
    let testUrl = provider.baseUrl.trim();
    if (!testUrl || testUrl === 'https://api.9router.com/v1') {
      testUrl = 'http://localhost:20128/v1';
      edit((val) => ({ ...val, provider: { ...provider, baseUrl: testUrl } }));
    }
    setLiveCheck({ connected: false, error: 'Đang kiểm tra...' });
    try {
      const res = await checkProviderLiveStatus(testUrl, provider.model, apiKey);
      setLiveCheck(res);
    } catch {
      setLiveCheck({ connected: false, error: 'Thất bại khi kết nối' });
    }
  };

  const handleSelectKind = (kind: ProviderKind) => {
    let defaultUrl = provider.baseUrl;
    let defaultModel = provider.model;
    if (kind === '9router-cloud') {
      defaultUrl = 'http://localhost:20128/v1';
      defaultModel = 'nicegg';
    } else if (kind === 'lm-studio-local') {
      defaultUrl = 'http://127.0.0.1:8080/v1';
      defaultModel = 'Qwen';
    }
    edit((val) => ({
      ...val,
      provider: {
        ...provider,
        kind,
        baseUrl: defaultUrl,
        model: defaultModel,
        vision: true,
        enabled: true,
      },
    }));
  };

  return (
    <div className="modal-backdrop">
      <section className="settings-modal">
        <div className="inspector-tabs">
          <b>Cấu hình AI Provider & 9Router</b>
          <button onClick={close}>✕</button>
        </div>

        <label>
          Loại Provider
          <select
            value={provider.kind}
            onChange={(e) => handleSelectKind(e.target.value as ProviderKind)}
          >
            <option value="9router-cloud">9Router Cloud (api.9router.com)</option>
            <option value="lm-studio-local">LM Studio / llama-server local (RTX 4050)</option>
            <option value="custom-openai-compatible">OpenAI-compatible tùy chỉnh</option>
          </select>
        </label>

        <label>
          Base URL
          <input
            value={provider.baseUrl}
            placeholder={
              provider.kind === '9router-cloud'
                ? 'https://api.9router.com/v1'
                : 'http://127.0.0.1:8080/v1'
            }
            onChange={(e) =>
              edit((val) => ({ ...val, provider: { ...provider, baseUrl: e.target.value.trim() } }))
            }
          />
        </label>

        <label>
          API Key (lưu trong phiên, không lưu ra file disk)
          <input
            type="password"
            value={apiKey}
            placeholder={provider.kind === '9router-cloud' ? 'Nhập key 9Router' : 'Không bắt buộc với server local'}
            onChange={(e) => {
              setApiKey(e.target.value);
              edit((val) => ({
                ...val,
                provider: { ...provider, hasApiKey: Boolean(e.target.value) },
              }));
            }}
          />
        </label>

        {/* Auto fetch models section */}
        <div className="model-fetch-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>Tự động nạp model từ Provider / 9Router</span>
            <button
              onClick={() => void handleFetchModels()}
              disabled={fetchingModels || !provider.baseUrl.trim()}
              className="btn-primary"
              style={{ padding: '4px 10px', fontSize: '11.5px' }}
            >
              {fetchingModels ? 'Đang nạp...' : '⚡ Nạp danh sách model'}
            </button>
          </div>

          {availableModels.length > 0 && (
            <label>
              Chọn model hỗ trợ:
              <select
                value={provider.model}
                onChange={(e) => {
                  const selected = availableModels.find((m) => m.id === e.target.value);
                  edit((val) => ({
                    ...val,
                    provider: {
                      ...provider,
                      model: e.target.value,
                      vision: selected ? selected.vision : provider.vision,
                      enabled: true,
                    },
                  }));
                }}
              >
                <optgroup label="Model có hỗ trợ Vision AI (Khuyên dùng dịch manga)">
                  {availableModels
                    .filter((m) => m.vision)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        👁 {m.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Các model khác">
                  {availableModels
                    .filter((m) => !m.vision)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </optgroup>
              </select>
            </label>
          )}

          {fetchMessage && <small style={{ color: '#93c5fd' }}>{fetchMessage}</small>}
        </div>

        <label>
          Model/Route đang dùng (có thể gõ tùy ý)
          <input
            value={provider.model}
            placeholder="Tên model (vd: Qwen, openai/gpt-4o...)"
            onChange={(e) =>
              edit((val) => ({ ...val, provider: { ...provider, model: e.target.value.trim() } }))
            }
          />
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={provider.vision}
            onChange={(e) =>
              edit((val) => ({ ...val, provider: { ...provider, vision: e.target.checked } }))
            }
          />
          <b>Model hỗ trợ Vision AI</b> (Nhìn trực tiếp tranh để đọc chữ và phát hiện bong bóng thoại)
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={provider.enabled}
            onChange={(e) =>
              edit((val) => ({ ...val, provider: { ...provider, enabled: e.target.checked } }))
            }
          />
          <b>Kích hoạt provider này</b>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          Cho phép gửi ảnh lên Cloud (cần bật nếu dùng 9Router online)
        </label>

        <div className="capability-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <b>Tình trạng kết nối:</b>{' '}
              {liveCheck === null ? (
                'Chưa kiểm tra'
              ) : liveCheck.connected ? (
                <span className="status-ok">🟢 Đã kết nối ({liveCheck.latencyMs}ms)</span>
              ) : (
                <span style={{ color: '#ef4444' }}>🔴 {liveCheck.error}</span>
              )}
            </span>
            <button onClick={() => void handleTestConnection()} style={{ padding: '3px 8px' }}>
              Kiểm tra ngay
            </button>
          </div>
          <small style={{ marginTop: 4, display: 'block', color: 'var(--text-dim)' }}>
            Endpoint: {capability.remote ? 'Cloud / Remote' : 'Cục bộ Local'} · Vision:{' '}
            {capability.vision ? 'Hỗ trợ' : 'Chưa kích hoạt'}
          </small>
        </div>

        <button className="btn-primary" onClick={close}>
          Lưu và Đóng
        </button>
      </section>
    </div>
  );
}

function Sidebar({
  project,
  edit,
  selectRegion,
  movePage,
  deletePage,
}: {
  project: MangaProject;
  edit: (fn: (value: MangaProject) => MangaProject) => void;
  selectRegion: (id: string) => void;
  movePage: (delta: number) => void;
  deletePage: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="side-heading">
        <span>Danh sách trang</span>
        <span className="count">{project.pages.length} trang</span>
      </div>

      <div className="pages-scroll">
        {!project.pages.length && (
          <div className="empty">Chưa có trang nào. Hãy bấm "+ Folder" để nạp bộ truyện.</div>
        )}
        {project.pages.map((page, index) => {
          const isSelected = page.id === project.selectedPageId;
          const statusClass =
            page.status === 'approved'
              ? 'badge-approved'
              : page.status === 'needs-review'
              ? 'badge-review'
              : page.status === 'failed'
              ? 'badge-failed'
              : 'badge-pending';
          const statusText =
            page.status === 'approved'
              ? 'Đã duyệt'
              : page.status === 'needs-review'
              ? 'Cần duyệt'
              : page.status === 'failed'
              ? 'Lỗi'
              : page.regions.length > 0
              ? `${page.regions.length} thoại`
              : 'Chờ xử lý';

          return (
            <div className={`page-item ${isSelected ? 'selected' : ''}`} key={page.id}>
              <button
                className="page-select"
                onClick={() => {
                  edit((val) => ({ ...val, selectedPageId: page.id }));
                  selectRegion(page.regions[0]?.id ?? '');
                }}
              >
                <img src={page.sourceUrl} alt={page.fileName} />
                <div className="page-meta">
                  <div className="page-title">Trang {index + 1}</div>
                  <small className="file-name">{page.fileName}</small>
                  <span className={`badge-status ${statusClass}`}>{statusText}</span>
                </div>
              </button>

              {isSelected && (
                <div className="page-micro-actions">
                  <button onClick={() => movePage(-1)} title="Đẩy trang lên trên">
                    ▲ Lên
                  </button>
                  <button onClick={() => movePage(1)} title="Đẩy trang xuống dưới">
                    ▼ Xuống
                  </button>
                  <button className="danger" onClick={deletePage} title="Xóa trang này">
                    ✕ Xóa
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function Editor({
  page,
  region,
  edit,
  remove,
}: {
  page: MangaPage;
  region: TextRegion;
  edit: (fn: (value: MangaProject) => MangaProject) => void;
  remove: () => void;
}) {
  const issues = diagnoseLayout(page).filter((issue) => issue.regionId === region.id);
  const update = (fn: (value: TextRegion) => TextRegion) =>
    edit((value) => ({
      ...value,
      pages: value.pages.map((item) =>
        item.id === page.id
          ? {
              ...item,
              regions: item.regions.map((part) => (part.id === region.id ? fn(part) : part)),
            }
          : item
      ),
    }));

  return (
    <div className="editor-form">
      <label>
        Nội dung gốc (Vision AI nhận diện)
        <textarea
          value={region.sourceText}
          placeholder="Chữ tiếng Nhật trong bong bóng..."
          onChange={(e) => update((v) => ({ ...v, sourceText: e.target.value }))}
        />
      </label>

      <label>
        Bản dịch Tiếng Việt
        <textarea
          value={region.translation}
          placeholder="Nhập hoặc sửa câu dịch tiếng Việt..."
          onChange={(e) =>
            update((v) => ({ ...v, translation: e.target.value, status: 'needs-review' }))
          }
        />
      </label>

      <div className="grid-fields">
        <label>
          Cỡ chữ (px)
          <input
            type="number"
            min="10"
            max="60"
            value={region.fontSize ?? 22}
            onChange={(e) => update((v) => ({ ...v, fontSize: Number(e.target.value) }))}
          />
        </label>
        <label>
          Màu chữ
          <div className="color-picker-row">
            <input
              type="color"
              value={region.textColor ?? '#111827'}
              onChange={(e) => update((v) => ({ ...v, textColor: e.target.value }))}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              {region.textColor ?? '#111827'}
            </span>
          </div>
        </label>
      </div>

      <div className="grid-fields">
        {(['x', 'y', 'width', 'height'] as const).map((key) => (
          <label key={key}>
            Tọa độ {key.toUpperCase()} (%)
            <input
              type="number"
              min="0"
              max="100"
              value={region[key]}
              onChange={(e) => update((v) => ({ ...v, [key]: Number(e.target.value) }))}
            />
          </label>
        ))}
      </div>

      <label>
        Trạng thái duyệt
        <select
          value={region.status}
          onChange={(e) => update((v) => ({ ...v, status: e.target.value as TextRegion['status'] }))}
        >
          <option value="needs-review">Cần duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="pending">Chờ xử lý</option>
        </select>
      </label>

      <button className="danger" onClick={remove}>
        🗑 Xóa vùng thoại này
      </button>

      {issues.length > 0 && (
        <div className="layout-issues">
          <b>Cảnh báo dàn chữ:</b>
          {issues.map((issue) => (
            <div className={`layout-issue ${issue.severity}`} key={`${issue.kind}-${issue.regionId}`}>
              {issue.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
