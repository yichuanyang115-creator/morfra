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
  reorderManually: (projectId: string, updates: { requirementId: string; manualOrder: number }[]) => Promise<void>;
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

      // 单个需求文件解析失败（如手动损坏了某个 .md）不该拖垮整批需求的显示，逐个隔离捕获、跳过坏文件
      const loaded = await Promise.all(
        fileNames.map((name) =>
          loadRequirement(projectId, name).catch(() => null),
        ),
      );
      const requirements = loaded.filter((r): r is Requirement => r !== null);

      set({ requirements, loadedProjectId: projectId, loading: false });
    } catch {
      set({ loadedProjectId: projectId, loading: false, error: true });
    }
  },

  createRequirement: async (projectId, stage, name) => {
    // 新建置顶：manualOrder 落到该阶段现有最小值之前，手动模式下新建的需求排在最前面
    const existingInStage = get().requirements.filter((r) => r.stage === stage);
    const minOrder = existingInStage.reduce((min, r) => Math.min(min, r.manualOrder), 0);
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
      manualOrder: minOrder - 1,
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
      // 换阶段后 manualOrder 是老阶段的值，跟目标阶段已有值不是同一套参照系，
      // 落到目标阶段最小值之前，跟新建置顶体感一致（Product-Spec REQ-001 §426）
      const existingInTarget = get().requirements.filter((req) => req.stage === targetStage && req.id !== r.id);
      const minOrder = existingInTarget.reduce((min, req) => Math.min(min, req.manualOrder), 0);
      const manualOrder = targetStage !== "archive" ? minOrder - 1 : r.manualOrder;
      return { ...r, stage: targetStage, closureType, progress, releaseDate, manualOrder, transitions: [...r.transitions, record] };
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

  reorderManually: async (projectId, updates) => {
    const byId = new Map(updates.map((u) => [u.requirementId, u.manualOrder]));
    const current = get().requirements;
    const updated = current.map((r) => (byId.has(r.id) ? { ...r, manualOrder: byId.get(r.id)! } : r));
    await Promise.all(
      updated.filter((r) => byId.has(r.id)).map((r) => saveRequirement(projectId, r)),
    );
    set({ requirements: updated });
  },
}));
