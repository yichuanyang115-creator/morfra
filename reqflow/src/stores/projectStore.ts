import { create } from "zustand";
import { nanoid } from "nanoid";
import { DEFAULT_SOURCES, type Project } from "../types/models";
import { ensureDir, listDirNames, readFile, removeDir, writeFile } from "../lib/fs";
import { parseFrontmatter, stringifyFrontmatter } from "../lib/frontmatter";
import { projectDir, projectMetaPath, projectsRootDir, schemaPath } from "../lib/paths";
import { blankSchema, legacyEquivalentSchema, schemaFromSnapshot } from "../lib/schemaDefaults";
import type { SchemaTemplate } from "../types/templates";
import type { Schema } from "../types/schema";
import {
  closeStorageProject,
  createStorageProject,
  createStorageTable,
  isTauriRuntime,
  openStorageProject,
  undoStorageChange,
} from "../lib/ipc/storageClient";
import type { ProjectSnapshot } from "../types/domain";

const DEFAULT_PROJECT_NAME = "默认项目";

interface ProjectFrontmatter {
  id: string;
  name: string;
  sources?: string[];
}

interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
  loaded: boolean;
  initializing: boolean;
  error: boolean;
  init: () => Promise<void>;
  switchProject: (id: string) => Promise<void>;
  createProject: (name: string, template?: SchemaTemplate) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  closeProject: () => Promise<void>;
  createTable: (name: string) => Promise<void>;
  undoStorageChange: () => Promise<void>;
}

async function loadProject(id: string): Promise<Project | null> {
  const metaPath = await projectMetaPath(id);
  const raw = await readFile(metaPath);
  if (raw === null) return null;
  const { data } = parseFrontmatter<ProjectFrontmatter>(raw);
  return { id: data.id ?? id, name: data.name ?? id, sources: data.sources ?? DEFAULT_SOURCES };
}

async function saveProject(project: Project): Promise<void> {
  const dir = await projectDir(project.id);
  await ensureDir(dir);
  const metaPath = await projectMetaPath(project.id);
  const frontmatter: ProjectFrontmatter = { id: project.id, name: project.name, sources: project.sources };
  await writeFile(metaPath, stringifyFrontmatter(frontmatter, ""));
}

/** 新建项目时同步写入完整 Schema：空白项目与模板项目都不依赖后续迁移补齐。 */
async function initSchema(projectId: string, schema: Schema): Promise<void> {
  const path = await schemaPath(projectId);
  await writeFile(path, JSON.stringify(schema, null, 2));
}

async function createDefaultProject(): Promise<Project> {
  const project: Project = { id: nanoid(), name: DEFAULT_PROJECT_NAME, sources: DEFAULT_SOURCES };
  await saveProject(project);
  await initSchema(project.id, legacyEquivalentSchema(project.sources));
  return project;
}

function storageProject(folderId: string, snapshot: ProjectSnapshot): Project {
  return {
    id: folderId,
    name: snapshot.manifest.name,
    sources: [],
    storageSnapshot: snapshot,
  };
}

async function createStorageProjectFromName(name: string): Promise<Project> {
  const folderId = nanoid();
  const path = await projectDir(folderId);
  const snapshot = await createStorageProject({ path, name });
  return storageProject(folderId, snapshot);
}

async function loadStorageProjects(): Promise<Project[]> {
  const root = await projectsRootDir();
  await ensureDir(root);
  const folderIds = await listDirNames(root);
  const projects: Project[] = [];

  for (const folderId of folderIds) {
    try {
      const snapshot = await openStorageProject(await projectDir(folderId));
      projects.push(storageProject(folderId, snapshot));
    } catch {
      // 旧 Markdown 项目或损坏的 Morfra 包不进入 v3 项目列表，避免把坏项目当成空项目。
    }
  }

  if (projects.length === 0) {
    projects.push(await createStorageProjectFromName(DEFAULT_PROJECT_NAME));
  } else {
    // 启动扫描按顺序打开多个项目，最后一次 IPC 会留下最后一个 active_project；
    // 当前 UI 默认展示第一个项目，因此必须把 Rust 会话重新对齐到它。
    const firstProject = projects[0];
    const snapshot = await openStorageProject(await projectDir(firstProject.id));
    projects[0] = { ...firstProject, name: snapshot.manifest.name, storageSnapshot: snapshot };
  }
  return projects;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  loaded: false,
  initializing: false,
  error: false,

  init: async () => {
    if (get().loaded || get().initializing) return;
    set({ initializing: true, error: false });

    try {
      if (isTauriRuntime()) {
        const projects = await loadStorageProjects();
        set({ projects, currentProjectId: projects[0].id, loaded: true, initializing: false });
        return;
      }

      const root = await projectsRootDir();
      await ensureDir(root);
      const ids = await listDirNames(root);

      // 单个项目元数据解析失败不该拖垮整个项目列表，逐个隔离捕获、跳过坏项目
      const loaded = await Promise.all(ids.map((id) => loadProject(id).catch(() => null)));
      let projects = loaded.filter((p): p is Project => p !== null);

      if (projects.length === 0) {
        const defaultProject = await createDefaultProject();
        projects = [defaultProject];
      }

      set({ projects, currentProjectId: projects[0].id, loaded: true, initializing: false });
    } catch {
      set({ initializing: false, error: true });
    }
  },

  switchProject: async (id) => {
    if (get().projects.some((p) => p.id === id)) {
      if (isTauriRuntime()) {
        const snapshot = await openStorageProject(await projectDir(id));
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id ? { ...project, name: snapshot.manifest.name, storageSnapshot: snapshot } : project,
          ),
        }));
      }
      set({ currentProjectId: id });
    }
  },

  createProject: async (name, template) => {
    if (isTauriRuntime()) {
      const project = await createStorageProjectFromName(name);
      set((state) => ({
        projects: [...state.projects, project],
        currentProjectId: project.id,
      }));
      return;
    }

    const project: Project = { id: nanoid(), name, sources: DEFAULT_SOURCES };
    await saveProject(project);
    await initSchema(project.id, template ? schemaFromSnapshot(template.schemaSnapshot) : blankSchema());
    set((state) => ({
      projects: [...state.projects, project],
      currentProjectId: project.id,
    }));
  },

  renameProject: async (id, name) => {
    if (isTauriRuntime()) {
      throw new Error("Morfra 项目重命名将在项目管理阶段接入");
    }
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;
    const updated: Project = { ...project, name };
    await saveProject(updated);
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? updated : p)),
    }));
  },

  deleteProject: async (id) => {
    const { projects, currentProjectId } = get();
    if (projects.length <= 1) return;

    if (isTauriRuntime() && currentProjectId === id) {
      await closeStorageProject();
    }
    const dir = await projectDir(id);
    await removeDir(dir);

    const remaining = projects.filter((p) => p.id !== id);
    set({
      projects: remaining,
      currentProjectId: currentProjectId === id ? remaining[0].id : currentProjectId,
    });
  },

  closeProject: async () => {
    if (!isTauriRuntime()) return;
    await closeStorageProject();
    set({ currentProjectId: null });
  },

  createTable: async (name) => {
    if (!isTauriRuntime()) return;
    const snapshot = await createStorageTable(name);
    const currentProjectId = get().currentProjectId;
    if (!currentProjectId) return;
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === currentProjectId ? { ...project, storageSnapshot: snapshot } : project,
      ),
    }));
  },

  undoStorageChange: async () => {
    if (!isTauriRuntime()) return;
    const snapshot = await undoStorageChange();
    const currentProjectId = get().currentProjectId;
    if (!currentProjectId) return;
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === currentProjectId ? { ...project, storageSnapshot: snapshot } : project,
      ),
    }));
  },
}));

export function currentProject(state: ProjectState): Project | null {
  return state.projects.find((p) => p.id === state.currentProjectId) ?? null;
}
