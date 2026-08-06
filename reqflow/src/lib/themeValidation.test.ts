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
});
