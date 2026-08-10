import { describe, expect, it } from "vitest";
import { createSafeAnalysisDeltaEmitter, safeAnalysisNarrative } from "./analysisNarrative";

describe("表格分析安全叙述流", () => {
  it("任意语言的模型原文都不会进入表格分析叙述", () => {
    expect(safeAnalysisNarrative("模型称共有 999 条")).toBe("分析说明已整理；精确数值、范围和记录仅由本地校验结果呈现。");
    expect(safeAnalysisNarrative("There are three records")).toBe("分析说明已整理；精确数值、范围和记录仅由本地校验结果呈现。");
  });

  it("模型流只推进固定安全进度，停止完成包也不会回显模型原文", () => {
    const deltas: string[] = [];
    const emitter = createSafeAnalysisDeltaEmitter((delta) => deltas.push(delta));
    emitter.push("There are three records.");
    emitter.push("模型称共有 999 条。");
    emitter.flush("停止前已有内容");
    expect(deltas).toEqual(["正在基于本地校验结果生成分析说明…", "正在整理可验证的结论…", "正在完成回答…"]);
  });
});
