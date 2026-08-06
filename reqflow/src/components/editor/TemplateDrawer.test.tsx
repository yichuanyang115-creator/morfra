import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateDrawer } from "./TemplateDrawer";
import { BODY_TEMPLATES } from "../../lib/templates";

describe("TemplateDrawer", () => {
  it("渲染出两套模板名称（功能条目模板、优化条目模板）", () => {
    render(<TemplateDrawer onInsert={vi.fn()} />);
    for (const template of BODY_TEMPLATES) {
      expect(screen.getByText(template.name)).toBeInTheDocument();
    }
  });

  it("点击某个模板名称，onInsert 收到该模板对应的 markdown 引导文字", async () => {
    const onInsert = vi.fn();
    render(<TemplateDrawer onInsert={onInsert} />);

    const featureTemplate = BODY_TEMPLATES.find((t) => t.id === "feature");
    if (!featureTemplate) throw new Error("测试前提缺失：找不到功能条目模板");

    await userEvent.click(screen.getByText(featureTemplate.name));

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith(featureTemplate.markdown);
  });

  it("点击优化条目模板，onInsert 收到的是优化模板内容而不是功能模板内容", async () => {
    const onInsert = vi.fn();
    render(<TemplateDrawer onInsert={onInsert} />);

    const optimizationTemplate = BODY_TEMPLATES.find((t) => t.id === "optimization");
    if (!optimizationTemplate) throw new Error("测试前提缺失：找不到优化条目模板");

    await userEvent.click(screen.getByText(optimizationTemplate.name));

    expect(onInsert).toHaveBeenCalledWith(optimizationTemplate.markdown);
    expect(onInsert).not.toHaveBeenCalledWith(
      BODY_TEMPLATES.find((t) => t.id === "feature")?.markdown,
    );
  });
});
