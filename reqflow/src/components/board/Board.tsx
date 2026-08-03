import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { Requirement, Stage } from "../../types/models";
import type { StageOption } from "../../types/schema";
import { StageSection } from "./StageSection";
import { BoardHeader } from "./BoardHeader";
import { EmptyState } from "../shared/EmptyState";
import { Skeleton } from "../shared/Skeleton";
import { useUiStore } from "../../stores/uiStore";
import { useSchemaStore } from "../../stores/schemaStore";
import { sortRequirementsForStage, reorderManualOrder, type StageSort } from "../../lib/requirementSort";
import { boardAttributesFor } from "../../lib/schemaSelectors";

function findStageOption(stageOptions: StageOption[], id: string | number): StageOption | undefined {
  return typeof id === "string" ? stageOptions.find((s) => s.id === id) : undefined;
}

/** overId 既可能是阶段区域容器 id，也可能是同区域内另一行需求的 id（悬停在行上）。 */
function resolveOverStage(
  requirements: Requirement[],
  stageOptions: StageOption[],
  overId: string | number,
): Stage | null {
  if (findStageOption(stageOptions, overId)) return overId as Stage;
  return requirements.find((r) => r.id === overId)?.stage ?? null;
}

export function resolveDropTransition(
  requirements: Requirement[],
  stageOptions: StageOption[],
  activeId: string | number,
  overId: string | number | undefined,
): { requirementId: string; toStage: Stage } | null {
  if (overId == null) return null;
  const requirement = requirements.find((r) => r.id === activeId);
  if (!requirement) return null;
  const targetStage = resolveOverStage(requirements, stageOptions, overId);
  if (!targetStage || requirement.stage === targetStage) return null;
  return { requirementId: requirement.id, toStage: targetStage };
}

/** 同阶段内拖拽调顺序：over 是同阶段另一行时，按当前排序快照重新插入并返回该阶段的完整新顺序。 */
export function resolveReorder(
  requirements: Requirement[],
  stageOptions: StageOption[],
  activeId: string | number,
  overId: string | number | undefined,
  sort: StageSort,
): Requirement[] | null {
  if (overId == null || activeId === overId || findStageOption(stageOptions, overId)) return null;
  const active = requirements.find((r) => r.id === activeId);
  const over = requirements.find((r) => r.id === overId);
  if (!active || !over || active.stage !== over.stage) return null;

  const stageRequirements = requirements.filter((r) => r.stage === active.stage);
  const sorted = sortRequirementsForStage(stageRequirements, sort);
  const oldIndex = sorted.findIndex((r) => r.id === activeId);
  const newIndex = sorted.findIndex((r) => r.id === overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return null;
  return arrayMove(sorted, oldIndex, newIndex);
}

interface BoardProps {
  requirements: Requirement[];
  loading: boolean;
  error: boolean;
  selectedRequirementId: string | null;
  onCreate: (stage: Stage, name: string) => void;
  onSelectRequirement: (id: string) => void;
  onAttributeChange: (requirementId: string, attributeId: string, value: unknown) => void;
  onTransition: (requirementId: string, toStage: Stage) => void;
  onReorder: (updates: { requirementId: string; manualOrder: number }[]) => void;
  /** 右键表头"编辑此属性"跳转到 Schema 设置页对应属性（见 REQ-025 设置页入口）。 */
  onEditAttribute: (attributeId: string) => void;
}

export function Board({
  requirements,
  loading,
  error,
  selectedRequirementId,
  onCreate,
  onSelectRequirement,
  onAttributeChange,
  onTransition,
  onReorder,
  onEditAttribute,
}: BoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const schema = useSchemaStore((s) => s.schema);
  const stageOptions = schema?.stageOptions ?? [];
  const boardAttributes = boardAttributesFor(schema);

  if (loading) {
    return <Skeleton />;
  }

  if (error) {
    return (
      <div className="px-5.5 py-15 text-center text-[13px] text-(--muted)">
        数据读取失败，请检查项目文件夹
      </div>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = event.active.id;
    const overId = event.over?.id;

    const transition = resolveDropTransition(requirements, stageOptions, activeId, overId);
    if (transition) {
      onTransition(transition.requirementId, transition.toStage);
      return;
    }

    const activeRequirement = requirements.find((r) => r.id === activeId);
    const activeStageOption = activeRequirement && findStageOption(stageOptions, activeRequirement.stage);
    if (!activeRequirement || activeStageOption?.isTerminal) return;
    const sort = useUiStore.getState().getStageSort(activeRequirement.stage);
    const reordered = resolveReorder(requirements, stageOptions, activeId, overId, sort);
    if (reordered) {
      onReorder(reorderManualOrder(reordered));
      useUiStore.getState().setStageSortManual(activeRequirement.stage);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto px-5.5 pb-6">
        {requirements.length === 0 && (
          <EmptyState text="还没有需求，点收集阶段的新建按钮记录你的第一个想法" />
        )}
        <BoardHeader attributes={boardAttributes} onEditAttribute={onEditAttribute} />

        {stageOptions.map((s) => (
          <StageSection
            key={s.id}
            stageOption={s}
            requirements={requirements.filter((r) => r.stage === s.id)}
            attributes={boardAttributes}
            selectedRequirementId={selectedRequirementId}
            onCreate={(name) => onCreate(s.id, name)}
            onSelectRequirement={onSelectRequirement}
            onAttributeChange={onAttributeChange}
          />
        ))}
      </div>
    </DndContext>
  );
}
