import type { AppSettingsSection } from "../../stores/uiStore";

interface AppSettingsNavProps {
  section: AppSettingsSection;
  onSelect: (section: AppSettingsSection) => void;
}

const navItemClass = (active: boolean) =>
  active
    ? "w-full rounded-(--r-sm) bg-(--module-scope-context-soft) px-2.5 py-1.75 text-left text-[13px] font-[550] text-(--module-scope-context-strong)"
    : "w-full rounded-(--r-sm) px-2.5 py-1.75 text-left text-[13px] text-(--module-scope-text-secondary) hover:bg-(--module-scope-action-soft) hover:text-(--module-scope-action-strong)";

export function AppSettingsNav({ section, onSelect }: AppSettingsNavProps) {
  return (
    <nav aria-label="应用设置导航" className="flex w-48 flex-none flex-col gap-0.5 border-r border-(--module-scope-border-subtle) p-3">
      <span className="px-2.5 py-1 font-(family-name:--font-mono) text-[11px] tracking-[0.04em] text-(--module-scope-text-tertiary)">应用设置</span>
      <button type="button" className={navItemClass(section === "appearance")} onClick={() => onSelect("appearance")}>
        外观
      </button>
      <button type="button" className={navItemClass(section === "ai-service")} onClick={() => onSelect("ai-service")}>
        AI 服务
      </button>
      <button type="button" className={navItemClass(section === "version")} onClick={() => onSelect("version")}>
        版本
      </button>
    </nav>
  );
}
