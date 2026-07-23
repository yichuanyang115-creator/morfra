import { create } from "zustand";
import { nanoid } from "nanoid";
import type { AcceptanceCriterion, Comment, Deliverable, Requirement, Stage, Task, TransitionRecord } from "../types/models";
import { ensureDir, listFileNames } from "../lib/fs";
import { projectDir } from "../lib/paths";
import { todayIso } from "../lib/dates";
import { loadRequirement, saveRequirement } from "./requirementPersistence";

type EditableField = "name" | "priority" | "source" | "assignee" | "deadline" | "progress" | "releaseMethod" | "releaseDate";

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
  addAcceptance: (projectId: string, requirementId: string, desc: string) => Promise<void>;
  updateAcceptance: (
    projectId: string,
    requirementId: string,
    acceptanceId: string,
    patch: Partial<Pick<AcceptanceCriterion, "desc" | "result" | "failNote">>,
  ) => Promise<void>;
  removeAcceptance: (projectId: string, requirementId: string, acceptanceId: string) => Promise<void>;
  transitionRequirement: (
    projectId: string,
    requirementId: string,
    toStage: Stage,
    opts?: { abandoned?: boolean },
  ) => Promise<void>;
  updateTransitionNote: (projectId: string, requirementId: string, transitionId: string, note: string) => Promise<void>;
  addComment: (projectId: string, requirementId: string, transitionId: string, content: string) => Promise<void>;
  removeTransition: (projectId: string, requirementId: string, transitionId: string) => Promise<void>;
}

type Get = () => RequirementState;
type Set = (fn: (state: RequirementState) => Partial<RequirementState>) => void;

async function mutateRequirement(
  get: Get,
  set: Set,
  projectId: string,
  requirementId: string,
  transform: (requirement: Requirement) => Requirement,
): Promise<void> {
  const requirement = get().requirements.find((r) => r.id === requirementId);
  if (!requirement) return;
  const updated = transform(requirement);
  await saveRequirement(projectId, updated);
  set((state) => ({
    requirements: state.requirements.map((r) => (r.id === requirementId ? updated : r)),
  }));
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
      releaseMethod: "",
      releaseDate: "",
      body: "",
      deliverables: [],
      tasks: [],
      acceptance: [],
      transitions: [],
      comments: [],
    };
    await saveRequirement(projectId, requirement);
    set((state) => ({ requirements: [...state.requirements, requirement] }));
  },

  updateField: (projectId, requirementId, field, value) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({ ...r, [field]: value })),

  updateBody: (projectId, requirementId, body) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({ ...r, body })),

  addDeliverable: (projectId, requirementId, name) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => {
      const deliverable: Deliverable = { id: nanoid(), name, checked: false, attach: null, createdAt: new Date().toISOString() };
      return { ...r, deliverables: [...r.deliverables, deliverable] };
    }),

  updateDeliverable: (projectId, requirementId, deliverableId, patch) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      deliverables: r.deliverables.map((d) => (d.id === deliverableId ? { ...d, ...patch } : d)),
    })),

  removeDeliverable: (projectId, requirementId, deliverableId) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      deliverables: r.deliverables.filter((d) => d.id !== deliverableId),
    })),

  addTask: (projectId, requirementId, task) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => {
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
      return { ...r, tasks: [...r.tasks, newTask] };
    }),

  updateTask: (projectId, requirementId, taskId, patch) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      tasks: r.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    })),

  removeTask: (projectId, requirementId, taskId) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      tasks: r.tasks.filter((t) => t.id !== taskId),
    })),

  addAcceptance: (projectId, requirementId, desc) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => {
      const criterion: AcceptanceCriterion = {
        id: nanoid(),
        desc,
        result: "unverified",
        failNote: "",
        createdAt: new Date().toISOString(),
      };
      return { ...r, acceptance: [...r.acceptance, criterion] };
    }),

  updateAcceptance: (projectId, requirementId, acceptanceId, patch) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      acceptance: r.acceptance.map((a) => (a.id === acceptanceId ? { ...a, ...patch } : a)),
    })),

  removeAcceptance: (projectId, requirementId, acceptanceId) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      acceptance: r.acceptance.filter((a) => a.id !== acceptanceId),
    })),

  transitionRequirement: (projectId, requirementId, toStage, opts) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => {
      const abandoned = opts?.abandoned ?? false;
      const targetStage: Stage = abandoned ? "archive" : toStage;
      const record: TransitionRecord = {
        id: nanoid(),
        from: r.stage,
        to: targetStage,
        timestamp: new Date().toISOString(),
        by: "我",
        note: "",
      };
      const closureType: Requirement["closureType"] = abandoned ? "abandoned" : targetStage === "archive" ? "completed" : null;
      // 恢复：从归档流转回活跃阶段时进度清零（Product-Spec §6.3）
      const restoringFromArchive = r.stage === "archive" && targetStage !== "archive";
      const progress = restoringFromArchive ? null : r.progress;
      // 发布时间默认当前日期（Product-Spec FLOW-006 边界情况），仅在尚未填写时补默认值
      const releaseDate = targetStage === "release" && !r.releaseDate ? todayIso() : r.releaseDate;
      return { ...r, stage: targetStage, closureType, progress, releaseDate, transitions: [...r.transitions, record] };
    }),

  updateTransitionNote: (projectId, requirementId, transitionId, note) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      transitions: r.transitions.map((t) => (t.id === transitionId ? { ...t, note } : t)),
    })),

  addComment: (projectId, requirementId, transitionId, content) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => {
      const comment: Comment = { id: nanoid(), transitionId, content, timestamp: new Date().toISOString() };
      return { ...r, comments: [...r.comments, comment] };
    }),

  removeTransition: (projectId, requirementId, transitionId) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      transitions: r.transitions.filter((t) => t.id !== transitionId),
      comments: r.comments.filter((c) => c.transitionId !== transitionId),
    })),
}));
