import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Requirement } from "../../types/models";
import type { Attribute, SortRule, StageOption } from "../../types/schema";
import { RequirementRow } from "./RequirementRow";
import { QuickAddInput } from "./QuickAddInput";
import { ArchiveSearch } from "./ArchiveSearch";
import { SortControl } from "./SortControl";
import { lastTransitionTimestamp } from "../../lib/requirementMetrics";
import { effectiveStageSort, sortRequirementsForStage } from "../../lib/requirementSort";
import { useSchemaStore } from "../../stores/schemaStore";

function ChevronIcon() {
  return (
    <svg className="icon icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M6 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

interface StageSectionProps {
  projectId?: string | null;
  stageOption: StageOption;
  requirements: Requirement[];
  /** 已按 schema 可见属性顺序排好的属性列表，直接传给每一行的 RequirementRow（原始列位）。 */
  attributes: Attribute[];
  /** 全部属性（schema.attributes），供阶段覆盖解析被替换的 to 属性（可能不在可见列里）。缺省回退到可见列位。 */
  allAttributes?: Attribute[];
  /** 用户拖拽调整过的列宽，需要跟表头用同一份值才能保持列对齐（见 BoardHeader.tsx）。 */
  columnWidths: Record<string, number>;
  /** 冻结的属性列数，下传给每一行的 RequirementRow（见 REQ-001 MUST"从左向右连续扩展"）。 */
  frozenCount: number;
  selectedRequirementId: string | null;
  onCreate: (name: string) => void;
  onSelectRequirement: (id: string) => void;
  onAttributeChange: (requirementId: string, attributeId: string, value: unknown) => void;
  onDelete?: (requirementId: string) => void;
}

export function StageSection({
  projectId,
  stageOption,
  requirements,
  attributes,
  allAttributes,
  columnWidths,
  frozenCount,
  selectedRequirementId,
  onCreate,
  onSelectRequirement,
  onAttributeChange,
  onDelete = () => undefined,
}: StageSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [terminalSearch, setTerminalSearch] = useState("");
  const [sortOpen, setSortOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: stageOption.id });

  const schema = useSchemaStore((s) => s.schema);
  const setStageSort = useSchemaStore((s) => s.setStageSort);
  const clearStageSort = useSchemaStore((s) => s.clearStageSort);
  const sortAttributes = allAttributes ?? attributes;
  const sort = effectiveStageSort(stageOption.id, schema?.viewPreferences.globalSort, schema?.viewPreferences.stageSorts, sortAttributes);
  const localPreference = schema?.viewPreferences.stageSorts?.[stageOption.id];
  const hasLocalRule = Boolean(localPreference && "attrId" in localPreference);

  const isTerminal = stageOption.isTerminal;

  const visibleRequirements = isTerminal
    ? requirements
        .filter((r) => r.name.toLowerCase().includes(terminalSearch.trim().toLowerCase()))
        .sort((a, b) => lastTransitionTimestamp(b).localeCompare(lastTransitionTimestamp(a)))
    : sortRequirementsForStage(requirements, sort, sortAttributes);

  const emptyText = isTerminal
    ? terminalSearch.trim()
      ? "没有匹配的实体"
      : "该阶段暂无实体"
    : `该阶段暂无实体${stageOption.id === "collect" ? "，点上方新建记录你的第一个想法" : ""}`;

  return (
    <>
      <div
        className={`sticky left-0 ${sortOpen ? "z-10" : "z-1"} my-1.5 flex w-full items-center gap-2 rounded-(--r-lg) border bg-(--module-scope-background-surface) pl-5.5 py-1.75 pr-2.5 ${
          isOver ? "border-(--module-scope-action-base) bg-(--module-scope-action-soft)" : "border-(--module-scope-context-soft)"
        }`}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="inline-flex flex-none items-center gap-1.5 border-none bg-transparent p-0 select-none"
        >
          <span className={`flex-none text-(--module-scope-text-tertiary) transition-transform duration-150 ${collapsed ? "-rotate-90" : ""}`}>
            <ChevronIcon />
          </span>
          <span aria-hidden="true" className="size-1.5 flex-none rounded-full" style={{ backgroundColor: stageOption.color }} />
          <span className="font-(family-name:--font-display) text-[13px] font-[590] tracking-[-0.005em] text-(--module-scope-text-primary)">
            {stageOption.label}
          </span>
          <span className="font-(family-name:--font-mono) text-[11px] text-(--module-scope-text-tertiary) [font-variant-numeric:tabular-nums]">
            {requirements.length}
          </span>
        </button>
        <span className="flex-1" />
        {isTerminal ? (
          <ArchiveSearch value={terminalSearch} onChange={setTerminalSearch} />
        ) : (
          <>
            <SortControl
              rule={sort.rule}
              attributes={sortAttributes}
              manual={sort.mode === "manual"}
              hasLocalRule={hasLocalRule}
              onChange={(rule: SortRule | null) => {
                if (!projectId) return;
                if (rule) void setStageSort(projectId, stageOption.id, rule);
                else void clearStageSort(projectId, stageOption.id);
              }}
              onToggleDirection={() => {
                if (!projectId || !sort.rule) return;
                void setStageSort(projectId, stageOption.id, { ...sort.rule, direction: sort.rule.direction === "desc" ? "asc" : "desc" });
              }}
              onRestore={() => { if (projectId) void clearStageSort(projectId, stageOption.id); }}
              onOpenChange={setSortOpen}
            />
            <button
              type="button"
              onClick={() => setDraftOpen(true)}
              aria-label="新建实体"
              className="inline-flex flex-none items-center gap-1 rounded-(--r-sm) border-none bg-transparent px-1.75 py-1 text-[12px] text-(--module-scope-text-secondary) hover:bg-(--module-scope-action-soft) hover:text-(--module-scope-action-strong)"
            >
              <PlusIcon />
              新建
            </button>
          </>
        )}
      </div>
      <section
        ref={setNodeRef}
        className={`mb-1 rounded-(--r-lg) ${isOver ? "bg-(--module-scope-action-soft)" : ""}`}
      >
      {!collapsed && (
        <>
          {draftOpen && (
            <QuickAddInput
              placeholder={stageOption.id === "collect" ? "输入想法，回车记录" : "输入名称，回车创建"}
              attributes={attributes}
              columnWidths={columnWidths}
              onSubmit={(name) => {
                onCreate(name);
                setDraftOpen(false);
              }}
              onCancel={() => setDraftOpen(false)}
            />
          )}
          {visibleRequirements.length === 0 && !draftOpen ? (
            <div className="px-1 py-3.5 text-[12.5px] text-(--module-scope-text-tertiary)">{emptyText}</div>
          ) : (
            <SortableContext
              items={visibleRequirements.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
              disabled={isTerminal}
            >
              {visibleRequirements.map((r) => (
                <RequirementRow
                  key={r.id}
                  requirement={r}
                  attributes={attributes}
                  allAttributes={allAttributes ?? attributes}
                  overrides={stageOption.attributeOverrides}
                  columnWidths={columnWidths}
                  frozenCount={frozenCount}
                  selected={r.id === selectedRequirementId}
                  isTerminal={isTerminal}
                  onSelect={() => onSelectRequirement(r.id)}
                  onAttributeChange={(attributeId, value) => onAttributeChange(r.id, attributeId, value)}
                  onDelete={() => onDelete(r.id)}
                />
              ))}
            </SortableContext>
          )}
        </>
      )}
      </section>
    </>
  );
}
