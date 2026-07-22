import { create } from "zustand";
import { nanoid } from "nanoid";
import { DEFAULT_SOURCES, type Project } from "../types/models";
import { ensureDir, listDirNames, readFile, removeDir, writeFile } from "../lib/fs";
import { parseFrontmatter, stringifyFrontmatter } from "../lib/frontmatter";
import { projectDir, projectMetaPath, projectsRootDir } from "../lib/paths";

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
  init: () => Promise<void>;
  switchProject: (id: string) => void;
  createProject: (name: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addSource: (projectId: string, source: string) => Promise<void>;
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

async function createDefaultProject(): Promise<Project> {
  const project: Project = { id: nanoid(), name: DEFAULT_PROJECT_NAME, sources: DEFAULT_SOURCES };
  await saveProject(project);
  return project;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  loaded: false,
  initializing: false,

  init: async () => {
    if (get().loaded || get().initializing) return;
    set({ initializing: true });

    const root = await projectsRootDir();
    await ensureDir(root);
    const ids = await listDirNames(root);

    const loaded = await Promise.all(ids.map(loadProject));
    let projects = loaded.filter((p): p is Project => p !== null);

    if (projects.length === 0) {
      const defaultProject = await createDefaultProject();
      projects = [defaultProject];
    }

    set({ projects, currentProjectId: projects[0].id, loaded: true, initializing: false });
  },

  switchProject: (id) => {
    if (get().projects.some((p) => p.id === id)) {
      set({ currentProjectId: id });
    }
  },

  createProject: async (name) => {
    const project: Project = { id: nanoid(), name, sources: DEFAULT_SOURCES };
    await saveProject(project);
    set((state) => ({
      projects: [...state.projects, project],
      currentProjectId: project.id,
    }));
  },

  renameProject: async (id, name) => {
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

    const dir = await projectDir(id);
    await removeDir(dir);

    const remaining = projects.filter((p) => p.id !== id);
    set({
      projects: remaining,
      currentProjectId: currentProjectId === id ? remaining[0].id : currentProjectId,
    });
  },

  addSource: async (projectId, source) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project || project.sources.includes(source)) return;
    const updated: Project = { ...project, sources: [...project.sources, source] };
    await saveProject(updated);
    set((state) => ({
      projects: state.projects.map((p) => (p.id === projectId ? updated : p)),
    }));
  },
}));

export function currentProject(state: ProjectState): Project | null {
  return state.projects.find((p) => p.id === state.currentProjectId) ?? null;
}
