import { create } from "zustand";
import { nanoid } from "nanoid";
import type { AcceptanceCriterion, Comment, Deliverable, Requirement, Stage, TabRecord, Task, TransitionRecord } from "../types/models";
import { ensureDir, listFileNames } from "../lib/fs";
import { projectDir } from "../lib/paths";
import { todayIso } from "../lib/dates";
import { FIELD_KEYS, progressOf, releaseDateOf, withAttributeValue } from "../lib/requirementFields";
import { loadRequirement, saveRequirement } from "./requirementPersistence";
import { undoStack } from "../lib/undoStack";
import { enqueueRequirementMutation, mutateRequirement, reorderRequirements } from "./requirementMutations";
import { deleteRequirement, freezeStageHistory } from "./requirementLifecycle";
import type { StageOption } from "../types/schema";

interface RequirementState {
  requirements: Requirement[];
  loadedProjectId: string | null;
  loading: boolean;
  error: boolean;
  loadForProject: (projectId: string) => Promise<void>;
  createRequirement: (projectId: string, stage: Stage, name: string) => Promise<void>;
  deleteRequirement: (projectId: string, requirementId: string) => Promise<void>;
  renameRequirement: (projectId: string, requirementId: string, name: string) => Promise<void>;
  updateAttributeValue: (projectId: string, requirementId: string, key: string, value: unknown) => Promise<void>;
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
  addTabRecord: (projectId: string, requirementId: string, tabId: string, fieldValues: Record<string, unknown>) => Promise<void>;
  updateTabRecord: (projectId: string, requirementId: string, recordId: string, fieldValues: Record<string, unknown>) => Promise<void>;
  removeTabRecord: (projectId: string, requirementId: string, recordId: string) => Promise<void>;
  transitionRequirement: (
    projectId: string,
    requirementId: string,
    toStage: Stage,
    opts?: { abandoned?: boolean },
  ) => Promise<void>;
  updateTransitionNote: (projectId: string, requirementId: string, transitionId: string, note: string) => Promise<void>;
  addComment: (projectId: string, requirementId: string, transitionId: string, content: string) => Promise<void>;
  removeTransition: (projectId: string, requirementId: string, transitionId: string) => Promise<void>;
  reorderManually: (
    projectId: string,
    updates: { requirementId: string; manualOrder: number }[],
    undoSideEffect?: () => Promise<void>,
  ) => Promise<void>;
  cascadeAttributeChange: (projectId: string, attributeId: string, transform: (value: unknown) => unknown) => Promise<void>;
  freezeStageHistory: (projectId: string, stage: StageOption) => Promise<void>;
}

export const useRequirementStore = create<RequirementState>((set, get) => ({
  requirements: [],
  loadedProjectId: null,
  loading: false,
  error: false,
  loadForProject: async (projectId) => {
    if (get().loading) return;
    // Undo 命令闭包绑定项目 id；项目切换后继续执行旧命令会静默修改不可见项目。
    undoStack.clear();
    set({ loading: true, error: false });

    try {
      const dir = await projectDir(projectId);
      await ensureDir(dir);
      const fileNames = (await listFileNames(dir)).filter(
        (name) => name.endsWith(".md") && name !== "_project.md" && name !== "_chat.md",
      );

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
  createRequirement: (projectId, stage, name) => enqueueRequirementMutation(async () => {
    const existingInStage = get().requirements.filter((r) => r.stage === stage);
    const minOrder = existingInStage.reduce((min, r) => Math.min(min, r.manualOrder), 0);
    const requirement: Requirement = {
      id: nanoid(),
      name,
      stage,
      createdAt: new Date().toISOString(),
      manualOrder: minOrder - 1,
      body: "",
      attributeValues: {
        [FIELD_KEYS.priority]: "P2",
        [FIELD_KEYS.source]: "内部想法",
        [FIELD_KEYS.assignee]: "",
        [FIELD_KEYS.deadline]: "",
        [FIELD_KEYS.progress]: null,
        [FIELD_KEYS.releaseMethod]: "",
        [FIELD_KEYS.releaseDate]: "",
        [FIELD_KEYS.result]: null,
      },
      deliverables: [],
      tasks: [],
      acceptance: [],
      tabRecords: [],
      transitions: [],
      comments: [],
    };
    await saveRequirement(projectId, requirement);
    set((state) => ({ requirements: [...state.requirements, requirement] }));
  }),
  deleteRequirement: (projectId, requirementId) => deleteRequirement(get, set, projectId, requirementId),
  renameRequirement: (projectId, requirementId, name) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({ ...r, name })),

  updateAttributeValue: (projectId, requirementId, key, value) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      attributeValues: withAttributeValue(r, key, value),
    }), "修改属性"),
  updateBody: (projectId, requirementId, body) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({ ...r, body })),
  addDeliverable: (projectId, requirementId, name) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => {
      const deliverable: Deliverable = { id: nanoid(), name, checked: false, attach: null, createdAt: new Date().toISOString() };
      return { ...r, deliverables: [...r.deliverables, deliverable] };
    }, "新建产出"),
  updateDeliverable: (projectId, requirementId, deliverableId, patch) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      deliverables: r.deliverables.map((d) => (d.id === deliverableId ? { ...d, ...patch } : d)),
    }), "修改产出"),
  removeDeliverable: (projectId, requirementId, deliverableId) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      deliverables: r.deliverables.filter((d) => d.id !== deliverableId),
    }), "删除产出"),
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
    }, "新建任务"),
  updateTask: (projectId, requirementId, taskId, patch) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      tasks: r.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    }), "修改任务"),

  removeTask: (projectId, requirementId, taskId) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      tasks: r.tasks.filter((t) => t.id !== taskId),
    }), "删除任务"),

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
    }, "新建验收标准"),

  updateAcceptance: (projectId, requirementId, acceptanceId, patch) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      acceptance: r.acceptance.map((a) => (a.id === acceptanceId ? { ...a, ...patch } : a)),
    }), "修改验收标准"),

  removeAcceptance: (projectId, requirementId, acceptanceId) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      acceptance: r.acceptance.filter((a) => a.id !== acceptanceId),
    }), "删除验收标准"),

  addTabRecord: (projectId, requirementId, tabId, fieldValues) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => {
      const record: TabRecord = { id: nanoid(), tabId, fieldValues, createdAt: new Date().toISOString() };
      return { ...r, tabRecords: [...(r.tabRecords ?? []), record] };
    }, "新建 Tab 记录"),

  updateTabRecord: (projectId, requirementId, recordId, fieldValues) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      tabRecords: (r.tabRecords ?? []).map((record) => (record.id === recordId ? { ...record, fieldValues } : record)),
    }), "修改 Tab 记录"),

  removeTabRecord: (projectId, requirementId, recordId) =>
    mutateRequirement(get, set, projectId, requirementId, (r) => ({
      ...r,
      tabRecords: (r.tabRecords ?? []).filter((record) => record.id !== recordId),
    }), "删除 Tab 记录"),

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
      const result = abandoned ? "abandoned" : targetStage === "archive" ? "completed" : null;
      // 恢复：从归档流转回活跃阶段时进度清零（Product-Spec §6.3）
      const restoringFromArchive = r.stage === "archive" && targetStage !== "archive";
      const progress = restoringFromArchive ? null : progressOf(r);
      // 发布时间默认当前日期（Product-Spec FLOW-006 边界情况），仅在尚未填写时补默认值
      const currentReleaseDate = releaseDateOf(r);
      const releaseDate = targetStage === "release" && !currentReleaseDate ? todayIso() : currentReleaseDate;
      // 换阶段后 manualOrder 是老阶段的值，跟目标阶段已有值不是同一套参照系，
      // 落到目标阶段最小值之前，跟新建置顶体感一致（Product-Spec REQ-001 §426）
      const existingInTarget = get().requirements.filter((req) => req.stage === targetStage && req.id !== r.id);
      const minOrder = existingInTarget.reduce((min, req) => Math.min(min, req.manualOrder), 0);
      const manualOrder = targetStage !== "archive" ? minOrder - 1 : r.manualOrder;
      const attributeValues = {
        ...r.attributeValues,
        [FIELD_KEYS.result]: result,
        [FIELD_KEYS.progress]: progress,
        [FIELD_KEYS.releaseDate]: releaseDate,
      };
      return { ...r, stage: targetStage, attributeValues, manualOrder, transitions: [...r.transitions, record] };
    }, "流转阶段"),

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

  reorderManually: (projectId, updates, undoSideEffect) =>
    reorderRequirements(get, set, projectId, updates, undoSideEffect),

  cascadeAttributeChange: (projectId, attributeId, transform) => {
    undoStack.clear();
    return enqueueRequirementMutation(async () => {
      const current = get().requirements;
      const updated = current.map((r) =>
        attributeId in r.attributeValues
          ? { ...r, attributeValues: withAttributeValue(r, attributeId, transform(r.attributeValues[attributeId])) }
          : r,
      );
      await Promise.all(
        updated.filter((r, i) => r !== current[i]).map((r) => saveRequirement(projectId, r)),
      );
      set({ requirements: updated });
    });
  },
  freezeStageHistory: (projectId, stage) => freezeStageHistory(get, set, projectId, stage),
}));
