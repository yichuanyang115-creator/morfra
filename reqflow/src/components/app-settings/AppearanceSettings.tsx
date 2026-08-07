import { useEffect, useMemo, useRef, useState } from "react";
import { useThemeStore } from "../../stores/themeStore";
import type { SemanticToken } from "../../types/theme";
import { ThemeColorField } from "./ThemeColorField";
import { ThemePreview } from "./ThemePreview";
import { ModuleColorSection } from "./ModuleColorSection";

const SEMANTIC_LABELS: Record<SemanticToken, string> = {
  backgroundCanvas: "应用底色",
  backgroundSurface: "内容表面",
  backgroundElevated: "浮层表面",
  textPrimary: "主要文字",
  textSecondary: "次要文字",
  textTertiary: "弱化文字",
  textDisabled: "禁用文字",
  borderSubtle: "普通边框",
  borderStrong: "强调边框",
  actionStrong: "主要操作",
  actionBase: "交互焦点",
  actionSoft: "操作弱背景",
  contextStrong: "结构强调",
  contextSoft: "结构弱背景",
  feedbackSuccess: "成功反馈",
  feedbackWarning: "警告反馈",
  feedbackDanger: "危险反馈",
};

const SEMANTIC_GROUPS: Array<{ title: string; tokens: SemanticToken[] }> = [
  { title: "背景与边框", tokens: ["backgroundCanvas", "backgroundSurface", "backgroundElevated", "borderSubtle", "borderStrong"] },
  { title: "文字", tokens: ["textPrimary", "textSecondary", "textTertiary", "textDisabled"] },
  { title: "操作与结构", tokens: ["actionStrong", "actionBase", "actionSoft", "contextStrong", "contextSoft"] },
  { title: "反馈", tokens: ["feedbackSuccess", "feedbackWarning", "feedbackDanger"] },
];

export function AppearanceSettings({ onClose }: { onClose: () => void }) {
  const draftTheme = useThemeStore((state) => state.draftTheme);
  const draftIssues = useThemeStore((state) => state.draftIssues);
  const beginDraft = useThemeStore((state) => state.beginDraft);
  const updateDraft = useThemeStore((state) => state.updateDraft);
  const resetDraft = useThemeStore((state) => state.resetDraft);
  const cancelDraft = useThemeStore((state) => state.cancelDraft);
  const applyDraft = useThemeStore((state) => state.applyDraft);
  const [appliedNotice, setAppliedNotice] = useState(false);
  const startedDraft = useRef(false);

  useEffect(() => {
    if (!startedDraft.current) {
      startedDraft.current = true;
      beginDraft();
    }
  }, [beginDraft]);

  const issuesByField = useMemo(
    () => new Map(draftIssues.map((issue) => [issue.field, issue.message])),
    [draftIssues],
  );

  if (!draftTheme) return <div className="p-6 text-[13px] text-(--muted)">准备外观草稿…</div>;

  const updateSemantic = (token: SemanticToken, value: string) => {
    setAppliedNotice(false);
    updateDraft((theme) => ({ ...theme, semantic: { ...theme.semantic, [token]: value } }));
  };

  const handleApply = async () => {
    const applied = await applyDraft();
    setAppliedNotice(applied);
  };

  const handleReset = () => {
    setAppliedNotice(false);
    resetDraft();
  };

  const handleCancel = () => {
    cancelDraft();
    onClose();
  };

  return (
    <div className="flex min-h-0 flex-1">
      <main className="min-w-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-2xl">
          <div className="mb-5">
            <h1 className="m-0 text-[16px] font-[590] text-(--fg)">外观</h1>
            <p className="m-0 mt-1 text-[12.5px] text-(--muted)">调整语义色。灰色不会进入可选颜色，应用前会执行可读性门禁。</p>
          </div>
          {draftIssues.length > 0 && (
            <div role="alert" className="mb-4 rounded-(--r-md) border border-(--st-blocked) bg-(--st-blocked-soft) p-3">
              <p className="m-0 text-[12.5px] font-[550] text-(--st-blocked)">当前草稿不能应用</p>
              <ul className="m-0 mt-1.5 list-disc pl-5 text-[12px] text-(--st-blocked)">
                {draftIssues.map((issue) => <li key={issue.field}>{issue.message}</li>)}
              </ul>
            </div>
          )}
          {SEMANTIC_GROUPS.map((group) => (
            <section key={group.title} className="mb-5">
              <h2 className="m-0 border-b border-(--border) pb-2 text-[12.5px] font-[590] text-(--context-strong)">{group.title}</h2>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                {group.tokens.map((token) => (
                  <ThemeColorField
                    key={token}
                    token={token}
                    label={SEMANTIC_LABELS[token]}
                    value={draftTheme.semantic[token]}
                    error={issuesByField.get("semantic." + token)}
                    onChange={(value) => updateSemantic(token, value)}
                  />
                ))}
              </div>
            </section>
          ))}
          <section className="mb-24">
            <h2 className="m-0 border-b border-(--border) pb-2 text-[12.5px] font-[590] text-(--context-strong)">模块覆盖</h2>
            <p className="m-0 mt-2 text-[12px] text-(--muted)">默认跟随主题；仅开启自定义的模块会写入配置。</p>
            <div className="mt-3 grid gap-3">
              <ModuleColorSection moduleName="topbar" label="顶栏与导航" issuesByField={issuesByField} onChange={() => setAppliedNotice(false)} />
              <ModuleColorSection moduleName="board" label="看板" issuesByField={issuesByField} onChange={() => setAppliedNotice(false)} />
              <ModuleColorSection moduleName="detail" label="详情" issuesByField={issuesByField} onChange={() => setAppliedNotice(false)} />
              <ModuleColorSection moduleName="settings" label="设置页" issuesByField={issuesByField} onChange={() => setAppliedNotice(false)} />
              <ModuleColorSection moduleName="business" label="业务状态" issuesByField={issuesByField} onChange={() => setAppliedNotice(false)} />
              <ModuleColorSection moduleName="feedback" label="系统反馈" issuesByField={issuesByField} onChange={() => setAppliedNotice(false)} />
              <ModuleColorSection moduleName="chat" label="对话区" issuesByField={issuesByField} onChange={() => setAppliedNotice(false)} />
            </div>
          </section>
        </div>
      </main>
      <ThemePreview theme={draftTheme} hasValidationErrors={draftIssues.length > 0} />
      <footer className="fixed bottom-0 left-48 right-0 flex items-center justify-between border-t border-(--border) bg-(--surface) px-5 py-3">
        <button type="button" onClick={handleReset} className="rounded-(--r-sm) border-none bg-transparent px-3 py-1.5 text-[12.5px] text-(--context-strong) hover:bg-(--accent-soft)">
          恢复默认
        </button>
        <div className="flex items-center gap-2">
          {appliedNotice && <span className="text-[12px] text-(--st-done)">已应用</span>}
          <button type="button" onClick={handleCancel} className="rounded-(--r-sm) border border-(--border-strong) bg-(--surface) px-3 py-1.5 text-[12.5px] text-(--context-strong) hover:bg-(--accent-soft)">
            取消
          </button>
          <button
            type="button"
            disabled={draftIssues.length > 0}
            onClick={() => void handleApply()}
            className="rounded-(--r-sm) border-none bg-(--accent-solid) px-3 py-1.5 text-[12.5px] text-(--accent-solid-fg) hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            应用
          </button>
        </div>
      </footer>
    </div>
  );
}
