import { describe, expect, it, vi, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Attribute, AttributeType } from "../../types/schema";
import { AttributeEditor } from "./AttributeEditor";

const TEXT_ATTRIBUTE: Attribute = { id: "assignee", name: "负责人", type: "text", showOnBoard: true, showOnDetail: true };

const SELECT_ATTRIBUTE: Attribute = {
  id: "priority",
  name: "优先级",
  type: "singleSelect",
  options: [{ id: "p0", label: "P0", color: "hsl(0,55%,88%)" }],
  showOnBoard: true,
  showOnDetail: true,
};

const COMPUTED_ATTRIBUTE: Attribute = {
  id: "stay_days",
  name: "停留天数",
  type: "computed",
  computedKind: "stayDays",
  showOnBoard: true,
  showOnDetail: false,
};

const SOURCE_ATTRIBUTE: Attribute = {
  id: "source",
  name: "来源",
  type: "singleSelect",
  options: [
    { id: "feedback", label: "用户反馈" },
    { id: "internal", label: "内部想法" },
  ],
  showOnBoard: true,
  showOnDetail: true,
};

function renderEditor(
  attribute: Attribute,
  overrides: {
    availableAttributes?: Attribute[];
    typeChangeLocked?: boolean;
    onUpdate?: Mock<(patch: Partial<Attribute>) => void>;
    onRename?: Mock<(name: string) => { ok: boolean; message?: string }>;
    onRequestTypeChange?: Mock<(toType: AttributeType) => void>;
  } = {},
) {
  const onUpdate = overrides.onUpdate ?? vi.fn();
  const onRename = overrides.onRename ?? vi.fn(() => ({ ok: true }));
  const onRequestTypeChange = overrides.onRequestTypeChange ?? vi.fn();
  render(
    <AttributeEditor
      attribute={attribute}
      availableAttributes={overrides.availableAttributes ?? []}
      typeChangeLocked={overrides.typeChangeLocked ?? false}
      onUpdate={onUpdate}
      onRename={onRename}
      onRequestTypeChange={onRequestTypeChange}
    />,
  );
  return { onUpdate, onRename, onRequestTypeChange };
}

describe("AttributeEditor", () => {
  it("修改显示名后失焦触发 onRename", async () => {
    const { onRename } = renderEditor(TEXT_ATTRIBUTE);

    const input = screen.getByDisplayValue("负责人");
    await userEvent.clear(input);
    await userEvent.type(input, "经办人{Tab}");

    expect(onRename).toHaveBeenCalledWith("经办人");
  });

  it("onRename 返回同名冲突错误时展示错误文案且不回填新值", async () => {
    const onRename = vi.fn(() => ({ ok: false, message: "同名属性已存在" }));
    renderEditor(TEXT_ATTRIBUTE, { onRename });

    const input = screen.getByDisplayValue("负责人");
    await userEvent.clear(input);
    await userEvent.type(input, "优先级{Tab}");

    expect(await screen.findByText("同名属性已存在")).toBeInTheDocument();
    expect(screen.getByDisplayValue("负责人")).toBeInTheDocument();
  });

  it("显示名清空后失焦不触发 onRename（回退原值）", async () => {
    const { onRename } = renderEditor(TEXT_ATTRIBUTE);

    const input = screen.getByDisplayValue("负责人");
    await userEvent.clear(input);
    await userEvent.tab();

    expect(onRename).not.toHaveBeenCalled();
  });

  it("骨架/计算属性锁定类型时不渲染类型选择器", () => {
    renderEditor(COMPUTED_ATTRIBUTE, { typeChangeLocked: true });

    expect(screen.getByText("计算属性（系统属性，不可改类型）")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "" })).not.toBeInTheDocument();
  });

  it("选择新类型时触发 onRequestTypeChange 而非直接 onUpdate", async () => {
    const { onRequestTypeChange, onUpdate } = renderEditor(TEXT_ATTRIBUTE);

    const typeSelect = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(typeSelect, "number");

    expect(onRequestTypeChange).toHaveBeenCalledWith("number");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("单选/多选类型渲染选项列表", () => {
    renderEditor(SELECT_ATTRIBUTE);
    expect(screen.getByText("选项")).toBeInTheDocument();
    expect(screen.getByDisplayValue("P0")).toBeInTheDocument();
  });

  it("文本类型不渲染选项区域", () => {
    renderEditor(TEXT_ATTRIBUTE);
    expect(screen.queryByText("选项")).not.toBeInTheDocument();
  });

  it("点击添加选项触发 onUpdate 追加新选项", async () => {
    const { onUpdate } = renderEditor(SELECT_ATTRIBUTE);

    await userEvent.click(screen.getByText("+ 添加选项"));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const patch = onUpdate.mock.calls[0][0];
    expect(patch.options).toHaveLength(2);
    expect(patch.options?.[1].label).toBe("新选项");
  });

  it("修改选项名称后失焦触发 onUpdate", async () => {
    const { onUpdate } = renderEditor(SOURCE_ATTRIBUTE);

    const input = screen.getByDisplayValue("用户反馈");
    await userEvent.clear(input);
    await userEvent.type(input, "客户反馈{Tab}");

    expect(onUpdate).toHaveBeenCalledWith({
      options: [
        { id: "feedback", label: "客户反馈" },
        { id: "internal", label: "内部想法" },
      ],
    });
  });

  it("点击删除选项按钮移除该条", async () => {
    const { onUpdate } = renderEditor(SOURCE_ATTRIBUTE);

    await userEvent.click(screen.getByLabelText("删除选项「用户反馈」"));

    expect(onUpdate).toHaveBeenCalledWith({ options: [{ id: "internal", label: "内部想法" }] });
  });

  it("选择依赖属性后 onUpdate 写入 dependsOn", async () => {
    const other: Attribute = { id: "assignee", name: "负责人", type: "text", showOnBoard: true, showOnDetail: true };
    const { onUpdate } = renderEditor(TEXT_ATTRIBUTE, { availableAttributes: [other] });

    await userEvent.selectOptions(screen.getByLabelText("依赖属性"), "assignee");

    expect(onUpdate).toHaveBeenCalledWith({ dependsOn: { attributeId: "assignee", value: "" } });
  });

  it("依赖属性清空为不设置时 onUpdate 写入 undefined", async () => {
    const withDependency: Attribute = { ...TEXT_ATTRIBUTE, dependsOn: { attributeId: "assignee", value: "x" } };
    const other: Attribute = { id: "assignee", name: "负责人", type: "text", showOnBoard: true, showOnDetail: true };
    const { onUpdate } = renderEditor(withDependency, { availableAttributes: [other] });

    await userEvent.selectOptions(screen.getByLabelText("依赖属性"), "");

    expect(onUpdate).toHaveBeenCalledWith({ dependsOn: undefined });
  });

  it("依赖属性为单选类型时依赖取值渲染下拉，选择后 onUpdate 更新 value", async () => {
    const dependent: Attribute = { ...TEXT_ATTRIBUTE, dependsOn: { attributeId: "priority", value: "" } };
    const { onUpdate } = renderEditor(dependent, { availableAttributes: [SELECT_ATTRIBUTE] });

    await userEvent.selectOptions(screen.getByLabelText("依赖取值"), "p0");

    expect(onUpdate).toHaveBeenCalledWith({ dependsOn: { attributeId: "priority", value: "p0" } });
  });

  it("点击看板/详情页显示开关触发 onUpdate", async () => {
    const { onUpdate } = renderEditor(TEXT_ATTRIBUTE);

    await userEvent.click(screen.getByLabelText("看板显示"));
    expect(onUpdate).toHaveBeenCalledWith({ showOnBoard: false });

    await userEvent.click(screen.getByLabelText("详情页显示"));
    expect(onUpdate).toHaveBeenCalledWith({ showOnDetail: false });
  });
});
