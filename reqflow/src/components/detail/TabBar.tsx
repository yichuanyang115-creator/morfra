import type { DetailTab } from "../../stores/uiStore";

const TABS: { key: DetailTab; label: string }[] = [
  { key: "body", label: "正文" },
  { key: "produce", label: "产出" },
  { key: "tasks", label: "任务" },
  { key: "acceptance", label: "验收" },
  { key: "activity", label: "活动" },
];

interface TabBarProps {
  activeTab: DetailTab;
  onSelectTab: (tab: DetailTab) => void;
}

export function TabBar({ activeTab, onSelectTab }: TabBarProps) {
  return (
    <div className="flex flex-none items-center justify-between gap-2 border-b border-(--border) py-1 pr-2 pl-3" role="tablist">
      <div className="flex min-w-0 flex-1 gap-0.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => onSelectTab(tab.key)}
            className={`min-w-0 flex-1 rounded-(--r-sm) px-2.5 py-1.5 text-center text-[12.5px] text-ellipsis whitespace-nowrap overflow-hidden ${
              activeTab === tab.key
                ? "bg-(--accent-solid) font-[550] text-(--accent-solid-fg)"
                : "text-(--muted) hover:text-(--fg)"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex min-h-6.5 min-w-6.5 flex-none items-center" />
    </div>
  );
}
