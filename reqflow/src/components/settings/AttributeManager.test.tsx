import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Attribute } from "../../types/schema";
import { AttributeManager } from "./AttributeManager";

const ATTRIBUTES: Attribute[] = [
  { id: "priority", name: "优先级", type: "singleSelect", options: [{ id: "p0", label: "P0" }], showOnBoard: true, showOnDetail: true },
  { id: "assignee", name: "负责人", type: "text", showOnBoard: false, showOnDetail: true },
  { id: "stay_days", name: "停留天数", type: "computed", computedKind: "stayDays", showOnBoard: true, showOnDetail: false },
];

const baseProps = {
  attributes: ATTRIBUTES,
  onReorder: vi.fn(),
  onAdd: vi.fn(),
  onUpdate: vi.fn(),
  onRemove: vi.fn(),
  countValued: vi.fn(() => 0),
  getTypeChangeImpact: vi.fn(() => ({ totalCount: 0, lostCount: 0 })),
  onConfirmTypeChange: vi.fn(),
};

describe("AttributeManager", () => {
  it("渲染全部属性，含名称和类型标签", () => {
    render(<AttributeManager {...baseProps} />);

    expect(screen.getByText("优先级")).toBeInTheDocument();
    expect(screen.getAllByText("单选").length).toBeGreaterThan(0);
    expect(screen.getByText("负责人")).toBeInTheDocument();
    expect(screen.getAllByText("文本").length).toBeGreaterThan(0);
  });

  it("看板/详情页显示开关反映当前状态且点击触发 onUpdate", async () => {
    const onUpdate = vi.fn();
    render(<AttributeManager {...baseProps} onUpdate={onUpdate} />);

    await userEvent.click(screen.getByLabelText("隐藏「优先级」看板列"));
    expect(onUpdate).toHaveBeenCalledWith("priority", { showOnBoard: false });

    await userEvent.click(screen.getByLabelText("显示「负责人」看板列"));
    expect(onUpdate).toHaveBeenCalledWith("assignee", { showOnBoard: true });
  });

  it("点击属性行展开/收起 AttributeEditor 编辑面板", async () => {
    render(<AttributeManager {...baseProps} />);

    expect(screen.queryByText("显示名")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("负责人"));
    expect(screen.getByText("显示名")).toBeInTheDocument();

    await userEvent.click(screen.getByText("负责人"));
    expect(screen.queryByText("显示名")).not.toBeInTheDocument();
  });

  it("展开计算属性时类型锁定，不可改类型", async () => {
    render(<AttributeManager {...baseProps} />);

    await userEvent.click(screen.getByText("停留天数"));
    expect(screen.getByText("计算属性（系统属性，不可改类型）")).toBeInTheDocument();
  });

  it("点击删除按钮弹二次确认，有填值时提示影响条数，确认后触发 onRemove", async () => {
    const onRemove = vi.fn();
    const countValued = vi.fn(() => 12);
    render(<AttributeManager {...baseProps} onRemove={onRemove} countValued={countValued} />);

    await userEvent.click(screen.getByLabelText("删除属性「优先级」"));
    expect(screen.getByText("当前有 12 条记录填了该属性的值，删除后这些值一并清除，此操作不可撤销。")).toBeInTheDocument();

    await userEvent.click(screen.getByText("删除"));
    expect(onRemove).toHaveBeenCalledWith("priority");
  });

  it("二次确认取消不触发 onRemove", async () => {
    const onRemove = vi.fn();
    render(<AttributeManager {...baseProps} onRemove={onRemove} />);

    await userEvent.click(screen.getByLabelText("删除属性「优先级」"));
    await userEvent.click(screen.getByText("取消"));

    expect(onRemove).not.toHaveBeenCalled();
  });

  it("输入新属性名称并提交后触发 onAdd，输入框清空", async () => {
    const onAdd = vi.fn();
    render(<AttributeManager {...baseProps} onAdd={onAdd} />);

    await userEvent.type(screen.getByPlaceholderText("新属性名称"), "备注{Enter}");

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({ name: "备注", type: "text", showOnBoard: true, showOnDetail: true });
    expect(screen.getByPlaceholderText("新属性名称")).toHaveValue("");
  });

  it("新属性名称为空时不触发 onAdd", async () => {
    const onAdd = vi.fn();
    render(<AttributeManager {...baseProps} onAdd={onAdd} />);

    await userEvent.click(screen.getByLabelText("新建属性"));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("新属性名称与现有属性同名时展示错误提示，不触发 onAdd", async () => {
    const onAdd = vi.fn();
    render(<AttributeManager {...baseProps} onAdd={onAdd} />);

    await userEvent.type(screen.getByPlaceholderText("新属性名称"), "优先级{Enter}");

    expect(screen.getByText("同名属性已存在")).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("改名同名冲突时 onRename 返回失败", async () => {
    render(<AttributeManager {...baseProps} />);

    await userEvent.click(screen.getByText("负责人"));
    const input = screen.getByDisplayValue("负责人");
    await userEvent.clear(input);
    await userEvent.type(input, "优先级{Tab}");

    expect(await screen.findByText("同名属性已存在")).toBeInTheDocument();
    expect(baseProps.onUpdate).not.toHaveBeenCalledWith("assignee", { name: "优先级" });
  });

  it("改类型无损时直接触发 onConfirmTypeChange，不弹确认", async () => {
    const onConfirmTypeChange = vi.fn();
    const getTypeChangeImpact = vi.fn(() => ({ totalCount: 5, lostCount: 0 }));
    render(<AttributeManager {...baseProps} onConfirmTypeChange={onConfirmTypeChange} getTypeChangeImpact={getTypeChangeImpact} />);

    await userEvent.click(screen.getByText("负责人"));
    const typeSelect = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(typeSelect, "number");

    expect(onConfirmTypeChange).toHaveBeenCalledWith("assignee", "number");
    expect(screen.queryByText("改变属性类型？")).not.toBeInTheDocument();
  });

  it("改类型有损时弹确认告知影响条数，确认后才触发 onConfirmTypeChange", async () => {
    const onConfirmTypeChange = vi.fn();
    const getTypeChangeImpact = vi.fn(() => ({ totalCount: 8, lostCount: 3 }));
    render(<AttributeManager {...baseProps} onConfirmTypeChange={onConfirmTypeChange} getTypeChangeImpact={getTypeChangeImpact} />);

    await userEvent.click(screen.getByText("负责人"));
    const typeSelect = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(typeSelect, "singleSelect");

    expect(onConfirmTypeChange).not.toHaveBeenCalled();
    expect(screen.getByText("8 条记录中有 3 条无法转换将被清空，此操作不可撤销。")).toBeInTheDocument();

    await userEvent.click(screen.getByText("改变类型"));
    expect(onConfirmTypeChange).toHaveBeenCalledWith("assignee", "singleSelect");
  });

  it("改类型有损确认弹窗点取消不触发 onConfirmTypeChange", async () => {
    const onConfirmTypeChange = vi.fn();
    const getTypeChangeImpact = vi.fn(() => ({ totalCount: 8, lostCount: 3 }));
    render(<AttributeManager {...baseProps} onConfirmTypeChange={onConfirmTypeChange} getTypeChangeImpact={getTypeChangeImpact} />);

    await userEvent.click(screen.getByText("负责人"));
    const typeSelect = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(typeSelect, "singleSelect");
    await userEvent.click(screen.getByText("取消"));

    expect(onConfirmTypeChange).not.toHaveBeenCalled();
  });
});
