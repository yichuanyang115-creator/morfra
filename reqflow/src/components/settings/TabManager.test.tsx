import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TabDefinition } from "../../types/schema";
import { TabManager } from "./TabManager";

const TABS: TabDefinition[] = [
  { id: "body", name: "正文", renderer: "body", visible: true },
  { id: "tasks", name: "任务", renderer: "tasks", visible: true },
  { id: "custom-1", name: "自定义 Tab", renderer: "generic", visible: false },
];

const baseProps = {
  tabs: TABS,
  selectedTabId: "tasks",
  onReorder: vi.fn(),
  onAdd: vi.fn(),
  onUpdate: vi.fn(),
  onRemove: vi.fn(),
};

describe("TabManager", () => {
  it("渲染全部 Tab，含名称和预制标记", () => {
    render(<TabManager {...baseProps} />);

    expect(screen.getByText("正文")).toBeInTheDocument();
    expect(screen.getByText("任务")).toBeInTheDocument();
    expect(screen.getByText("自定义 Tab")).toBeInTheDocument();
    expect(screen.getAllByText("预制")).toHaveLength(2);
  });

  it("selectedTabId 对应的行进入时自动展开详情", () => {
    render(<TabManager {...baseProps} />);

    expect(screen.getByDisplayValue("任务")).toBeInTheDocument();
  });

  it("body/activity 渲染器的 Tab 删除按钮禁用", () => {
    render(<TabManager {...baseProps} />);

    expect(screen.getByLabelText("正文/活动为固定特例，仅可设置显隐")).toBeDisabled();
  });

  it("非固定特例的 Tab 删除按钮可用，点击后弹二次确认，确认后触发 onRemove", async () => {
    const onRemove = vi.fn();
    render(<TabManager {...baseProps} onRemove={onRemove} />);

    await userEvent.click(screen.getByLabelText("删除 Tab「自定义 Tab」"));
    expect(screen.getByText('删除 Tab「自定义 Tab」？')).toBeInTheDocument();
    expect(screen.getByText("该 Tab 下全部记录将被永久清除，此操作不可撤销。")).toBeInTheDocument();

    await userEvent.click(screen.getByText("删除"));
    expect(onRemove).toHaveBeenCalledWith("custom-1");
  });

  it("二次确认弹窗点取消不触发 onRemove", async () => {
    const onRemove = vi.fn();
    render(<TabManager {...baseProps} onRemove={onRemove} />);

    await userEvent.click(screen.getByLabelText("删除 Tab「自定义 Tab」"));
    await userEvent.click(screen.getByText("取消"));

    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.queryByText('删除 Tab「自定义 Tab」？')).not.toBeInTheDocument();
  });

  it("点击显隐图标触发 onUpdate 切换 visible", async () => {
    const onUpdate = vi.fn();
    render(<TabManager {...baseProps} onUpdate={onUpdate} />);

    await userEvent.click(screen.getByLabelText("隐藏 Tab「正文」"));
    expect(onUpdate).toHaveBeenCalledWith("body", { visible: false });

    await userEvent.click(screen.getByLabelText("显示 Tab「自定义 Tab」"));
    expect(onUpdate).toHaveBeenCalledWith("custom-1", { visible: true });
  });

  it("输入新 Tab 名称并提交后触发 onAdd（渲染器固定为 generic），输入框清空", async () => {
    const onAdd = vi.fn();
    render(<TabManager {...baseProps} onAdd={onAdd} />);

    await userEvent.type(screen.getByPlaceholderText("新 Tab 名称"), "评审{Enter}");

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({ name: "评审", renderer: "generic", visible: true });
    expect(screen.getByPlaceholderText("新 Tab 名称")).toHaveValue("");
  });

  it("新 Tab 名称为空时不触发 onAdd", async () => {
    const onAdd = vi.fn();
    render(<TabManager {...baseProps} onAdd={onAdd} />);

    await userEvent.click(screen.getByLabelText("新建 Tab"));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("点击展开的 Tab 行显示当前字段结构", () => {
    render(<TabManager {...baseProps} />);

    expect(screen.getByText("暂无字段，通用 Tab 将使用默认名称字段。")).toBeInTheDocument();
  });

  it("修改显示名后失焦触发 onUpdate", async () => {
    const onUpdate = vi.fn();
    render(<TabManager {...baseProps} onUpdate={onUpdate} />);

    const input = screen.getByDisplayValue("任务");
    await userEvent.clear(input);
    await userEvent.type(input, "任务清单{Tab}");

    expect(onUpdate).toHaveBeenCalledWith("tasks", { name: "任务清单" });
  });
});
