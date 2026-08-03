import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Schema } from "../../types/schema";
import { SchemaSettingsPage } from "./SchemaSettingsPage";

function makeSchema(): Schema {
  return {
    version: 1,
    stageOptions: [{ id: "collect", label: "收集", color: "hsl(0,0%,90%)", isTerminal: false }],
    attributes: [{ id: "priority", name: "优先级", type: "singleSelect", showOnBoard: true, showOnDetail: true }],
    tabs: [{ id: "tasks", name: "任务", renderer: "tasks", visible: true }],
    viewPreferences: { columnOrder: [], columnWidths: {} },
  };
}

describe("SchemaSettingsPage（Phase 18 骨架）", () => {
  it("渲染左侧导航（阶段/属性/各 Tab）和当前区域内容", () => {
    render(
      <SchemaSettingsPage schema={makeSchema()} section={{ kind: "stages" }} onSelectSection={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByText("阶段")).toBeInTheDocument();
    expect(screen.getByText("属性")).toBeInTheDocument();
    expect(screen.getByText("任务")).toBeInTheDocument();
    expect(screen.getByText("阶段管理区域即将上线")).toBeInTheDocument();
  });

  it("点击导航项触发 onSelectSection 切换区域", async () => {
    const onSelectSection = vi.fn();
    render(
      <SchemaSettingsPage schema={makeSchema()} section={{ kind: "stages" }} onSelectSection={onSelectSection} onClose={vi.fn()} />,
    );

    await userEvent.click(screen.getByText("属性"));
    expect(onSelectSection).toHaveBeenCalledWith({ kind: "attributes" });

    await userEvent.click(screen.getByText("任务"));
    expect(onSelectSection).toHaveBeenCalledWith({ kind: "tab", tabId: "tasks" });
  });

  it("点击关闭按钮触发 onClose", async () => {
    const onClose = vi.fn();
    render(<SchemaSettingsPage schema={makeSchema()} section={{ kind: "stages" }} onSelectSection={vi.fn()} onClose={onClose} />);

    await userEvent.click(screen.getByLabelText("关闭设置"));
    expect(onClose).toHaveBeenCalled();
  });

  it("保存为模板按钮本 Phase 是禁用占位", () => {
    render(<SchemaSettingsPage schema={makeSchema()} section={{ kind: "stages" }} onSelectSection={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText("保存为模板")).toBeDisabled();
  });
});
