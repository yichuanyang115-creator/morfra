import { describe, expect, it } from "vitest";
import { createDefaultTheme } from "./themeDefaults";
import { applyTheme, resolveTheme } from "./themeRuntime";

describe("themeRuntime", () => {
  it("解析 Primitive → Semantic 引用，并桥接已有 CSS 变量", () => {
    const config = createDefaultTheme();
    config.palette.green500 = "#4F9200";
    const root = document.createElement("div").style;

    const resolved = applyTheme(config, root);

    expect(resolved.semantic.actionBase).toBe("#4F9200");
    expect(root.getPropertyValue("--semantic-action-base")).toBe("#4F9200");
    expect(root.getPropertyValue("--accent")).toBe("#4F9200");
    expect(root.getPropertyValue("--semantic-action-soft")).toBe("#F4FAEC");
    expect(root.getPropertyValue("--semantic-context-soft")).toBe("#F5EFF8");
    expect(root.getPropertyValue("--accent-selected")).toBe("#F5EFF8");
    expect(root.getPropertyValue("--sev-p0-soft")).toContain("var(--semantic-feedback-danger)");
    expect(root.getPropertyValue("--st-done-soft")).toContain("var(--semantic-feedback-success)");
  });

  it("支持语义层使用显式合法色，而不是只限于调色板引用", () => {
    const config = createDefaultTheme();
    config.semantic.actionBase = "#4F9200";

    expect(resolveTheme(config).semantic.actionBase).toBe("#4F9200");
  });

  it("模块未覆盖时继承语义层，显式覆盖只影响对应模块", () => {
    const config = createDefaultTheme();
    config.moduleOverrides.board = { contextSoft: "purple100" };

    const resolved = resolveTheme(config);

    expect(resolved.modules.board.contextSoft).toBe("#E8DDF0");
    expect(resolved.modules.detail.contextSoft).toBe("#F5EFF8");
  });

  it("业务与反馈模块也能独立覆盖反馈色并生成对应 CSS 变量", () => {
    const config = createDefaultTheme();
    config.moduleOverrides.business = { feedbackSuccess: "green500" };
    config.moduleOverrides.feedback = { feedbackDanger: "danger" };
    const root = document.createElement("div").style;

    const resolved = applyTheme(config, root);

    expect(resolved.modules.business.feedbackSuccess).toBe("#5B9F00");
    expect(resolved.modules.feedback.feedbackDanger).toBe("#B3261E");
    expect(root.getPropertyValue("--module-business-feedback-success")).toBe("#5B9F00");
    expect(root.getPropertyValue("--module-feedback-feedback-danger")).toBe("#B3261E");
  });

  it("为每个模块写入独立 CSS 变量，清除覆盖后重新跟随语义层", () => {
    const config = createDefaultTheme();
    config.moduleOverrides.board = { contextSoft: "purple100" };
    const root = document.createElement("div").style;

    applyTheme(config, root);
    expect(root.getPropertyValue("--module-board-context-soft")).toBe("#E8DDF0");
    expect(root.getPropertyValue("--module-detail-context-soft")).toBe("#F5EFF8");

    delete config.moduleOverrides.board;
    config.semantic.contextSoft = "#F2E8F7";
    applyTheme(config, root);
    expect(root.getPropertyValue("--module-board-context-soft")).toBe("#F2E8F7");
  });
});
