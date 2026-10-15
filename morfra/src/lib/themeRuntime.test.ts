import { describe, expect, it } from "vitest";
import { createDefaultTheme } from "./themeDefaults";
import { applyTheme, resolveTheme } from "./themeRuntime";

describe("themeRuntime", () => {
  it("解析 Primitive → Semantic 引用，并写入最终三层 CSS 变量", () => {
    const config = createDefaultTheme();
    config.palette.blue500 = "#2A63D4";
    const root = document.createElement("div").style;

    const resolved = applyTheme(config, root);

    expect(resolved.semantic.actionBase).toBe("#2A63D4");
    expect(root.getPropertyValue("--semantic-action-base")).toBe("#2A63D4");
    expect(root.getPropertyValue("--semantic-action-soft")).toBe("#E7EFFF");
    expect(root.getPropertyValue("--semantic-context-soft")).toBe("#E7EFFF");
    expect(root.getPropertyValue("--module-topbar-action-base")).toBe("#2A63D4");
    expect(root.getPropertyValue("--accent")).toBe("");
    expect(root.getPropertyValue("--st-done-soft")).toBe("");
  });

  it("支持语义层使用显式合法色，而不是只限于调色板引用", () => {
    const config = createDefaultTheme();
    config.semantic.actionBase = "#2A63D4";

    expect(resolveTheme(config).semantic.actionBase).toBe("#2A63D4");
  });

  it("模块未覆盖时继承语义层，显式覆盖只影响对应模块", () => {
    const config = createDefaultTheme();
    config.moduleOverrides.board = { contextSoft: "blue100" };

    const resolved = resolveTheme(config);

    expect(resolved.modules.board.contextSoft).toBe("#8FB2FF");
    expect(resolved.modules.detail.contextSoft).toBe("#E7EFFF");
  });

  it("应用全局操作色时所有模块同步，显式选中色覆盖继续保留", () => {
    const config = createDefaultTheme();
    config.semantic.actionStrong = "#2559C7";
    config.moduleOverrides.board = { contextSoft: "blue100" };
    const root = document.createElement("div").style;

    const resolved = applyTheme(config, root);
    const modules = ["topbar", "board", "detail", "settings", "chat", "business", "feedback"] as const;

    for (const moduleName of modules) {
      expect(resolved.modules[moduleName].actionStrong).toBe("#2559C7");
      expect(root.getPropertyValue(`--module-${moduleName}-action-strong`)).toBe("#2559C7");
    }
    expect(resolved.modules.board.contextSoft).toBe("#8FB2FF");
    expect(resolved.modules.detail.contextSoft).toBe("#E7EFFF");
  });

  it("业务与反馈模块也能独立覆盖反馈色并生成对应 CSS 变量", () => {
    const config = createDefaultTheme();
    config.moduleOverrides.business = { feedbackSuccess: "success" };
    config.moduleOverrides.feedback = { feedbackDanger: "danger" };
    const root = document.createElement("div").style;

    const resolved = applyTheme(config, root);

    expect(resolved.modules.business.feedbackSuccess).toBe("#176B3A");
    expect(resolved.modules.feedback.feedbackDanger).toBe("#C62828");
    expect(root.getPropertyValue("--module-business-feedback-success")).toBe("#176B3A");
    expect(root.getPropertyValue("--module-feedback-feedback-danger")).toBe("#C62828");
  });

  it("为每个模块写入独立 CSS 变量，清除覆盖后重新跟随语义层", () => {
    const config = createDefaultTheme();
    config.moduleOverrides.board = { contextSoft: "blue100" };
    const root = document.createElement("div").style;

    applyTheme(config, root);
    expect(root.getPropertyValue("--module-board-context-soft")).toBe("#8FB2FF");
    expect(root.getPropertyValue("--module-detail-context-soft")).toBe("#E7EFFF");

    delete config.moduleOverrides.board;
    config.semantic.contextSoft = "#D6E3FF";
    applyTheme(config, root);
    expect(root.getPropertyValue("--module-board-context-soft")).toBe("#D6E3FF");
  });
});
