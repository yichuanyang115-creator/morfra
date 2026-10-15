import type { Requirement } from "../types/models";
import { undoStack } from "../lib/undoStack";
import { saveRequirement } from "./requirementPersistence";

export interface RequirementsState {
  requirements: Requirement[];
}

type RequirementsGetter<State extends RequirementsState> = () => State;
type RequirementsSetter<State extends RequirementsState> = (fn: (state: State) => Partial<State>) => void;

/** 编辑、排序和撤销共享同一队列，防止异步写入覆盖最新快照。 */
export function enqueueRequirementMutation<T>(operation: () => Promise<T>): Promise<T> {
  return undoStack.enqueue(operation);
}

export function mutateRequirement<State extends RequirementsState>(
  get: RequirementsGetter<State>,
  set: RequirementsSetter<State>,
  projectId: string,
  requirementId: string,
  transform: (requirement: Requirement) => Requirement,
  undoSummary?: string,
): Promise<void> {
  const undoVersion = undoStack.version;
  return enqueueRequirementMutation(async () => {
    const requirement = get().requirements.find((r) => r.id === requirementId);
    if (!requirement) return;
    const updated = transform(requirement);
    await saveRequirement(projectId, updated);
    set((state) => ({
      requirements: state.requirements.map((r) => (r.id === requirementId ? updated : r)),
    }) as Partial<State>);
    if (undoSummary) {
      undoStack.pushIfCurrent(undoVersion, {
        summary: undoSummary,
        undo: async () => {
          await saveRequirement(projectId, requirement);
          set((state) => ({
            requirements: state.requirements.map((r) => (r.id === requirementId ? requirement : r)),
          }) as Partial<State>);
        },
      });
    }
  });
}

export function reorderRequirements<State extends RequirementsState>(
  get: RequirementsGetter<State>,
  set: RequirementsSetter<State>,
  projectId: string,
  updates: { requirementId: string; manualOrder: number }[],
  undoSideEffect?: () => Promise<void>,
): Promise<void> {
  const undoVersion = undoStack.version;
  return enqueueRequirementMutation(async () => {
    const byId = new Map(updates.map((u) => [u.requirementId, u.manualOrder]));
    const current = get().requirements;
    const updated = current.map((r) => (byId.has(r.id) ? { ...r, manualOrder: byId.get(r.id)! } : r));
    await Promise.all(updated.filter((r) => byId.has(r.id)).map((r) => saveRequirement(projectId, r)));
    set(() => ({ requirements: updated }) as Partial<State>);
    const previous = current.filter((r) => byId.has(r.id));
    undoStack.pushIfCurrent(undoVersion, {
      summary: "调整排序",
      undo: async () => {
        await Promise.all(previous.map((r) => saveRequirement(projectId, r)));
        set((state) => ({
          requirements: state.requirements.map((r) => previous.find((old) => old.id === r.id) ?? r),
        }) as Partial<State>);
        await undoSideEffect?.();
      },
    });
  });
}
