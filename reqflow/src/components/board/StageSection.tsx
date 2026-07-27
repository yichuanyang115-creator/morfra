import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Requirement, Stage } from "../../types/models";
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
  stage: Stage;
  label: string;
  requirements: Requirement[];
  selectedRequirementId: string | null;
  onCreate: (name: string) => void;
  onSelectRequirement: (id: string) => void;
  onProgressChange: (requirementId: string, progress: number | null) => void;
  onReleaseMethodChange: (requirementId: string, method: string) => void;
  onReleaseDateChange: (requirementId: string, date: string) => void;
}

export function StageSection({
  stage,
  label,
  requirements,
  selectedRequirementId,
  onCreate,
  onSelectRequirement,
  onProgressChange,
  onReleaseMethodChange,
  onReleaseDateChange,
}: StageSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState("");
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  const sort = useUiStore((s) => s.getStageSort(stage));
  const setStageSortField = useUiStore((s) => s.setStageSortField);
  const setStageSortSecondaryField = useUiStore((s) => s.setStageSortSecondaryField);
  const toggleStageSortDir = useUiStore((s) => s.toggleStageSortDir);
  const restoreStageSort = useUiStore((s) => s.restoreStageSort);

  const isArchive = stage === "archive";

  const visibleRequirements = isArchive
    ? requirements
        .filter((r) => r.name.toLowerCase().includes(archiveSearch.trim().toLowerCase()))
        .sort((a, b) => lastTransitionTimestamp(b).localeCompare(lastTransitionTimestamp(a)))
    : sortRequirementsForStage(requirements, sort);

  const emptyText = isArchive
    ? archiveSearch.trim()
      ? "没有匹配的归档需求"
      : "还没有归档的需求"
    : `该阶段暂无需求${stage === "collect" ? "，点上方新建记录你的第一个想法" : ""}`;

  return (
    <section ref={setNodeRef} className={`mb-1 rounded-(--r-lg) ${isOver ? "bg-(--accent-soft)" : ""}`}>
      <div
        className={`my-1.5 flex max-w-(--board-row-max-w) items-center gap-2 rounded-(--r-lg) border px-2.5 py-1.75 ${
          isOver ? "border-(--accent) bg-(--accent-soft-strong)" : "border-(--accent-soft-strong) bg-(--accent-soft)"
        }`}
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
            {label}
          </span>
          <span className="font-(family-name:--font-mono) text-[11px] text-(--muted-2) [font-variant-numeric:tabular-nums]">
            {requirements.length}
          </span>
        </button>
        <span className="flex-1" />
        {isArchive ? (
          <ArchiveSearch value={archiveSearch} onChange={setArchiveSearch} />
        ) : (
          <>
            <SortControl
              sort={sort}
              onSetPrimaryField={(field) => setStageSortField(stage, "primary", field)}
              onSetSecondaryField={(field) => setStageSortSecondaryField(stage, field)}
              onToggleDir={(slot) => toggleStageSortDir(stage, slot)}
              onRestore={() => restoreStageSort(stage)}
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
              placeholder={stage === "collect" ? "输入想法，回车记录" : "输入名称，回车创建"}
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
              disabled={isArchive}
            >
              {visibleRequirements.map((r) => (
                <RequirementRow
                  key={r.id}
                  requirement={r}
                  selected={r.id === selectedRequirementId}
                  onSelect={() => onSelectRequirement(r.id)}
                  onProgressChange={(progress) => onProgressChange(r.id, progress)}
                  onReleaseMethodChange={(method) => onReleaseMethodChange(r.id, method)}
                  onReleaseDateChange={(date) => onReleaseDateChange(r.id, date)}
                />
              ))}
            </SortableContext>
          )}
        </>
      )}
    </section>
  );
}
