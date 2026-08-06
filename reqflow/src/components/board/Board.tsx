import { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { Requirement, Stage } from "../../types/models";
import type { StageOption } from "../../types/schema";
import { StageSection } from "./StageSection";
import { BoardHeader } from "./BoardHeader";
import { EmptyState } from "../shared/EmptyState";
import { Skeleton } from "../shared/Skeleton";
import { useSchemaStore } from "../../stores/schemaStore";
import { effectiveStageSort, sortRequirementsForStage, reorderManualOrder, type EffectiveStageSort } from "../../lib/requirementSort";
import { boardAttributesFor } from "../../lib/schemaSelectors";
import { requirementMatchesFilters } from "../../lib/filterEngine";

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
  sort: EffectiveStageSort,
  attributes: import("../../types/schema").Attribute[] = [],
): Requirement[] | null {
  if (overId == null || activeId === overId || findStageOption(stageOptions, overId)) return null;
  const active = requirements.find((r) => r.id === activeId);
  const over = requirements.find((r) => r.id === overId);
  if (!active || !over || active.stage !== over.stage) return null;

  const stageRequirements = requirements.filter((r) => r.stage === active.stage);
  const sorted = sortRequirementsForStage(stageRequirements, sort, attributes);
  const oldIndex = sorted.findIndex((r) => r.id === activeId);
  const newIndex = sorted.findIndex((r) => r.id === overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return null;
  return arrayMove(sorted, oldIndex, newIndex);
}

interface BoardProps {
  projectId?: string | null;
  requirements: Requirement[];
  loading: boolean;
  error: boolean;
  selectedRequirementId: string | null;
  onCreate: (stage: Stage, name: string) => void;
  onSelectRequirement: (id: string) => void;
  onAttributeChange: (requirementId: string, attributeId: string, value: unknown) => void;
  onDelete?: (requirementId: string) => void;
  onTransition: (requirementId: string, toStage: Stage) => void;
  onReorder: (updates: { requirementId: string; manualOrder: number }[], stageId: string) => Promise<void>;
  /** 右键表头"编辑此属性"跳转到 Schema 设置页对应属性（见 REQ-025 设置页入口）。 */
  onEditAttribute: (attributeId: string) => void;
  /** 右键表头"隐藏此属性"：updateAttribute(showOnBoard:false)，视图偏好可逆（讨论稿 §7）。 */
  onHideAttribute: (attributeId: string) => void;
  /** 右键表头"冻结至此列"：setFrozenCount(count)，count = 目标列索引 + 1（REQ-001 MUST）。 */
  onFreezeTo: (count: number) => void;
  /** 列宽拖拽松手后持久化到 schema.json viewPreferences.columnWidths（见 REQ-001 MUST）。 */
  onColumnWidthCommit: (attributeId: string, width: number) => Promise<void>;
  /** 表头拖拽调序松手后持久化到 schema.json viewPreferences.columnOrder（见 REQ-001 MUST）。 */
  onColumnOrderCommit: (orderedIds: string[]) => void;
}

export function Board({
  projectId,
  requirements,
  loading,
  error,
  selectedRequirementId,
  onCreate,
  onSelectRequirement,
  onAttributeChange,
  onDelete = () => undefined,
  onTransition,
  onReorder,
  onEditAttribute,
  onHideAttribute,
  onFreezeTo,
  onColumnWidthCommit,
  onColumnOrderCommit,
}: BoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const schema = useSchemaStore((s) => s.schema);
  const stageOptions = schema?.stageOptions ?? [];
  const boardAttributes = boardAttributesFor(schema);
  // 冻结列数来自 viewPreferences.frozenCount（默认 0 = 只冻结 Name 列，见 REQ-001 MUST）。
  const frozenCount = schema?.viewPreferences.frozenCount ?? 0;
  // 筛选作用范围：仅看板（REQ-026），过滤哪些实体可见；空阶段仍显示分组标题。
  const filters = schema?.viewPreferences.filters ?? [];
  const allAttributes = schema?.attributes ?? [];
  const visibleRequirements = requirements.filter((r) => requirementMatchesFilters(r, allAttributes, filters));
  // 拖拽过程中的实时列宽只存在这里，不逐帧写 schemaStore（那样每次 pointermove 都会
  // 触发一次文件写入）。松手（onColumnWidthCommit）时才真正持久化，见 App.tsx。
  const [draftColumnWidths, setDraftColumnWidths] = useState<Record<string, number> | null>(null);
  const columnWidths = draftColumnWidths ?? schema?.viewPreferences.columnWidths ?? {};

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
    const sort = effectiveStageSort(activeRequirement.stage, schema?.viewPreferences.globalSort, schema?.viewPreferences.stageSorts, allAttributes);
    const reordered = resolveReorder(requirements, stageOptions, activeId, overId, sort, allAttributes);
    if (reordered) {
      void onReorder(reorderManualOrder(reordered), activeRequirement.stage);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pr-5.5 pb-6">
        {visibleRequirements.length === 0 && (
          <EmptyState
            text={
              filters.length > 0
                ? "没有匹配筛选条件的实体"
                : "还没有实体，点收集阶段的新建按钮记录你的第一个想法"
            }
          />
        )}
        <BoardHeader
          attributes={boardAttributes}
          columnWidths={columnWidths}
          frozenCount={frozenCount}
          onEditAttribute={onEditAttribute}
          onHideAttribute={onHideAttribute}
          onFreezeTo={onFreezeTo}
          onColumnWidthChange={(attributeId, width) =>
            setDraftColumnWidths({ ...(draftColumnWidths ?? schema?.viewPreferences.columnWidths ?? {}), [attributeId]: width })
          }
          onColumnWidthCommit={(attributeId, width) => {
            // 持久化写盘是异步的（mutateSchema 先 await writeFile 再更新 store），
            // 草稿宽度要等落盘更新完 schema 后才能清掉，否则中间会闪回拖拽前的旧宽度。
            // 用 finally 而不是 then：写盘失败也要清掉草稿，否则 draftColumnWidths
            // 卡在拖拽结束值上，后续渲染再也读不到 store 里的真实宽度。
            void onColumnWidthCommit(attributeId, width).finally(() => setDraftColumnWidths(null));
          }}
          onReorder={onColumnOrderCommit}
        />

        {stageOptions.map((s) => (
          <StageSection
            key={s.id}
            projectId={projectId}
            stageOption={s}
            requirements={visibleRequirements.filter((r) => r.stage === s.id)}
            attributes={boardAttributes}
            allAttributes={schema?.attributes ?? []}
            columnWidths={columnWidths}
            frozenCount={frozenCount}
            selectedRequirementId={selectedRequirementId}
            onCreate={(name) => onCreate(s.id, name)}
            onSelectRequirement={onSelectRequirement}
            onAttributeChange={onAttributeChange}
            onDelete={onDelete}
          />
        ))}
      </div>
    </DndContext>
  );
}
