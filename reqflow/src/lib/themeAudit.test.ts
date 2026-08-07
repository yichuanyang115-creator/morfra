import { describe, expect, it } from "vitest";
import { auditComponentThemeUsage, type ThemeAuditSource } from "./themeAudit";

const componentSources = import.meta.glob("../components/**/*.{ts,tsx,css}", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

describe("themeAudit", () => {
  it("组件源码不包含固定颜色、Tailwind 固定颜色或迁移期 Token", () => {
    const sources: ThemeAuditSource[] = Object.entries(componentSources).map(([file, source]) => ({ file, source }));
    expect(auditComponentThemeUsage(sources)).toEqual([]);
  });

  it("识别固定颜色和 legacy Token，但允许布局尺寸 Token", () => {
    const violations = auditComponentThemeUsage([
      {
        file: "sample.tsx",
        source: 'className="h-(--topbar-h) bg-gray-100 text-(--surface)" color="#fff"',
      },
    ]);

    expect(violations.map((violation) => violation.rule)).toEqual([
      "fixed-color-function-or-hex",
      "tailwind-fixed-color",
      "legacy-component-token",
    ]);
  });
});
