import { describe, expect, it } from "vitest";
import { createDefaultTheme } from "./themeDefaults";
import { isHexColor, validateThemeConfig } from "./themeValidation";

describe("themeValidation", () => {
  it("接受 v3 中性色与冷蓝默认主题", () => {
    expect(validateThemeConfig(createDefaultTheme())).toMatchObject({ valid: true });
  });

  it("允许中性色参与结构层级，不再执行 v2 禁灰门禁", () => {
    expect(isHexColor("#808080")).toBe(true);
    expect(isHexColor("#F7F7F7")).toBe(true);
    const neutralTheme = createDefaultTheme();
    neutralTheme.semantic.borderStrong = "#808080";

    expect(validateThemeConfig(neutralTheme)).toMatchObject({ valid: true });
  });

  it("拒绝不支持的版本和损坏的颜色", () => {
    const unsupportedVersion = { ...createDefaultTheme(), version: 1 };
    const invalidColor = createDefaultTheme();
    invalidColor.palette.blue500 = "#GGGGGG";

    expect(validateThemeConfig(unsupportedVersion)).toMatchObject({ valid: false, reason: "配置版本不受支持" });
    expect(validateThemeConfig(invalidColor)).toMatchObject({ valid: false, reason: "基础色 blue500 无效" });
  });

  it("对语义色执行 WCAG 门禁并返回具体字段", () => {
    const invalidTheme = createDefaultTheme();
    invalidTheme.semantic.textPrimary = "#FFFFFF";

    const result = validateThemeConfig(invalidTheme);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues?.some((issue) => issue.field === "semantic.textPrimary")).toBe(true);
      expect(result.reason).toContain("对比度不足");
    }
  });

  it("保留危险色和警告色的语义角色约束", () => {
    const invalidAction = createDefaultTheme();
    invalidAction.semantic.actionStrong = "danger";
    const invalidWarning = createDefaultTheme();
    invalidWarning.semantic.feedbackWarning = "blue700";

    expect(validateThemeConfig(invalidAction)).toMatchObject({
      valid: false,
      issues: [{ field: "semantic.actionStrong", message: "普通操作和结构角色不能占用红色或黄色保留色" }],
    });
    expect(validateThemeConfig(invalidWarning)).toMatchObject({
      valid: false,
      issues: [{ field: "semantic.feedbackWarning", message: "警告反馈只能使用黄色语义色" }],
    });
  });

  it("主要操作色作为普通文字使用时必须达到 4.5:1", () => {
    const invalidTheme = createDefaultTheme();
    invalidTheme.semantic.actionStrong = "#AAB4C5";

    const result = validateThemeConfig(invalidTheme);

    expect(result).toMatchObject({
      valid: false,
      reason: "actionStrong 与 backgroundSurface 对比度不足（需 ≥4.5:1）",
    });
  });

  it("覆盖真实弱背景上的操作与反馈文字对比度", () => {
    const invalidTheme = createDefaultTheme();
    invalidTheme.semantic.actionSoft = "#8FB2FF";

    const result = validateThemeConfig(invalidTheme);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues?.some((issue) => issue.field === "semantic.actionStrong" && issue.message.includes("actionSoft"))).toBe(true);
    }
  });

  it("校验操作文字在选中与浮层背景上的对比度", () => {
    const invalidTheme = createDefaultTheme();
    invalidTheme.semantic.actionStrong = "#9AB8F5";

    const result = validateThemeConfig(invalidTheme);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues?.some((issue) => issue.field === "semantic.actionStrong" && issue.message.includes("contextSoft"))).toBe(true);
    }
  });

  it("允许产品强调色与业务颜色按职责使用，不强制指定绿紫结构色", () => {
    const customTheme = createDefaultTheme();
    customTheme.moduleOverrides.board = { actionBase: "neutral700", contextSoft: "blue50" };

    expect(validateThemeConfig(customTheme)).toMatchObject({ valid: true });
  });

  it("对模块覆盖重复执行 WCAG 门禁并定位到模块字段", () => {
    const invalidModuleTheme = createDefaultTheme();
    invalidModuleTheme.moduleOverrides.board = { textPrimary: "#FFFFFF" };

    const result = validateThemeConfig(invalidModuleTheme);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues?.some((issue) => issue.field === "moduleOverrides.board.textPrimary")).toBe(true);
      expect(result.reason).toContain("对比度不足");
    }
  });
});
