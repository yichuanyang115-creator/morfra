import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StageOption } from "../../types/schema";
import { StageManager } from "./StageManager";

const STAGE_OPTIONS: StageOption[] = [
  { id: "collect", label: "收集", color: "hsl(0,55%,88%)", isTerminal: false },
  { id: "archive", label: "归档", color: "hsl(45,55%,88%)", isTerminal: true },
];

const baseProps = {
  stageOptions: STAGE_OPTIONS,
  entityCountByStage: {},
  availableAttributes: [],
  onReorder: vi.fn(),
  onAdd: vi.fn(),
  onUpdate: vi.fn(),
  onRemove: vi.fn(),
};

describe("StageManager", () => {
  it("渲染全部阶段选项，含名称、数量和终态标记", () => {
    render(<StageManager {...baseProps} entityCountByStage={{ collect: 3 }} />);

    expect(screen.getByText("收集")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("归档")).toBeInTheDocument();
    expect(screen.getByText("终态")).toBeInTheDocument();
  });

  it("阶段下有实体时删除按钮禁用", () => {
    render(<StageManager {...baseProps} entityCountByStage={{ collect: 2 }} />);

    expect(screen.getByLabelText("删除阶段「收集」")).toBeDisabled();
  });

  it("只剩一个阶段选项时删除按钮禁用（最少保留 1 个）", () => {
    render(<StageManager {...baseProps} stageOptions={[STAGE_OPTIONS[0]]} entityCountByStage={{}} />);

    const button = screen.getByLabelText("删除阶段「收集」");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "至少保留一个阶段");
  });

  it("阶段下无实体时点击删除按钮弹出二次确认，确认后触发 onRemove", async () => {
    const onRemove = vi.fn();
    render(<StageManager {...baseProps} entityCountByStage={{}} onRemove={onRemove} />);

    await userEvent.click(screen.getByLabelText("删除阶段「归档」"));
    expect(screen.getByText('删除阶段「归档」？')).toBeInTheDocument();

    await userEvent.click(screen.getByText("删除"));
    expect(onRemove).toHaveBeenCalledWith("archive");
  });

  it("二次确认弹窗点取消不触发 onRemove", async () => {
    const onRemove = vi.fn();
    render(<StageManager {...baseProps} entityCountByStage={{}} onRemove={onRemove} />);

    await userEvent.click(screen.getByLabelText("删除阶段「归档」"));
    await userEvent.click(screen.getByText("取消"));

    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.queryByText('删除阶段「归档」？')).not.toBeInTheDocument();
  });

  it("点击阶段行展开/收起 StageEditor 编辑面板", async () => {
    render(<StageManager {...baseProps} />);

    expect(screen.queryByText("显示名")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("收集"));
    expect(screen.getByText("显示名")).toBeInTheDocument();

    await userEvent.click(screen.getByText("收集"));
    expect(screen.queryByText("显示名")).not.toBeInTheDocument();
  });

  it("输入新阶段名称并提交后触发 onAdd，输入框清空", async () => {
    const onAdd = vi.fn();
    render(<StageManager {...baseProps} onAdd={onAdd} />);

    await userEvent.type(screen.getByPlaceholderText("新阶段名称"), "验收{Enter}");

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({ label: "验收", isTerminal: false });
    expect(screen.getByPlaceholderText("新阶段名称")).toHaveValue("");
  });

  it("新阶段名称为空时不触发 onAdd", async () => {
    const onAdd = vi.fn();
    render(<StageManager {...baseProps} onAdd={onAdd} />);

    await userEvent.click(screen.getByLabelText("新建阶段"));
    expect(onAdd).not.toHaveBeenCalled();
  });
});
