const SAFE_ANALYSIS_FALLBACK = "分析说明已整理；精确数值、范围和记录仅由本地校验结果呈现。";
const ANALYSIS_STREAM_PROGRESS = [
  "正在基于本地校验结果生成分析说明…",
  "正在整理可验证的结论…",
  "正在完成回答…",
] as const;

/** 表格回答中的模型原文不直接呈现，精确事实只由本地结构化结果呈现。 */
export function safeAnalysisNarrative(_markdown: string): string {
  return SAFE_ANALYSIS_FALLBACK;
}

/** 模型流只推进本地安全进度，避免任意语言的数词或字段值绕过本地校验。 */
export function createSafeAnalysisDeltaEmitter(onDelta?: (content: string) => void): {
  push: (delta: string) => void;
  flush: (completionContent?: string) => void;
} {
  let progressIndex = 0;
  const emitProgress = (): void => {
    const progress = ANALYSIS_STREAM_PROGRESS[progressIndex];
    if (!progress || !onDelta) return;
    progressIndex += 1;
    onDelta(progress);
  };

  return {
    push: (delta) => {
      if (!delta) return;
      emitProgress();
    },
    flush: (completionContent) => {
      if (completionContent?.trim()) emitProgress();
    },
  };
}
