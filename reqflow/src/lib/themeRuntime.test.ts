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
    expect(root.getPropertyValue("--accent-selected")).toBe("#F5EFF8");
  });

  it("支持语义层使用显式合法色，而不是只限于调色板引用", () => {
    const config = createDefaultTheme();
    config.semantic.actionBase = "#4F9200";

    expect(resolveTheme(config).semantic.actionBase).toBe("#4F9200");
  });

  it("模块未覆盖时继承语义层，显式覆盖只影响对应模块", () => {
    const config = createDefaultTheme();
    config.moduleOverrides.board = { rowSelectedBg: "green50" };

    const resolved = resolveTheme(config);

    expect(resolved.modules.board.contextSoft).toBe("#F5EFF8");
    expect(resolved.modules.board.rowSelectedBg).toBe("#F4FAEC");
    expect(resolved.modules.detail.rowSelectedBg).toBeUndefined();
  });
});
