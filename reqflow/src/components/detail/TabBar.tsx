import type { DetailTab } from "../../stores/uiStore";
import type { TabDefinition } from "../../types/schema";

interface TabBarProps {
  activeTab: DetailTab;
  onSelectTab: (tab: DetailTab) => void;
  tabs: TabDefinition[];
  slot?: React.ReactNode;
}

export function TabBar({ activeTab, onSelectTab, tabs, slot }: TabBarProps) {
  return (
    <div className="flex flex-none items-center justify-between gap-2 border-b border-(--module-scope-border-subtle) py-1 pr-2 pl-3" role="tablist">
      <div className="flex min-w-0 flex-1 gap-0.5">
        {tabs.filter((tab) => tab.visible).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`min-w-0 flex-1 rounded-(--r-sm) px-2.5 py-1.5 text-center text-[12.5px] text-ellipsis whitespace-nowrap overflow-hidden ${
              activeTab === tab.id
                ? "bg-(--module-scope-context-soft) font-[550] text-(--module-scope-context-strong)"
                : "text-(--module-scope-text-secondary) hover:bg-(--module-scope-action-soft) hover:text-(--module-scope-action-strong)"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>
      <div className="flex min-h-6.5 min-w-6.5 flex-none items-center">{slot}</div>
    </div>
  );
}
