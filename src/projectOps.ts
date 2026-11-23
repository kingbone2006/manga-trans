import { MangaPage, MangaProject, sanitizeFileName } from './model';

export function renameProject(project: MangaProject, name: string): MangaProject {
  const next = sanitizeFileName(name, 'Project chưa đặt tên');
  return { ...project, name: next };
}

export function reorderPages(project: MangaProject, from: number, to: number): MangaProject {
  if (from < 0 || to < 0 || from >= project.pages.length || to >= project.pages.length || from === to) return project;
  const pages = [...project.pages];
  const [page] = pages.splice(from, 1);
  pages.splice(to, 0, page!);
  return { ...project, pages: pages.map((item, order) => ({ ...item, order })) };
}

export function removePage(project: MangaProject, pageId: string): MangaProject {
  const pages = project.pages.filter((page) => page.id !== pageId).map((page, order) => ({ ...page, order }));
  const selectedPageId = project.selectedPageId === pageId ? (pages[0]?.id ?? null) : project.selectedPageId;
  return { ...project, pages, selectedPageId };
}

export function setProjectSourceLanguage(project: MangaProject, sourceLanguage: string | null): MangaProject {
  return { ...project, sourceLanguage: sourceLanguage?.trim() || null };
}

export function setPageSourceLanguage(project: MangaProject, pageId: string, sourceLanguage: string | null): MangaProject {
  return { ...project, pages: project.pages.map((page) => page.id === pageId ? { ...page, sourceLanguage: sourceLanguage?.trim() || null } : page) };
}

export function templateFileName(template: string, project: MangaProject, page: MangaPage, index: number, extension?: string): string {
  const ext = (extension ?? page.fileName.split('.').pop() ?? 'png').toLowerCase();
  const sourceName = page.fileName.replace(/\.[^.]+$/, '');
  const replace = template.replace(/\{(index|page|project|chapter|source_name|lang|ext)(?::(0+))?\}/g, (_match, key: string, padding?: string) => {
    const value = key === 'index' ? index : key === 'page' ? index + 1 : key === 'project' ? project.name : key === 'source_name' ? sourceName : key === 'lang' ? project.targetLanguage.toLowerCase() : key === 'ext' ? ext : '001';
    return typeof value === 'number' && padding ? String(value).padStart(padding.length, '0') : String(value);
  });
  return `${sanitizeFileName(replace, `${String(index + 1).padStart(3, '0')}.${ext}`)}`;
}

export function exportablePages(project: MangaProject): { pages: MangaPage[]; blocked: MangaPage[] } {
  const pages = project.pages.filter((page) => page.status === 'approved' && !page.error);
  const blocked = project.pages.filter((page) => !pages.includes(page));
  return { pages, blocked };
}
