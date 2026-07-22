import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Deliverable, Priority, Requirement, Stage, Task } from "../types/models";
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
  deliverables: Deliverable[];
  tasks: Task[];
}

type EditableField = "name" | "priority" | "source" | "assignee" | "deadline" | "progress";

interface RequirementState {
  requirements: Requirement[];
  loadedProjectId: string | null;
  loading: boolean;
  error: boolean;
  loadForProject: (projectId: string) => Promise<void>;
  createRequirement: (projectId: string, stage: Stage, name: string) => Promise<void>;
  updateField: (
    projectId: string,
    requirementId: string,
    field: EditableField,
    value: Requirement[EditableField],
  ) => Promise<void>;
  updateBody: (projectId: string, requirementId: string, body: string) => Promise<void>;
  addDeliverable: (projectId: string, requirementId: string, name: string) => Promise<void>;
  updateDeliverable: (
    projectId: string,
    requirementId: string,
    deliverableId: string,
    patch: Partial<Pick<Deliverable, "name" | "checked" | "attach">>,
  ) => Promise<void>;
  removeDeliverable: (projectId: string, requirementId: string, deliverableId: string) => Promise<void>;
  addTask: (
    projectId: string,
    requirementId: string,
    task: Pick<Task, "name" | "assignee" | "deadline" | "progress">,
  ) => Promise<void>;
  updateTask: (
    projectId: string,
    requirementId: string,
    taskId: string,
    patch: Partial<Pick<Task, "name" | "assignee" | "deadline" | "progress" | "status" | "blocked" | "blockNote">>,
  ) => Promise<void>;
  removeTask: (projectId: string, requirementId: string, taskId: string) => Promise<void>;
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
    deliverables: r.deliverables,
    tasks: r.tasks,
  };
}

function fromFrontmatter(data: RequirementFrontmatter, fallbackId: string, body: string): Requirement {
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
    body,
    deliverables: data.deliverables ?? [],
    tasks: data.tasks ?? [],
  };
}

async function loadRequirement(projectId: string, fileName: string): Promise<Requirement | null> {
  const id = fileName.replace(/\.md$/, "");
  const path = await requirementPath(projectId, id);
  const raw = await readFile(path);
  if (raw === null) return null;
  const { data, content } = parseFrontmatter<RequirementFrontmatter>(raw);
  return fromFrontmatter(data, id, content);
}

async function saveRequirement(projectId: string, requirement: Requirement): Promise<void> {
  const path = await requirementPath(projectId, requirement.id);
  await writeFile(path, stringifyFrontmatter(toFrontmatter(requirement), requirement.body));
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
      body: "",
      deliverables: [],
      tasks: [],
    };
    await saveRequirement(projectId, requirement);
    set((state) => ({ requirements: [...state.requirements, requirement] }));
  },

  updateField: async (projectId, requirementId, field, value) => {
    const requirement = get().requirements.find((r) => r.id === requirementId);
    if (!requirement) return;
    const updated: Requirement = { ...requirement, [field]: value };
    await saveRequirement(projectId, updated);
    set((state) => ({
      requirements: state.requirements.map((r) => (r.id === requirementId ? updated : r)),
    }));
  },

  updateBody: async (projectId, requirementId, body) => {
    const requirement = get().requirements.find((r) => r.id === requirementId);
    if (!requirement) return;
    const updated: Requirement = { ...requirement, body };
    await saveRequirement(projectId, updated);
    set((state) => ({
      requirements: state.requirements.map((r) => (r.id === requirementId ? updated : r)),
    }));
  },

  addDeliverable: async (projectId, requirementId, name) => {
    const requirement = get().requirements.find((r) => r.id === requirementId);
    if (!requirement) return;
    const deliverable: Deliverable = {
      id: nanoid(),
      name,
      checked: false,
      attach: null,
      createdAt: new Date().toISOString(),
    };
    const updated: Requirement = { ...requirement, deliverables: [...requirement.deliverables, deliverable] };
    await saveRequirement(projectId, updated);
    set((state) => ({
      requirements: state.requirements.map((r) => (r.id === requirementId ? updated : r)),
    }));
  },

  updateDeliverable: async (projectId, requirementId, deliverableId, patch) => {
    const requirement = get().requirements.find((r) => r.id === requirementId);
    if (!requirement) return;
    const updated: Requirement = {
      ...requirement,
      deliverables: requirement.deliverables.map((d) => (d.id === deliverableId ? { ...d, ...patch } : d)),
    };
    await saveRequirement(projectId, updated);
    set((state) => ({
      requirements: state.requirements.map((r) => (r.id === requirementId ? updated : r)),
    }));
  },

  removeDeliverable: async (projectId, requirementId, deliverableId) => {
    const requirement = get().requirements.find((r) => r.id === requirementId);
    if (!requirement) return;
    const updated: Requirement = {
      ...requirement,
      deliverables: requirement.deliverables.filter((d) => d.id !== deliverableId),
    };
    await saveRequirement(projectId, updated);
    set((state) => ({
      requirements: state.requirements.map((r) => (r.id === requirementId ? updated : r)),
    }));
  },

  addTask: async (projectId, requirementId, task) => {
    const requirement = get().requirements.find((r) => r.id === requirementId);
    if (!requirement) return;
    const newTask: Task = {
      id: nanoid(),
      name: task.name,
      assignee: task.assignee,
      deadline: task.deadline,
      progress: task.progress,
      status: "todo",
      blocked: false,
      blockNote: "",
      createdAt: new Date().toISOString(),
    };
    const updated: Requirement = { ...requirement, tasks: [...requirement.tasks, newTask] };
    await saveRequirement(projectId, updated);
    set((state) => ({
      requirements: state.requirements.map((r) => (r.id === requirementId ? updated : r)),
    }));
  },

  updateTask: async (projectId, requirementId, taskId, patch) => {
    const requirement = get().requirements.find((r) => r.id === requirementId);
    if (!requirement) return;
    const updated: Requirement = {
      ...requirement,
      tasks: requirement.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    };
    await saveRequirement(projectId, updated);
    set((state) => ({
      requirements: state.requirements.map((r) => (r.id === requirementId ? updated : r)),
    }));
  },

  removeTask: async (projectId, requirementId, taskId) => {
    const requirement = get().requirements.find((r) => r.id === requirementId);
    if (!requirement) return;
    const updated: Requirement = {
      ...requirement,
      tasks: requirement.tasks.filter((t) => t.id !== taskId),
    };
    await saveRequirement(projectId, updated);
    set((state) => ({
      requirements: state.requirements.map((r) => (r.id === requirementId ? updated : r)),
    }));
  },
}));
