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
    <aside className="flex w-[min(35%,360px)] min-w-72 flex-none flex-col border-l border-(--module-scope-border-subtle) bg-(--module-scope-background-canvas) p-4">
      <div className="mb-3">
        <h2 className="m-0 text-[13px] font-[590] text-(--module-scope-text-primary)">综合预览</h2>
        <p className="m-0 mt-1 text-[12px] text-(--module-scope-text-secondary)">草稿只影响此区域，应用后才改变全局界面。</p>
      </div>
      <div data-testid="theme-preview-surface" ref={previewRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-(--r-md) border border-(--module-scope-border-subtle) bg-(--module-scope-background-canvas) p-2.5">
        <div className="theme-module-topbar flex h-8 items-center justify-between rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-canvas) px-2.5">
          <span className="text-[11px] font-[590] text-(--module-scope-text-primary)">Morfra / 示例项目</span>
          <div className="flex items-center gap-1">
            <button type="button" className="rounded-(--r-sm) border-none bg-transparent px-1.5 py-0.5 text-[10px] text-(--module-scope-text-secondary) hover:bg-(--module-scope-action-soft) hover:text-(--module-scope-action-strong)">
              默认 / 悬停
            </button>
            <span className="rounded-(--r-sm) bg-(--module-scope-context-soft) px-1.5 py-0.5 text-[10px] text-(--module-scope-context-strong)">已打开</span>
          </div>
        </div>
        <div className="theme-module-board rounded-(--r-md) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-[590] text-(--module-scope-context-strong)">进行中</span>
            <span className="font-(family-name:--font-mono) text-[10px] text-(--module-scope-text-tertiary)">3 条需求</span>
          </div>
          <div className="rounded-(--r-sm) border-l-2 border-(--module-scope-context-strong) bg-(--module-scope-context-soft) p-2">
            <p className="m-0 text-[12px] font-[550] text-(--module-scope-text-primary)">建立主题草稿</p>
            <p className="m-0 mt-1 text-[11px] text-(--module-scope-text-secondary)">看板、详情和设置页使用同一套语义映射。</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-(--module-scope-action-soft)">
              <div className="h-full w-3/5 rounded-full bg-(--module-scope-action-base)" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-(--module-scope-text-secondary)">
            <span className="size-1.5 rounded-full bg-(--module-scope-context-strong)" aria-hidden="true" />
            <span>空状态：暂无其他实体</span>
            <button type="button" aria-pressed="true" className="ml-auto rounded-(--r-sm) border-none bg-(--module-scope-action-strong) px-1.5 py-0.5 text-(--module-scope-background-surface) active:bg-(--module-scope-action-base) active:text-(--module-scope-background-surface)">
              按下
            </button>
          </div>
        </div>
        <div className="theme-module-detail rounded-(--r-md) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) p-2.5">
          <div className="flex items-center justify-between border-b border-(--module-scope-border-subtle) pb-2">
            <span className="text-[11px] font-[590] text-(--module-scope-text-primary)">详情</span>
            <div role="tablist" className="flex gap-1">
              <button type="button" role="tab" aria-selected="true" className="rounded-(--r-sm) border-none bg-(--module-scope-context-soft) px-1.5 py-0.5 text-[10px] text-(--module-scope-context-strong)">正文</button>
              <button type="button" role="tab" aria-selected="false" className="rounded-(--r-sm) border-none bg-transparent px-1.5 py-0.5 text-[10px] text-(--module-scope-text-secondary)">任务</button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-(--module-scope-text-secondary)">优先级</span>
            <span className="font-[550] text-(--module-scope-text-primary)">P1</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 rounded-(--r-sm) border border-(--module-scope-feedback-danger) bg-(--module-scope-feedback-danger-soft) px-2 py-1 text-[10px] text-(--module-scope-feedback-danger)">
            <span aria-hidden="true">!</span>
            <span>错误状态：对比度不足</span>
          </div>
          <div className="theme-module-business mt-1 flex items-center justify-between text-[11px]">
            <span className="text-(--module-scope-text-secondary)">状态</span>
            <span className="inline-flex items-center gap-1 text-(--module-scope-feedback-success)"><span aria-hidden="true" className="size-1.5 rounded-full bg-(--module-scope-feedback-success)" />✓ 已通过</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="theme-module-settings rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) p-2">
            <span className="text-[10px] text-(--module-scope-text-tertiary)">详情</span>
            <p className="m-0 mt-1 text-[11px] font-[550] text-(--module-scope-text-primary)">语义色编辑器</p>
            <button type="button" className="mt-2 rounded-(--r-sm) border-none bg-(--module-scope-action-strong) px-2 py-1 text-[10px] text-(--module-scope-background-surface)">
              应用
            </button>
          </div>
          <div className="theme-module-feedback rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) p-2">
            <span className="text-[10px] text-(--module-scope-text-tertiary)">系统反馈</span>
            <p className={"m-0 mt-1 text-[11px] font-[550] " + (hasValidationErrors ? "text-(--module-scope-feedback-danger)" : "text-(--module-scope-feedback-success)")}>
              {hasValidationErrors ? "对比度待修复" : "对比度通过"}
            </p>
            <p className="m-0 mt-1 text-[10px] text-(--module-scope-feedback-danger)">错误示例</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) p-2">
            <p className="m-0 text-(--module-scope-text-tertiary)">加载态</p>
            <div className="mt-1.5 h-1.5 animate-pulse rounded-full bg-(--module-scope-context-soft)" />
            <div className="mt-1 h-1.5 w-2/3 animate-pulse rounded-full bg-(--module-scope-context-soft)" />
          </div>
          <div className="rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) p-2">
            <p className="m-0 text-(--module-scope-text-tertiary)">焦点态</p>
            <button type="button" className="mt-1.5 rounded-(--r-sm) border border-(--module-scope-action-base) bg-(--module-scope-action-soft) px-2 py-1 text-(--module-scope-action-strong) outline-2 outline-(--module-scope-action-base) outline-offset-1">
              键盘焦点
            </button>
          </div>
        </div>
        <button type="button" disabled className="rounded-(--r-sm) border border-(--module-scope-border-strong) bg-(--module-scope-background-surface) px-2 py-1.5 text-left text-[10px] text-(--module-scope-text-tertiary) disabled:cursor-not-allowed">
          禁用控件 · 语义弱化
        </button>
        <div className="rounded-(--r-sm) border border-(--module-scope-border-subtle) bg-(--module-scope-background-elevated) p-2 text-[11px] text-(--module-scope-text-tertiary)">
          禁用态使用当前语义中性色阶，并保持可读性。
        </div>
      </div>
    </aside>
  );
}
