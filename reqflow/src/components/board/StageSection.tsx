import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Requirement } from "../../types/models";
import type { Attribute, StageOption } from "../../types/schema";
import { RequirementRow } from "./RequirementRow";
import { QuickAddInput } from "./QuickAddInput";
import { ArchiveSearch } from "./ArchiveSearch";
import { SortControl } from "./SortControl";
import { lastTransitionTimestamp } from "../../lib/requirementMetrics";
import { sortRequirementsForStage } from "../../lib/requirementSort";
import { useUiStore } from "../../stores/uiStore";

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
  stageOption: StageOption;
  requirements: Requirement[];
  /** 已按 schema 可见属性顺序排好的属性列表，直接传给每一行的 RequirementRow。 */
  attributes: Attribute[];
  /** 用户拖拽调整过的列宽，需要跟表头用同一份值才能保持列对齐（见 BoardHeader.tsx）。 */
  columnWidths: Record<string, number>;
  selectedRequirementId: string | null;
  onCreate: (name: string) => void;
  onSelectRequirement: (id: string) => void;
  onAttributeChange: (requirementId: string, attributeId: string, value: unknown) => void;
}

export function StageSection({
  stageOption,
  requirements,
  attributes,
  columnWidths,
  selectedRequirementId,
  onCreate,
  onSelectRequirement,
  onAttributeChange,
}: StageSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [terminalSearch, setTerminalSearch] = useState("");
  const { setNodeRef, isOver } = useDroppable({ id: stageOption.id });

  const sort = useUiStore((s) => s.getStageSort(stageOption.id));
  const setStageSortField = useUiStore((s) => s.setStageSortField);
  const setStageSortSecondaryField = useUiStore((s) => s.setStageSortSecondaryField);
  const toggleStageSortDir = useUiStore((s) => s.toggleStageSortDir);
  const restoreStageSort = useUiStore((s) => s.restoreStageSort);

  const isTerminal = stageOption.isTerminal;

  const visibleRequirements = isTerminal
    ? requirements
        .filter((r) => r.name.toLowerCase().includes(terminalSearch.trim().toLowerCase()))
        .sort((a, b) => lastTransitionTimestamp(b).localeCompare(lastTransitionTimestamp(a)))
    : sortRequirementsForStage(requirements, sort);

  const emptyText = isTerminal
    ? terminalSearch.trim()
      ? "没有匹配的需求"
      : "该阶段暂无需求"
    : `该阶段暂无需求${stageOption.id === "collect" ? "，点上方新建记录你的第一个想法" : ""}`;

  return (
    <section
      ref={setNodeRef}
      className={`mb-1 rounded-(--r-lg) ${isOver ? "bg-(--accent-soft)" : ""}`}
    >
      <div
        className={`my-1.5 flex w-fit min-w-full items-center gap-2 rounded-(--r-lg) border px-2.5 py-1.75 ${
          isOver ? "border-(--accent) bg-(--accent-soft-strong)" : "border-(--accent-soft-strong)"
        }`}
        style={{ backgroundColor: isOver ? undefined : stageOption.color }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="inline-flex flex-none items-center gap-1.5 border-none bg-transparent p-0 select-none"
        >
          <span className={`flex-none text-(--muted-2) transition-transform duration-150 ${collapsed ? "-rotate-90" : ""}`}>
            <ChevronIcon />
          </span>
          <span className="font-(family-name:--font-display) text-[13px] font-[590] tracking-[-0.005em] text-(--fg)">
            {stageOption.label}
          </span>
          <span className="font-(family-name:--font-mono) text-[11px] text-(--muted-2) [font-variant-numeric:tabular-nums]">
            {requirements.length}
          </span>
        </button>
        <span className="flex-1" />
        {isTerminal ? (
          <ArchiveSearch value={terminalSearch} onChange={setTerminalSearch} />
        ) : (
          <>
            <SortControl
              sort={sort}
              onSetPrimaryField={(field) => setStageSortField(stageOption.id, "primary", field)}
              onSetSecondaryField={(field) => setStageSortSecondaryField(stageOption.id, field)}
              onToggleDir={(slot) => toggleStageSortDir(stageOption.id, slot)}
              onRestore={() => restoreStageSort(stageOption.id)}
            />
            <button
              type="button"
              onClick={() => setDraftOpen(true)}
              aria-label="新建需求"
              className="inline-flex flex-none items-center gap-1 rounded-(--r-sm) border-none bg-transparent px-1.75 py-1 text-[12px] text-(--muted) hover:bg-(--surface-2) hover:text-(--accent-text)"
            >
              <PlusIcon />
              新建
            </button>
          </>
        )}
      </div>

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
            <div className="px-1 py-3.5 text-[12.5px] text-(--muted-2)">{emptyText}</div>
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
                  columnWidths={columnWidths}
                  selected={r.id === selectedRequirementId}
                  isTerminal={isTerminal}
                  onSelect={() => onSelectRequirement(r.id)}
                  onAttributeChange={(attributeId, value) => onAttributeChange(r.id, attributeId, value)}
                />
              ))}
            </SortableContext>
          )}
        </>
      )}
    </section>
  );
}
