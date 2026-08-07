import { describe, expect, it } from "vitest";
import { createDefaultTheme } from "./themeDefaults";
import { isForbiddenGray, validateThemeConfig } from "./themeValidation";

describe("themeValidation", () => {
  it("接受 Design-Brief 定义的默认主题", () => {
    expect(validateThemeConfig(createDefaultTheme())).toMatchObject({ valid: true });
  });

  it("拒绝中性灰，但保留白色与暖白基底", () => {
    expect(isForbiddenGray("#808080")).toBe(true);
    expect(isForbiddenGray("#F7F7F7")).toBe(true);
    expect(isForbiddenGray("#FAFAFA")).toBe(true);
    expect(isForbiddenGray("#FFFFFF")).toBe(false);
    expect(isForbiddenGray("#FCFCFA")).toBe(false);
  });

  it("拒绝不支持的版本和损坏的颜色", () => {
    const unsupportedVersion = { ...createDefaultTheme(), version: 2 };
    const invalidColor = createDefaultTheme();
    invalidColor.palette.green500 = "#808080";

    expect(validateThemeConfig(unsupportedVersion)).toMatchObject({ valid: false, reason: "配置版本不受支持" });
    expect(validateThemeConfig(invalidColor)).toMatchObject({ valid: false, reason: "基础色 green500 无效" });
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

  it("拒绝语义层手动输入的中性灰", () => {
    const invalidTheme = createDefaultTheme();
    invalidTheme.semantic.actionStrong = "#808080";

    expect(validateThemeConfig(invalidTheme)).toMatchObject({
      valid: false,
      reason: "语义色 actionStrong 无效",
      issues: [{ field: "semantic.actionStrong" }],
    });
  });

  it("红黄保留色只能分配给对应反馈角色", () => {
    const invalidAction = createDefaultTheme();
    invalidAction.semantic.actionStrong = "danger";
    const invalidWarning = createDefaultTheme();
    invalidWarning.semantic.feedbackWarning = "purple700";

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
    invalidTheme.semantic.actionStrong = "#4F9200";

    const result = validateThemeConfig(invalidTheme);
    expect(result).toMatchObject({
      valid: false,
      reason: "actionStrong 与 backgroundSurface 对比度不足（需 ≥4.5:1）",
    });
    if (!result.valid) {
      expect(result.issues?.some((issue) => issue.field === "semantic.actionStrong")).toBe(true);
    }
  });
});
