import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Priority, Requirement, Stage } from "../types/models";
import { ensureDir, listFileNames, readFile, writeFile } from "../lib/fs";
import { parseFrontmatter, stringifyFrontmatter } from "../lib/frontmatter";
import { projectDir, requirementPath } from "../lib/paths";

interface RequirementFrontmatter {
  id: string;
  name: string;
  stage: Stage;
  priority: Priority;
  source: string;
  assignee: string;
  deadline: string;
  progress: number | null;
  closureType: "completed" | "abandoned" | null;
  createdAt: string;
}

interface RequirementState {
  requirements: Requirement[];
  loadedProjectId: string | null;
  loading: boolean;
  error: boolean;
  loadForProject: (projectId: string) => Promise<void>;
  createRequirement: (projectId: string, stage: Stage, name: string) => Promise<void>;
  updateProgress: (projectId: string, requirementId: string, progress: number | null) => Promise<void>;
}

function toFrontmatter(r: Requirement): RequirementFrontmatter {
  return {
    id: r.id,
    name: r.name,
    stage: r.stage,
    priority: r.priority,
    source: r.source,
    assignee: r.assignee,
    deadline: r.deadline,
    progress: r.progress,
    closureType: r.closureType,
    createdAt: r.createdAt,
  };
}

function fromFrontmatter(data: RequirementFrontmatter, fallbackId: string): Requirement {
  return {
    id: data.id ?? fallbackId,
    name: data.name ?? "",
    stage: data.stage ?? "collect",
    priority: data.priority ?? "P2",
    source: data.source ?? "内部想法",
    assignee: data.assignee ?? "",
    deadline: data.deadline ?? "",
    progress: data.progress ?? null,
    closureType: data.closureType ?? null,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

async function loadRequirement(projectId: string, fileName: string): Promise<Requirement | null> {
  const id = fileName.replace(/\.md$/, "");
  const path = await requirementPath(projectId, id);
  const raw = await readFile(path);
  if (raw === null) return null;
  const { data } = parseFrontmatter<RequirementFrontmatter>(raw);
  return fromFrontmatter(data, id);
}

async function saveRequirement(projectId: string, requirement: Requirement): Promise<void> {
  const path = await requirementPath(projectId, requirement.id);
  await writeFile(path, stringifyFrontmatter(toFrontmatter(requirement), ""));
}

export const useRequirementStore = create<RequirementState>((set, get) => ({
  requirements: [],
  loadedProjectId: null,
  loading: false,
  error: false,

  loadForProject: async (projectId) => {
    if (get().loading) return;
    set({ loading: true, error: false });

    try {
      const dir = await projectDir(projectId);
      await ensureDir(dir);
      const fileNames = (await listFileNames(dir)).filter((name) => name.endsWith(".md") && name !== "_project.md");

      const loaded = await Promise.all(fileNames.map((name) => loadRequirement(projectId, name)));
      const requirements = loaded.filter((r): r is Requirement => r !== null);

      set({ requirements, loadedProjectId: projectId, loading: false });
    } catch {
      set({ loadedProjectId: projectId, loading: false, error: true });
    }
  },

  createRequirement: async (projectId, stage, name) => {
    const requirement: Requirement = {
      id: nanoid(),
      name,
      stage,
      priority: "P2",
      source: "内部想法",
      assignee: "",
      deadline: "",
      progress: null,
      closureType: null,
      createdAt: new Date().toISOString(),
    };
    await saveRequirement(projectId, requirement);
    set((state) => ({ requirements: [...state.requirements, requirement] }));
  },

  updateProgress: async (projectId, requirementId, progress) => {
    const requirement = get().requirements.find((r) => r.id === requirementId);
    if (!requirement) return;
    const updated: Requirement = { ...requirement, progress };
    await saveRequirement(projectId, updated);
    set((state) => ({
      requirements: state.requirements.map((r) => (r.id === requirementId ? updated : r)),
    }));
  },
}));
