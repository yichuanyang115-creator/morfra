import { STAGES } from "../../types/models";
import type { Requirement, Stage } from "../../types/models";
import { StageSection } from "./StageSection";
import { EmptyState } from "../shared/EmptyState";
import { Skeleton } from "../shared/Skeleton";

const BOARD_COLUMNS = ["名称", "优先级", "负责人", "创建时间", "截止日期", "停留天数", "总耗时", "进度"];

interface BoardProps {
  requirements: Requirement[];
  loading: boolean;
  error: boolean;
  selectedRequirementId: string | null;
  onCreate: (stage: Stage, name: string) => void;
  onSelectRequirement: (id: string) => void;
  onProgressChange: (requirementId: string, progress: number | null) => void;
}

export function Board({
  requirements,
  loading,
  error,
  selectedRequirementId,
  onCreate,
  onSelectRequirement,
  onProgressChange,
}: BoardProps) {
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

  return (
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
        />
      ))}
    </div>
  );
}
