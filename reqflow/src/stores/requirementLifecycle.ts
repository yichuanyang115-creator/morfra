import type { Requirement } from "../types/models";
import type { StageOption } from "../types/schema";
import { removeFile } from "../lib/fs";
import { requirementPath } from "../lib/paths";
import { undoStack } from "../lib/undoStack";
import { enqueueRequirementMutation, type RequirementsState } from "./requirementMutations";
import { saveRequirement } from "./requirementPersistence";

type Getter<State extends RequirementsState> = () => State;
type Setter<State extends RequirementsState> = (fn: (state: State) => Partial<State>) => void;

/** 永久删除整个实体文件。其 Tab、流转和评论都嵌在同一份 frontmatter，因此不会留下孤儿记录。 */
export function deleteRequirement<State extends RequirementsState>(
  get: Getter<State>,
  set: Setter<State>,
  projectId: string,
  requirementId: string,
): Promise<void> {
  undoStack.clear();
  return enqueueRequirementMutation(async () => {
    if (!get().requirements.some((requirement) => requirement.id === requirementId)) return;
    await removeFile(await requirementPath(projectId, requirementId));
    set((state) => ({ requirements: state.requirements.filter((requirement) => requirement.id !== requirementId) }) as Partial<State>);
  });
}

/** 阶段从 Schema 移除前，把所有受影响流转记录的显示名写成不可变文本快照。 */
export function freezeStageHistory<State extends RequirementsState>(
  get: Getter<State>,
  set: Setter<State>,
  projectId: string,
  stage: StageOption,
): Promise<void> {
  undoStack.clear();
  return enqueueRequirementMutation(async () => {
    const current = get().requirements;
    const updated = current.map((requirement) => freezeRequirementStageLabels(requirement, stage));
    await Promise.all(updated.filter((requirement, index) => requirement !== current[index]).map((requirement) => saveRequirement(projectId, requirement)));
    set(() => ({ requirements: updated }) as Partial<State>);
  });
}

function freezeRequirementStageLabels(requirement: Requirement, stage: StageOption): Requirement {
  let changed = false;
  const transitions = requirement.transitions.map((transition) => {
    const fromLabel = transition.from === stage.id ? stage.label : transition.fromLabel;
    const toLabel = transition.to === stage.id ? stage.label : transition.toLabel;
    if (fromLabel === transition.fromLabel && toLabel === transition.toLabel) return transition;
    changed = true;
    return { ...transition, fromLabel, toLabel };
  });
  return changed ? { ...requirement, transitions } : requirement;
}
