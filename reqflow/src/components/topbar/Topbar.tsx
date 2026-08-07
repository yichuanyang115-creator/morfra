import { useState } from "react";
import { useProjectStore, currentProject } from "../../stores/projectStore";
import { useRequirementStore } from "../../stores/requirementStore";
import { useUiStore } from "../../stores/uiStore";
import { useSchemaStore } from "../../stores/schemaStore";
import { fieldAttributesFor } from "../../lib/schemaSelectors";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { SearchBox } from "./SearchBox";
import { FieldsPanel } from "./FieldsPanel";
import { FilterPanel } from "./FilterPanel";
import { GlobalSortPanel } from "./GlobalSortPanel";
import { ChatToggle } from "./ChatToggle";
import { SortIcon } from "../shared/SortIcon";

function ChevDownIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path
        d="M5.5 8l4.5 4.5L14.5 8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg className="size-[15px]" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 4.5h12l-4.5 5.5v4.3l-3 1.5v-5.8L4 4.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FieldsIcon() {
  return (
    <svg className="size-[15px]" viewBox="0 0 20 20" fill="none">
      <path d="M4 5.5h2M4 10h2M4 14.5h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.5 5.5h7.5M8.5 10h7.5M8.5 14.5h7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function AppSettingsIcon() {
  return (
    <svg className="size-[15px]" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="6.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 9.2v4M10 6.7h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SchemaSettingsIcon() {
  return (
    <svg className="size-[15px]" viewBox="0 0 20 20" fill="none">
      <path
        d="M8.5 3.2h3l.45 1.9 1.75.9 1.85-.7 1.5 2.6-1.35 1.35v2l1.35 1.35-1.5 2.6-1.85-.7-1.75.9-.45 1.9h-3l-.45-1.9-1.75-.9-1.85.7-1.5-2.6 1.35-1.35v-2L2.95 8.9l1.5-2.6 1.85.7 1.75-.9.45-1.9Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function Topbar() {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const project = useProjectStore(currentProject);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const requirements = useRequirementStore((s) => s.requirements);
  const selectRequirement = useUiStore((s) => s.selectRequirement);
  const openSettings = useUiStore((s) => s.openSettings);
  const openAppSettings = useUiStore((s) => s.openAppSettings);
  const settingsSection = useUiStore((s) => s.settingsSection);
  const appSettingsSection = useUiStore((s) => s.appSettingsSection);
  const schema = useSchemaStore((s) => s.schema);
  const schemaLoaded = useSchemaStore((s) => s.schema !== null);
  const filters = schema?.viewPreferences.filters ?? [];
  const addAttribute = useSchemaStore((s) => s.addAttribute);
  const updateAttribute = useSchemaStore((s) => s.updateAttribute);
  const setColumnOrder = useSchemaStore((s) => s.setColumnOrder);
  const setFilters = useSchemaStore((s) => s.setFilters);
  const setGlobalSort = useSchemaStore((s) => s.setGlobalSort);
  const globalSort = schema?.viewPreferences.globalSort ?? null;

  return (
    <header className="relative flex h-(--topbar-h) flex-none items-center justify-between bg-(--topbar) px-2.5 border-b border-(--border)">
      <button
        type="button"
        onClick={() => setSwitcherOpen((v) => !v)}
        className="inline-flex max-w-80 flex-none items-center gap-[5px] rounded-(--r-md) border-none bg-transparent px-1.5 py-1 font-(family-name:--font-display) text-[12px] font-[590] text-(--fg) hover:bg-(--surface)"
        aria-haspopup="true"
      >
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{project?.name ?? "项目"}</span>
        <span className="flex-none text-(--muted-2)">
          <ChevDownIcon />
        </span>
      </button>

      <SearchBox requirements={requirements} onJumpToRequirement={selectRequirement} />

      <div className="flex flex-none items-center gap-0.5">
        <button
          type="button"
          aria-label="筛选"
          aria-haspopup="true"
          onClick={() => setFilterOpen((v) => !v)}
          className={`grid size-6.5 flex-none place-items-center rounded-(--r-sm) border-none bg-transparent hover:bg-(--surface) hover:text-(--fg) ${
            filterOpen || filters.length > 0 ? "bg-(--accent-soft) text-(--accent-text)" : "text-(--muted)"
          }`}
        >
          <FilterIcon />
        </button>
        {filters.length > 0 && (
          <span className="flex flex-none items-center gap-1 rounded-(--r-full) bg-(--accent-soft) px-1.5 py-0.5 font-(family-name:--font-mono) text-[11px] font-[590] leading-none text-(--accent-text)">
            <span className="tabular-nums">{filters.length}</span>
            <button
              type="button"
              aria-label="清除全部筛选"
              onClick={() => {
                if (currentProjectId) void setFilters(currentProjectId, []);
              }}
              className="grid size-3.5 place-items-center rounded-full border-none bg-transparent text-[11px] leading-none text-(--accent-text) hover:bg-(--accent-soft-strong)"
            >
              ×
            </button>
          </span>
        )}
        <button
          type="button"
          aria-label="排序"
          aria-haspopup="true"
          onClick={() => setSortOpen((v) => !v)}
          className={`grid size-6.5 flex-none place-items-center rounded-(--r-sm) border-none bg-transparent hover:bg-(--surface) hover:text-(--fg) ${sortOpen || globalSort ? "bg-(--accent-soft) text-(--accent-text)" : "text-(--muted)"}`}
        >
          <SortIcon />
        </button>
        <button
          type="button"
          aria-label="字段"
          aria-haspopup="true"
          onClick={() => setFieldsOpen((v) => !v)}
          className={`grid size-6.5 flex-none place-items-center rounded-(--r-sm) border-none bg-transparent hover:bg-(--surface) hover:text-(--fg) ${
            fieldsOpen ? "bg-(--surface) text-(--fg)" : "text-(--muted)"
          }`}
        >
          <FieldsIcon />
        </button>
        <button
          type="button"
          aria-label="应用设置"
          onClick={() => openAppSettings()}
          className={appSettingsSection ? "grid size-6.5 flex-none place-items-center rounded-(--r-sm) border-none bg-(--accent-soft) text-(--accent-text)" : "grid size-6.5 flex-none place-items-center rounded-(--r-sm) border-none bg-transparent text-(--muted) hover:bg-(--surface) hover:text-(--fg)"}
        >
          <AppSettingsIcon />
        </button>
        <button
          type="button"
          aria-label="Schema 设置"
          disabled={!schemaLoaded}
          onClick={() => openSettings()}
          className={`grid size-6.5 flex-none place-items-center rounded-(--r-sm) border-none bg-transparent disabled:cursor-not-allowed disabled:opacity-40 ${
            settingsSection ? "bg-(--accent-soft) text-(--accent-text)" : "text-(--muted) hover:bg-(--surface) hover:text-(--fg)"
          }`}
        >
          <SchemaSettingsIcon />
        </button>
        <ChatToggle />
      </div>

      {switcherOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} />
          <ProjectSwitcher onClose={() => setSwitcherOpen(false)} />
        </>
      )}

      {fieldsOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setFieldsOpen(false)} />
          <FieldsPanel
            attributes={schema ? fieldAttributesFor(schema) : []}
            onToggleBoard={(attributeId, next) => {
              if (currentProjectId) void updateAttribute(currentProjectId, attributeId, { showOnBoard: next });
            }}
            onReorder={(orderedIds) => {
              if (currentProjectId) void setColumnOrder(currentProjectId, orderedIds);
            }}
            onAdd={(attribute) => {
              if (currentProjectId) void addAttribute(currentProjectId, attribute);
            }}
            onClose={() => setFieldsOpen(false)}
          />
        </>
      )}

      {filterOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
          <FilterPanel
            attributes={schema?.attributes ?? []}
            filters={filters}
            onChange={(next) => {
              if (currentProjectId) void setFilters(currentProjectId, next);
            }}
            onClose={() => setFilterOpen(false)}
          />
        </>
      )}

      {sortOpen && (
        <GlobalSortPanel
          attributes={schema?.attributes ?? []}
          sort={globalSort}
          onChange={(next) => { if (currentProjectId) void setGlobalSort(currentProjectId, next); }}
          onClose={() => setSortOpen(false)}
        />
      )}
    </header>
  );
}
