import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { STAGES } from "../../types/models";
import type { Requirement, Stage } from "../../types/models";
import { StageSection } from "./StageSection";
import { EmptyState } from "../shared/EmptyState";
import { Skeleton } from "../shared/Skeleton";
import { useUiStore } from "../../stores/uiStore";
import { sortRequirementsForStage, reorderManualOrder, type StageSort } from "../../lib/requirementSort";

const BOARD_COLUMNS = ["名称", "优先级", "负责人", "创建时间", "截止日期", "停留天数", "总耗时", "进度"];

const STAGE_KEYS = new Set(STAGES.map((s) => s.key));

function isStageKey(id: string | number): id is Stage {
  return typeof id === "string" && STAGE_KEYS.has(id as Stage);
}

/** overId 既可能是阶段区域容器 id，也可能是同区域内另一行需求的 id（悬停在行上）。 */
function resolveOverStage(requirements: Requirement[], overId: string | number): Stage | null {
  if (isStageKey(overId)) return overId;
  return requirements.find((r) => r.id === overId)?.stage ?? null;
}

export function resolveDropTransition(
  requirements: Requirement[],
  activeId: string | number,
  overId: string | number | undefined,
): { requirementId: string; toStage: Stage } | null {
  if (overId == null) return null;
  const requirement = requirements.find((r) => r.id === activeId);
  if (!requirement) return null;
  const targetStage = resolveOverStage(requirements, overId);
  if (!targetStage || requirement.stage === targetStage) return null;
  return { requirementId: requirement.id, toStage: targetStage };
}

/** 同阶段内拖拽调顺序：over 是同阶段另一行时，按当前排序快照重新插入并返回该阶段的完整新顺序。 */
export function resolveReorder(
  requirements: Requirement[],
  activeId: string | number,
  overId: string | number | undefined,
  sort: StageSort,
): Requirement[] | null {
  if (overId == null || activeId === overId || isStageKey(overId)) return null;
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
  onProgressChange: (requirementId: string, progress: number | null) => void;
  onTransition: (requirementId: string, toStage: Stage) => void;
  onReleaseMethodChange: (requirementId: string, method: string) => void;
  onReleaseDateChange: (requirementId: string, date: string) => void;
  onReorder: (updates: { requirementId: string; manualOrder: number }[]) => void;
}

export function Board({
  requirements,
  loading,
  error,
  selectedRequirementId,
  onCreate,
  onSelectRequirement,
  onProgressChange,
  onTransition,
  onReleaseMethodChange,
  onReleaseDateChange,
  onReorder,
}: BoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

    const transition = resolveDropTransition(requirements, activeId, overId);
    if (transition) {
      onTransition(transition.requirementId, transition.toStage);
      return;
    }

    const activeRequirement = requirements.find((r) => r.id === activeId);
    if (!activeRequirement || activeRequirement.stage === "archive") return;
    const sort = useUiStore.getState().getStageSort(activeRequirement.stage);
    const reordered = resolveReorder(requirements, activeId, overId, sort);
    if (reordered) {
      onReorder(reorderManualOrder(reordered));
      useUiStore.getState().setStageSortManual(activeRequirement.stage);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="px-5.5 pb-6">
        {requirements.length === 0 && (
          <EmptyState text="还没有需求，点收集阶段的新建按钮记录你的第一个想法" />
        )}
        <div
          className="sticky top-0 z-4 grid h-(--board-header-h) max-w-(--board-row-max-w) items-center gap-3 bg-(--bg) px-2 text-[11.5px] tracking-[0.02em] text-(--muted)"
          style={{ gridTemplateColumns: "minmax(140px, 320px) 40px 56px 56px 52px 56px 56px 40px" }}
        >
          {BOARD_COLUMNS.map((c, i) => (
            <div key={c} className={i === 0 ? "font-(family-name:--font-body) font-[550]" : "text-center font-(family-name:--font-mono)"}>
              {c}
            </div>
          ))}
        </div>

        {STAGES.map((s) => (
          <StageSection
            key={s.key}
            stage={s.key}
            label={s.label}
            requirements={requirements.filter((r) => r.stage === s.key)}
            selectedRequirementId={selectedRequirementId}
            onCreate={(name) => onCreate(s.key, name)}
            onSelectRequirement={onSelectRequirement}
            onProgressChange={onProgressChange}
            onReleaseMethodChange={onReleaseMethodChange}
            onReleaseDateChange={onReleaseDateChange}
          />
        ))}
      </div>
    </DndContext>
  );
}
