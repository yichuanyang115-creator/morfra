import { useEffect, useRef } from "react";
import { applyTheme } from "../../lib/themeRuntime";
import type { AppThemeConfig } from "../../types/theme";

interface ThemePreviewProps {
  theme: AppThemeConfig;
  hasValidationErrors?: boolean;
}

export function ThemePreview({ theme, hasValidationErrors = false }: ThemePreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previewRef.current) applyTheme(theme, previewRef.current.style);
  }, [theme]);

  return (
    <aside className="flex w-[min(35%,360px)] min-w-72 flex-none flex-col border-l border-(--border) bg-(--bg) p-4">
      <div className="mb-3">
        <h2 className="m-0 text-[13px] font-[590] text-(--fg)">综合预览</h2>
        <p className="m-0 mt-1 text-[12px] text-(--muted)">草稿只影响此区域，应用后才改变全局界面。</p>
      </div>
      <div data-testid="theme-preview-surface" ref={previewRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-(--r-md) border border-(--border) bg-(--bg) p-2.5">
        <div className="flex h-8 items-center justify-between rounded-(--r-sm) border border-(--border) bg-(--topbar) px-2.5">
          <span className="text-[11px] font-[590] text-(--fg)">reqflow / 示例项目</span>
          <span className="rounded-(--r-sm) bg-(--accent-soft) px-1.5 py-0.5 text-[10px] text-(--accent-text)">应用设置</span>
        </div>
        <div className="rounded-(--r-md) border border-(--border) bg-(--surface) p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-[590] text-(--context-strong)">进行中</span>
            <span className="font-(family-name:--font-mono) text-[10px] text-(--muted-2)">3 条需求</span>
          </div>
          <div className="rounded-(--r-sm) border-l-2 border-(--context-strong) bg-(--accent-selected) p-2">
            <p className="m-0 text-[12px] font-[550] text-(--fg)">建立主题草稿</p>
            <p className="m-0 mt-1 text-[11px] text-(--muted)">看板、详情和设置页使用同一套语义映射。</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-(--accent-soft)">
              <div className="h-full w-3/5 rounded-full bg-(--accent)" />
            </div>
          </div>
        </div>
        <div className="rounded-(--r-md) border border-(--border) bg-(--surface) p-2.5">
          <div className="flex items-center justify-between border-b border-(--border) pb-2">
            <span className="text-[11px] font-[590] text-(--fg)">详情</span>
            <div role="tablist" className="flex gap-1">
              <button type="button" role="tab" aria-selected="true" className="rounded-(--r-sm) border-none bg-(--accent-selected) px-1.5 py-0.5 text-[10px] text-(--context-strong)">正文</button>
              <button type="button" role="tab" aria-selected="false" className="rounded-(--r-sm) border-none bg-transparent px-1.5 py-0.5 text-[10px] text-(--muted)">任务</button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-(--muted)">优先级</span>
            <span className="font-[550] text-(--fg)">P1</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-(--muted)">状态</span>
            <span className="text-(--st-done)">✓ 已通过</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-(--r-sm) border border-(--border) bg-(--surface) p-2">
            <span className="text-[10px] text-(--muted-2)">详情</span>
            <p className="m-0 mt-1 text-[11px] font-[550] text-(--fg)">语义色编辑器</p>
            <button type="button" className="mt-2 rounded-(--r-sm) border-none bg-(--accent-solid) px-2 py-1 text-[10px] text-(--accent-solid-fg)">
              应用
            </button>
          </div>
          <div className="rounded-(--r-sm) border border-(--border) bg-(--surface) p-2">
            <span className="text-[10px] text-(--muted-2)">系统反馈</span>
            <p className={"m-0 mt-1 text-[11px] font-[550] " + (hasValidationErrors ? "text-(--st-blocked)" : "text-(--st-done)")}>
              {hasValidationErrors ? "对比度待修复" : "对比度通过"}
            </p>
            <p className="m-0 mt-1 text-[10px] text-(--st-blocked)">错误示例</p>
          </div>
        </div>
        <button type="button" disabled className="rounded-(--r-sm) border border-(--border-strong) bg-(--surface) px-2 py-1.5 text-left text-[10px] text-(--semantic-text-disabled) disabled:cursor-not-allowed">
          禁用控件 · 保留色相
        </button>
        <div className="rounded-(--r-sm) border border-(--border) bg-(--surface-2) p-2 text-[11px] text-(--muted-2)">
          禁用态保留色相，不使用中性灰。
        </div>
      </div>
    </aside>
  );
}
