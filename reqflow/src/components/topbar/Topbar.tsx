import { useState } from "react";
import { useProjectStore, currentProject } from "../../stores/projectStore";
import { useRequirementStore } from "../../stores/requirementStore";
import { useUiStore } from "../../stores/uiStore";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { SearchBox } from "./SearchBox";
import { SettingsPanel } from "./SettingsPanel";

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

function SettingsIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
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

function PanelToggleIcon({ collapsed }: { collapsed: boolean }) {
  const d = collapsed ? "M7.5 4.5 13 10l-5.5 5.5" : "M12 4.5 6 10l6 5.5";
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Topbar() {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const project = useProjectStore(currentProject);
  const requirements = useRequirementStore((s) => s.requirements);
  const detailMode = useUiStore((s) => s.detailMode);
  const toggleCollapsed = useUiStore((s) => s.toggleCollapsed);
  const selectRequirement = useUiStore((s) => s.selectRequirement);
  const detailCollapsed = detailMode === "collapsed";

  return (
    <header className="relative flex h-(--topbar-h) flex-none items-center justify-between bg-(--surface-2) px-2.5 border-b border-(--border)">
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
          aria-label="设置"
          aria-haspopup="true"
          onClick={() => setSettingsOpen((v) => !v)}
          className="grid size-6.5 flex-none place-items-center rounded-(--r-sm) border-none bg-transparent text-(--muted) hover:bg-(--surface) hover:text-(--fg)"
        >
          <SettingsIcon />
        </button>
        <button
          type="button"
          aria-label={detailCollapsed ? "展开详情" : "收起详情"}
          onClick={toggleCollapsed}
          className="grid size-6.5 flex-none place-items-center rounded-(--r-sm) border-none bg-transparent text-(--muted) hover:bg-(--surface) hover:text-(--fg)"
        >
          <PanelToggleIcon collapsed={detailCollapsed} />
        </button>
      </div>

      {switcherOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} />
          <ProjectSwitcher onClose={() => setSwitcherOpen(false)} />
        </>
      )}

      {settingsOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
          <SettingsPanel onClose={() => setSettingsOpen(false)} />
        </>
      )}
    </header>
  );
}
