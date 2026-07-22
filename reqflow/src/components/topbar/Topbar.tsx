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

function SearchIcon() {
  return (
    <svg className="icon-sm" viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M17 17l-3.6-3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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

interface TopbarProps {
  projectName: string;
  detailCollapsed: boolean;
  onTogglePanel: () => void;
}

export function Topbar({ projectName, detailCollapsed, onTogglePanel }: TopbarProps) {
  return (
    <header className="relative flex h-(--topbar-h) flex-none items-center justify-between bg-(--surface-2) px-2.5 border-b border-(--border)">
      <button
        type="button"
        className="inline-flex max-w-80 flex-none items-center gap-[5px] rounded-(--r-md) border-none bg-transparent px-1.5 py-1 font-(family-name:--font-display) text-[12px] font-[590] text-(--fg) hover:bg-(--surface)"
        aria-haspopup="true"
      >
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{projectName}</span>
        <span className="flex-none text-(--muted-2)">
          <ChevDownIcon />
        </span>
      </button>

      <div className="absolute top-1/2 left-1/2 w-[380px] max-w-[40vw] -translate-x-1/2 -translate-y-1/2">
        <div className="relative flex w-full items-center gap-1.5 rounded-(--r-md) border border-(--border) bg-(--surface) px-2.5 py-[5px] focus-within:border-(--accent)">
          <span className="flex-none text-(--muted-2)">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="搜索需求名称…"
            className="min-w-0 flex-1 border-none bg-transparent font-(family-name:--font-body) text-[12.5px] text-(--fg) outline-none placeholder:text-(--muted-2)"
          />
        </div>
      </div>

      <div className="flex flex-none items-center gap-0.5">
        <button
          type="button"
          aria-label="设置"
          className="grid size-6.5 flex-none place-items-center rounded-(--r-sm) border-none bg-transparent text-(--muted) hover:bg-(--surface) hover:text-(--fg)"
        >
          <SettingsIcon />
        </button>
        <button
          type="button"
          aria-label={detailCollapsed ? "展开详情" : "收起详情"}
          onClick={onTogglePanel}
          className="grid size-6.5 flex-none place-items-center rounded-(--r-sm) border-none bg-transparent text-(--muted) hover:bg-(--surface) hover:text-(--fg)"
        >
          <PanelToggleIcon collapsed={detailCollapsed} />
        </button>
      </div>
    </header>
  );
}
