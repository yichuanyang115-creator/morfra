import { create } from "zustand";
import { nanoid } from "nanoid";
import { DEFAULT_SOURCES, type Project } from "../types/models";
import type { ProjectSnapshot } from "../types/domain";
import type { SchemaTemplate } from "../types/templates";
import { ensureDir, listDirNames, removeDir } from "../lib/fs";
import { projectDir, projectsRootDir } from "../lib/paths";
import { closeStorageProject, createStorageTable, createStorageView, deleteStorageTable, deleteStorageView, duplicateStorageView, isTauriRuntime, renameStorageProject, renameStorageTable, renameStorageView, reorderStorageTables, reorderStorageViews, restoreDeletedStorageTable, undoStorageChange, } from "../lib/ipc/storageClient";
import { loadRecentProjects, removeRecentProject as removeRecentRecord, touchRecentProject } from "../lib/recentProjects";
import { deleteTableWithLifecycle } from "../lib/tableLifecycleEvents";
import { createDefaultLegacyProject, createStorageProjectFromName, initLegacySchema, legacySchemaForTemplate, loadLegacyProject, loadStorageProjects, openStorageProjectAt, reorderRecentProjects, saveLegacyProject, updateProjectSnapshot } from "./projectStoreHelpers";

export interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
  loaded: boolean;
  initializing: boolean;
  error: boolean;
  canUndo: boolean;
  init: () => Promise<void>;
  switchProject: (id: string) => Promise<void>;
  openProject: (path: string) => Promise<void>;
  createProject: (name: string, template?: SchemaTemplate) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  removeRecentProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  closeProject: () => Promise<void>;
  createTable: (name: string) => Promise<void>;
  renameTable: (tableId: string, name: string) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;
  reorderTables: (tableIds: string[]) => Promise<void>;
  createView: (tableId: string, name: string, viewType: "table" | "board") => Promise<void>;
  renameView: (viewId: string, name: string) => Promise<void>;
  duplicateView: (viewId: string, name: string) => Promise<void>;
  deleteView: (viewId: string) => Promise<void>;
  reorderViews: (tableId: string, viewIds: string[]) => Promise<void>;
  undoStorageChange: () => Promise<void>;
}

function replaceCurrentSnapshot(set: (partial: Partial<ProjectState>) => void, get: () => ProjectState, snapshot: ProjectSnapshot): void {
  const currentId = get().currentProjectId;
  if (!currentId) return;
  set({ projects: updateProjectSnapshot(get().projects, currentId, snapshot) });
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  loaded: false,
  initializing: false,
  error: false,
  canUndo: false,

  init: async () => {
    if (get().loaded || get().initializing) return;
    set({ initializing: true, error: false });
    try {
      if (isTauriRuntime()) {
        const projects = await loadStorageProjects();
        set({ projects, currentProjectId: projects[0]?.id ?? null, loaded: true, initializing: false, canUndo: false });
        return;
      }
      const root = await projectsRootDir();
      await ensureDir(root);
      const ids = await listDirNames(root);
      const loaded = await Promise.all(ids.map((id) => loadLegacyProject(id).catch(() => null)));
      let projects = loaded.filter((project): project is Project => project !== null);
      if (projects.length === 0) projects = [await createDefaultLegacyProject()];
      set({ projects, currentProjectId: projects[0].id, loaded: true, initializing: false, canUndo: false });
    } catch {
      set({ initializing: false, error: true });
    }
  },

  switchProject: async (id) => {
    const target = get().projects.find((project) => project.id === id);
    if (!target) return;
    if (isTauriRuntime() && target.storagePath) {
      const project = await openStorageProjectAt(target.storagePath);
      const recent = await loadRecentProjects();
      const projects = await reorderRecentProjects(get().projects.map((item) => item.id === id ? project : item), recent);
      set({ projects, currentProjectId: project.id, canUndo: false });
      return;
    }
    set({ currentProjectId: id, canUndo: false });
  },

  openProject: async (path) => {
    if (!isTauriRuntime()) return;
    const project = await openStorageProjectAt(path);
    const existing = get().projects.filter((item) => item.id !== project.id);
    const projects = await reorderRecentProjects([project, ...existing], await loadRecentProjects());
    set({ projects, currentProjectId: project.id, canUndo: false });
  },

  createProject: async (name, template) => {
    if (isTauriRuntime()) {
      const project = await createStorageProjectFromName(name, template?.id === "reqflow" ? "requirements" : undefined);
      set({ projects: [project, ...get().projects], currentProjectId: project.id, canUndo: false });
      return;
    }
    const project: Project = { id: nanoid(), name: name.trim(), sources: DEFAULT_SOURCES };
    await saveLegacyProject(project);
    await initLegacySchema(project.id, legacySchemaForTemplate(template));
    set({ projects: [...get().projects, project], currentProjectId: project.id, canUndo: false });
  },

  renameProject: async (id, name) => {
    if (isTauriRuntime()) {
      const target = get().projects.find((project) => project.id === id);
      if (!target?.storagePath) return;
      if (get().currentProjectId !== id) await get().switchProject(id);
      const snapshot = await renameStorageProject(name);
      replaceCurrentSnapshot(set, get, snapshot);
      await touchRecentProject({ id, path: target.storagePath, name: snapshot.manifest.name });
      return;
    }
    const project = get().projects.find((item) => item.id === id);
    if (!project) return;
    const updated = { ...project, name: name.trim() };
    await saveLegacyProject(updated);
    set({ projects: get().projects.map((item) => item.id === id ? updated : item) });
  },

  removeRecentProject: async (id) => {
    if (!isTauriRuntime()) return;
    const remaining = get().projects.filter((project) => project.id !== id);
    await removeRecentRecord(id);
    if (get().currentProjectId !== id) {
      set({ projects: remaining, canUndo: false });
      return;
    }
    const next = remaining[0];
    if (!next?.storagePath) {
      await closeStorageProject();
      set({ projects: remaining, currentProjectId: null, canUndo: false });
      return;
    }
    const project = await openStorageProjectAt(next.storagePath);
    set({ projects: [project, ...remaining.slice(1)], currentProjectId: project.id, canUndo: false });
  },

  deleteProject: async (id) => {
    if (isTauriRuntime()) {
      await get().removeRecentProject(id);
      return;
    }
    const { projects, currentProjectId } = get();
    if (projects.length <= 1) return;
    await removeDir(await projectDir(id));
    const remaining = projects.filter((project) => project.id !== id);
    set({ projects: remaining, currentProjectId: currentProjectId === id ? remaining[0].id : currentProjectId });
  },

  closeProject: async () => {
    if (isTauriRuntime()) await closeStorageProject();
    set({ currentProjectId: null, canUndo: false });
  },

  createTable: async (name) => {
    if (!isTauriRuntime()) return;
    replaceCurrentSnapshot(set, get, await createStorageTable(name));
    set({ canUndo: true });
  },

  renameTable: async (tableId, name) => {
    if (!isTauriRuntime()) return;
    replaceCurrentSnapshot(set, get, await renameStorageTable(tableId, name));
  },

  deleteTable: async (tableId) => {
    if (!isTauriRuntime()) return;
    const snapshot = await deleteTableWithLifecycle(tableId, () => deleteStorageTable(tableId), async () => { await restoreDeletedStorageTable(tableId); });
    replaceCurrentSnapshot(set, get, snapshot);
    set({ canUndo: true });
  },

  reorderTables: async (tableIds) => {
    if (!isTauriRuntime()) return;
    replaceCurrentSnapshot(set, get, await reorderStorageTables(tableIds));
  },

  createView: async (tableId, name, viewType) => {
    if (!isTauriRuntime()) return;
    replaceCurrentSnapshot(set, get, await createStorageView(tableId, name, viewType));
  },

  renameView: async (viewId, name) => {
    if (!isTauriRuntime()) return;
    replaceCurrentSnapshot(set, get, await renameStorageView(viewId, name));
  },

  duplicateView: async (viewId, name) => {
    if (!isTauriRuntime()) return;
    replaceCurrentSnapshot(set, get, await duplicateStorageView(viewId, name));
  },

  deleteView: async (viewId) => {
    if (!isTauriRuntime()) return;
    replaceCurrentSnapshot(set, get, await deleteStorageView(viewId));
  },

  reorderViews: async (tableId, viewIds) => {
    if (!isTauriRuntime()) return;
    replaceCurrentSnapshot(set, get, await reorderStorageViews(tableId, viewIds));
  },

  undoStorageChange: async () => {
    if (!isTauriRuntime()) return;
    replaceCurrentSnapshot(set, get, await undoStorageChange());
    set({ canUndo: false });
  },
}));

export function currentProject(state: ProjectState): Project | null {
  return state.projects.find((project) => project.id === state.currentProjectId) ?? null;
}
