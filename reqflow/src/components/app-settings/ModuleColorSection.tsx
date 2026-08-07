import { useThemeStore } from "../../stores/themeStore";
import type { SemanticToken, ThemeModule } from "../../types/theme";
import { ThemeColorField } from "./ThemeColorField";

const MODULE_EDIT_TOKENS: SemanticToken[] = [
  "backgroundCanvas",
  "backgroundSurface",
  "backgroundElevated",
  "textPrimary",
  "textSecondary",
  "textTertiary",
  "textDisabled",
  "borderSubtle",
  "borderStrong",
  "actionStrong",
  "actionBase",
  "actionSoft",
  "contextStrong",
  "contextSoft",
];

const TOKEN_LABELS: Partial<Record<SemanticToken, string>> = {
  backgroundCanvas: "模块底色",
  backgroundSurface: "内容表面",
  backgroundElevated: "浮层表面",
  textPrimary: "主要文字",
  textSecondary: "次要文字",
  textTertiary: "弱化文字",
  textDisabled: "禁用文字",
  borderSubtle: "普通边框",
  borderStrong: "强调边框",
  actionStrong: "主要操作",
  actionBase: "焦点与激活",
  actionSoft: "悬停背景",
  contextStrong: "选中文字",
  contextSoft: "选中背景",
};

interface ModuleColorSectionProps {
  moduleName: ThemeModule;
  label: string;
  issuesByField: Map<string, string>;
  onChange: () => void;
}

export function ModuleColorSection({ moduleName, label, issuesByField, onChange }: ModuleColorSectionProps) {
  const draftTheme = useThemeStore((state) => state.draftTheme);
  const enableModuleOverride = useThemeStore((state) => state.enableModuleOverride);
  const updateModuleOverride = useThemeStore((state) => state.updateModuleOverride);
  const clearModuleOverride = useThemeStore((state) => state.clearModuleOverride);
  if (!draftTheme) return null;

  const overrides = draftTheme.moduleOverrides[moduleName];
  const isCustom = overrides !== undefined;

  return (
    <section className="rounded-(--r-md) border border-(--border) bg-(--surface) p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="m-0 text-[12.5px] font-[590] text-(--fg)">{label}</h3>
          <span className="text-[11px] text-(--muted-2)">{isCustom ? "自定义" : "跟随主题"}</span>
        </div>
        <label className="inline-flex items-center gap-2 text-[12px] text-(--context-strong)">
          <input
            type="checkbox"
            aria-label={`${label}：自定义此模块`}
            checked={isCustom}
            onChange={(event) => {
              onChange();
              if (event.target.checked) enableModuleOverride(moduleName, MODULE_EDIT_TOKENS);
              else clearModuleOverride(moduleName);
            }}
          />
          自定义此模块
        </label>
      </div>
      {isCustom && (
        <div className="mt-3 border-t border-(--border) pt-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {MODULE_EDIT_TOKENS.map((token) => (
              <ThemeColorField
                key={token}
                idPrefix={`module-${moduleName}`}
                token={token}
                label={TOKEN_LABELS[token] ?? token}
                value={overrides[token] ?? draftTheme.semantic[token]}
                error={issuesByField.get(`moduleOverrides.${moduleName}.${token}`)}
                onChange={(value) => {
                  onChange();
                  updateModuleOverride(moduleName, token, value);
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onChange();
              clearModuleOverride(moduleName);
            }}
            className="mt-3 rounded-(--r-sm) border-none bg-transparent px-0 py-1 text-[12px] text-(--context-strong) hover:text-(--accent-text)"
          >
            恢复跟随主题
          </button>
        </div>
      )}
    </section>
  );
}
