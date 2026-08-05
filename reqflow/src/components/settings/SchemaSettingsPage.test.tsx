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
    viewPreferences: { columnOrder: [], columnWidths: {}, frozenCount: 0, filters: [] },
  };
}

const stageManagerProps = {
  entityCountByStage: {},
  onReorderStages: vi.fn(),
  onAddStage: vi.fn(),
  onUpdateStage: vi.fn(),
  onRemoveStage: vi.fn(),
  onReorderAttributes: vi.fn(),
  onAddAttribute: vi.fn(),
  onUpdateAttribute: vi.fn(),
  onRemoveAttribute: vi.fn(),
  countValuedAttribute: vi.fn(() => 0),
  getTypeChangeImpact: vi.fn(() => ({ totalCount: 0, lostCount: 0 })),
  onConfirmTypeChange: vi.fn(),
  onReorderTabs: vi.fn(),
  onAddTab: vi.fn(),
  onUpdateTab: vi.fn(),
  onRemoveTab: vi.fn(),
};

describe("SchemaSettingsPage（Phase 18 骨架）", () => {
  it("渲染左侧导航（阶段/属性/各 Tab）和属性区域内容", () => {
    render(
      <SchemaSettingsPage
        schema={makeSchema()}
        section={{ kind: "attributes" }}
        onSelectSection={vi.fn()}
        onClose={vi.fn()}
        {...stageManagerProps}
      />,
    );

    expect(screen.getByText("阶段")).toBeInTheDocument();
    expect(screen.getByText("属性")).toBeInTheDocument();
    expect(screen.getByText("任务")).toBeInTheDocument();
    expect(screen.getByLabelText("新建属性")).toBeInTheDocument();
  });

  it("属性区域渲染 AttributeManager（新建属性入口）而非占位文案", () => {
    render(
      <SchemaSettingsPage
        schema={makeSchema()}
        section={{ kind: "attributes" }}
        onSelectSection={vi.fn()}
        onClose={vi.fn()}
        {...stageManagerProps}
      />,
    );

    expect(screen.getByText("优先级")).toBeInTheDocument();
    expect(screen.queryByText("属性管理区域即将上线")).not.toBeInTheDocument();
  });

  it("阶段区域渲染 StageManager（新建阶段入口）而非占位文案", () => {
    render(
      <SchemaSettingsPage
        schema={makeSchema()}
        section={{ kind: "stages" }}
        onSelectSection={vi.fn()}
        onClose={vi.fn()}
        {...stageManagerProps}
      />,
    );

    expect(screen.getByText("收集")).toBeInTheDocument();
    expect(screen.getByLabelText("新建阶段")).toBeInTheDocument();
  });

  it("点击导航项触发 onSelectSection 切换区域", async () => {
    const onSelectSection = vi.fn();
    render(
      <SchemaSettingsPage
        schema={makeSchema()}
        section={{ kind: "stages" }}
        onSelectSection={onSelectSection}
        onClose={vi.fn()}
        {...stageManagerProps}
      />,
    );

    await userEvent.click(screen.getByText("属性"));
    expect(onSelectSection).toHaveBeenCalledWith({ kind: "attributes" });

    await userEvent.click(screen.getByText("任务"));
    expect(onSelectSection).toHaveBeenCalledWith({ kind: "tab", tabId: "tasks" });
  });

  it("点击关闭按钮触发 onClose", async () => {
    const onClose = vi.fn();
    render(
      <SchemaSettingsPage
        schema={makeSchema()}
        section={{ kind: "attributes" }}
        onSelectSection={vi.fn()}
        onClose={onClose}
        {...stageManagerProps}
      />,
    );

    await userEvent.click(screen.getByLabelText("关闭设置"));
    expect(onClose).toHaveBeenCalled();
  });

  it("section 携带 attributeId 时（右键表头跳转）进入即自动展开对应属性行", () => {
    render(
      <SchemaSettingsPage
        schema={makeSchema()}
        section={{ kind: "attributes", attributeId: "priority" }}
        onSelectSection={vi.fn()}
        onClose={vi.fn()}
        {...stageManagerProps}
      />,
    );

    expect(screen.getByDisplayValue("优先级")).toBeInTheDocument();
  });

  it("Tab 区域渲染 TabManager（新建 Tab 入口）而非占位文案", () => {
    render(
      <SchemaSettingsPage
        schema={makeSchema()}
        section={{ kind: "tab", tabId: "tasks" }}
        onSelectSection={vi.fn()}
        onClose={vi.fn()}
        {...stageManagerProps}
      />,
    );

    expect(screen.getByLabelText("新建 Tab")).toBeInTheDocument();
    // 进入时该 tabId 对应行自动展开详情，显示名输入框可见
    expect(screen.getByDisplayValue("任务")).toBeInTheDocument();
  });

  it("保存为模板按钮本 Phase 是禁用占位", () => {
    render(
      <SchemaSettingsPage
        schema={makeSchema()}
        section={{ kind: "attributes" }}
        onSelectSection={vi.fn()}
        onClose={vi.fn()}
        {...stageManagerProps}
      />,
    );

    expect(screen.getByText("保存为模板")).toBeDisabled();
  });
});
