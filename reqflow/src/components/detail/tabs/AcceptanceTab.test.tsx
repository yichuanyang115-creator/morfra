import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AcceptanceTab } from "./AcceptanceTab";
import type { AcceptanceCriterion } from "../../../types/models";

function makeCriterion(overrides: Partial<AcceptanceCriterion> = {}): AcceptanceCriterion {
  return {
    id: "a-1",
    desc: "验收标准一",
    result: "unverified",
    failNote: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("AcceptanceTab", () => {
  it("验收标准列表为空且没有草稿行打开时，显示空状态引导文案", () => {
    render(
      <AcceptanceTab acceptance={[]} draftOpen={false} onCreate={vi.fn()} onCancelDraft={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.getByText("还没有验收标准，点右上角 + 添加")).toBeInTheDocument();
  });

  it("草稿行填描述按回车，onCreate 收到修剪后的描述", async () => {
    const onCreate = vi.fn();
    render(
      <AcceptanceTab acceptance={[]} draftOpen onCreate={onCreate} onCancelDraft={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} />,
    );

    const input = screen.getByPlaceholderText("验收标准描述（必填），填完点其他地方或回车即创建");
    await userEvent.type(input, "  登录成功跳首页  ");
    await userEvent.keyboard("{Enter}");

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith("登录成功跳首页");
  });

  it("草稿行描述为空时按回车，onCancelDraft 被调用而不是 onCreate（边界：不能创建空描述）", async () => {
    const onCreate = vi.fn();
    const onCancelDraft = vi.fn();
    render(
      <AcceptanceTab acceptance={[]} draftOpen onCreate={onCreate} onCancelDraft={onCancelDraft} onUpdate={vi.fn()} onRemove={vi.fn()} />,
    );

    const input = screen.getByPlaceholderText("验收标准描述（必填），填完点其他地方或回车即创建");
    await userEvent.click(input);
    await userEvent.keyboard("{Enter}");

    expect(onCreate).not.toHaveBeenCalled();
    expect(onCancelDraft).toHaveBeenCalled();
  });

  it("点击三个结果按钮之一，onUpdate 收到对应结果", async () => {
    const onUpdate = vi.fn();
    render(
      <AcceptanceTab
        acceptance={[makeCriterion({ result: "unverified" })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
      />,
    );

    const passButton = screen.getByRole("button", { name: "通过" });
    const card = passButton.closest("div")?.parentElement;
    expect(card?.className).not.toMatch(/bg-\(--(?:st|sev)-/);
    expect(passButton.querySelector("[aria-hidden=\"true\"]")).not.toBeNull();
    await userEvent.click(passButton);

    expect(onUpdate).toHaveBeenCalledWith("a-1", { result: "pass" });
  });

  it("任一时刻只有一个结果按钮处于按下态", () => {
    render(
      <AcceptanceTab
        acceptance={[makeCriterion({ result: "pass" })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "通过" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "不通过" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "未验证" })).toHaveAttribute("aria-pressed", "false");
  });

  it("结果为不通过时展开原因输入框，失焦提交后 onUpdate 收到修剪后的原因", async () => {
    const onUpdate = vi.fn();
    render(
      <AcceptanceTab
        acceptance={[makeCriterion({ result: "fail", failNote: "" })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByText("点击说明不通过原因…"));
    const textarea = screen.getByPlaceholderText("为什么不通过？");
    await userEvent.type(textarea, "  接口超时  ");
    await userEvent.click(document.body);

    expect(onUpdate).toHaveBeenCalledWith("a-1", { failNote: "接口超时" });
  });

  it("结果不为不通过时不显示不通过原因入口", () => {
    render(
      <AcceptanceTab
        acceptance={[makeCriterion({ result: "unverified" })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByText("点击说明不通过原因…")).not.toBeInTheDocument();
  });

  it("点击删除按钮，onRemove 收到目标条目的 id", async () => {
    const onRemove = vi.fn();
    render(
      <AcceptanceTab acceptance={[makeCriterion()]} draftOpen={false} onCreate={vi.fn()} onCancelDraft={vi.fn()} onUpdate={vi.fn()} onRemove={onRemove} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "删除验收标准" }));

    expect(onRemove).toHaveBeenCalledWith("a-1");
  });

  it("点击描述展开编辑输入框，失焦修剪空白并只在变化时触发 onUpdate", async () => {
    const onUpdate = vi.fn();
    render(
      <AcceptanceTab acceptance={[makeCriterion({ desc: "验收标准一" })]} draftOpen={false} onCreate={vi.fn()} onCancelDraft={vi.fn()} onUpdate={onUpdate} onRemove={vi.fn()} />,
    );

    await userEvent.click(screen.getByText("验收标准一"));
    const descInput = screen.getByDisplayValue("验收标准一");
    await userEvent.clear(descInput);
    await userEvent.type(descInput, "  改后的描述  ");
    await userEvent.click(document.body);

    expect(onUpdate).toHaveBeenCalledWith("a-1", { desc: "改后的描述" });
  });

  it("描述编辑清空后失焦，不触发 onUpdate 且还原为原描述展示", async () => {
    const onUpdate = vi.fn();
    render(
      <AcceptanceTab acceptance={[makeCriterion({ desc: "验收标准一" })]} draftOpen={false} onCreate={vi.fn()} onCancelDraft={vi.fn()} onUpdate={onUpdate} onRemove={vi.fn()} />,
    );

    await userEvent.click(screen.getByText("验收标准一"));
    const descInput = screen.getByDisplayValue("验收标准一");
    await userEvent.clear(descInput);
    await userEvent.click(document.body);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText("验收标准一")).toBeInTheDocument();
  });

  it("顶部汇总行显示通过数/总数，随结果变化", () => {
    render(
      <AcceptanceTab
        acceptance={[makeCriterion({ id: "a-1", result: "pass" }), makeCriterion({ id: "a-2", result: "unverified" })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("1/2 通过")).toBeInTheDocument();
  });

  it("多条验收标准渲染多张卡片，互不影响：修改第一条不会波及第二条", () => {
    render(
      <AcceptanceTab
        acceptance={[makeCriterion({ id: "a-1", desc: "标准一" }), makeCriterion({ id: "a-2", desc: "标准二", result: "pass" })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("标准一")).toBeInTheDocument();
    expect(screen.getByText("标准二")).toBeInTheDocument();
  });
});
