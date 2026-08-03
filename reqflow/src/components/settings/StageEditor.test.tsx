import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Attribute, StageOption } from "../../types/schema";
import { StageEditor } from "./StageEditor";

const STAGE: StageOption = { id: "release", label: "发布", color: "hsl(0,55%,88%)", isTerminal: false };

const ATTRIBUTES: Attribute[] = [
  { id: "release_method", name: "发布方式", type: "singleSelect", showOnBoard: true, showOnDetail: true },
  { id: "release_date", name: "发布时间", type: "date", showOnBoard: true, showOnDetail: false },
];

describe("StageEditor", () => {
  it("修改显示名后失焦触发 onUpdate", async () => {
    const onUpdate = vi.fn();
    render(<StageEditor stageOption={STAGE} availableAttributes={ATTRIBUTES} onUpdate={onUpdate} />);

    const input = screen.getByDisplayValue("发布");
    await userEvent.clear(input);
    await userEvent.type(input, "发布中{Tab}");

    expect(onUpdate).toHaveBeenCalledWith({ label: "发布中" });
  });

  it("显示名清空后失焦不触发 onUpdate（回退原值）", async () => {
    const onUpdate = vi.fn();
    render(<StageEditor stageOption={STAGE} availableAttributes={ATTRIBUTES} onUpdate={onUpdate} />);

    const input = screen.getByDisplayValue("发布");
    await userEvent.clear(input);
    await userEvent.tab();

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("点击终态开关触发 onUpdate 切换 isTerminal", async () => {
    const onUpdate = vi.fn();
    render(<StageEditor stageOption={STAGE} availableAttributes={ATTRIBUTES} onUpdate={onUpdate} />);

    await userEvent.click(screen.getByRole("switch", { name: "标记为终态阶段" }));
    expect(onUpdate).toHaveBeenCalledWith({ isTerminal: true });
  });

  it("点击颜色色板触发 onUpdate 更新颜色", async () => {
    const onUpdate = vi.fn();
    render(<StageEditor stageOption={STAGE} availableAttributes={ATTRIBUTES} onUpdate={onUpdate} />);

    await userEvent.click(screen.getByLabelText("颜色 hsl(180, 55%, 88%)"));
    expect(onUpdate).toHaveBeenCalledWith({ color: "hsl(180, 55%, 88%)" });
  });

  it("无覆盖规则时显示提示文案", () => {
    render(<StageEditor stageOption={STAGE} availableAttributes={ATTRIBUTES} onUpdate={vi.fn()} />);
    expect(screen.getByText("暂无覆盖规则")).toBeInTheDocument();
  });

  it("点击添加覆盖后出现一行空的 from→to 选择器", async () => {
    const onUpdate = vi.fn();
    render(<StageEditor stageOption={STAGE} availableAttributes={ATTRIBUTES} onUpdate={onUpdate} />);

    await userEvent.click(screen.getByText("+ 添加覆盖"));
    expect(onUpdate).toHaveBeenCalledWith({ attributeOverrides: [{ fromAttributeId: "", toAttributeId: "" }] });
  });

  it("已有覆盖规则时渲染 from/to 下拉，选择后触发 onUpdate 更新该条规则", async () => {
    const onUpdate = vi.fn();
    const withOverride: StageOption = {
      ...STAGE,
      attributeOverrides: [{ fromAttributeId: "release_method", toAttributeId: "" }],
    };
    render(<StageEditor stageOption={withOverride} availableAttributes={ATTRIBUTES} onUpdate={onUpdate} />);

    await userEvent.selectOptions(screen.getByLabelText("替换为的属性"), "release_date");

    expect(onUpdate).toHaveBeenCalledWith({
      attributeOverrides: [{ fromAttributeId: "release_method", toAttributeId: "release_date" }],
    });
  });

  it("点击删除覆盖规则按钮移除该条", async () => {
    const onUpdate = vi.fn();
    const withOverride: StageOption = {
      ...STAGE,
      attributeOverrides: [{ fromAttributeId: "release_method", toAttributeId: "release_date" }],
    };
    render(<StageEditor stageOption={withOverride} availableAttributes={ATTRIBUTES} onUpdate={onUpdate} />);

    await userEvent.click(screen.getByLabelText("删除该覆盖规则"));

    expect(onUpdate).toHaveBeenCalledWith({ attributeOverrides: [] });
  });
});
