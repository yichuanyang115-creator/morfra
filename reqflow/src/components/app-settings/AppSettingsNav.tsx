import type { AppSettingsSection } from "../../stores/uiStore";

interface AppSettingsNavProps {
  section: AppSettingsSection;
  onSelect: (section: AppSettingsSection) => void;
}

const navItemClass = (active: boolean) =>
  active
    ? "w-full rounded-(--r-sm) bg-(--accent-selected) px-2.5 py-1.75 text-left text-[13px] font-[550] text-(--context-strong)"
    : "w-full rounded-(--r-sm) px-2.5 py-1.75 text-left text-[13px] text-(--muted) hover:bg-(--accent-soft) hover:text-(--accent-text)";

export function AppSettingsNav({ section, onSelect }: AppSettingsNavProps) {
  return (
    <nav aria-label="应用设置导航" className="flex w-48 flex-none flex-col gap-0.5 border-r border-(--border) p-3">
      <span className="px-2.5 py-1 font-(family-name:--font-mono) text-[11px] tracking-[0.04em] text-(--muted-2)">应用设置</span>
      <button type="button" className={navItemClass(section === "appearance")} onClick={() => onSelect("appearance")}>
        外观
      </button>
      <button type="button" className={navItemClass(section === "version")} onClick={() => onSelect("version")}>
        版本
      </button>
    </nav>
  );
}
