import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeliverablesTab } from "./DeliverablesTab";
import type { Deliverable } from "../../../types/models";

const { openMock, openPathMock, openUrlMock } = vi.hoisted(() => ({
  openMock: vi.fn(),
  openPathMock: vi.fn(),
  openUrlMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: openMock }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openPath: openPathMock, openUrl: openUrlMock }));

function makeDeliverable(overrides: Partial<Deliverable> = {}): Deliverable {
  return {
    id: "d-1",
    name: "产出一",
    checked: false,
    attach: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("DeliverablesTab", () => {
  it("产出列表为空且没有草稿行打开时，显示空状态引导文案", () => {
    render(
      <DeliverablesTab
        deliverables={[]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("还没有产出，点右上角 + 新建")).toBeInTheDocument();
  });

  it("草稿行填写名称并按回车，onCreate 收到修剪后的名称；名称为空按回车不触发 onCreate", async () => {
    const onCreate = vi.fn();
    render(
      <DeliverablesTab
        deliverables={[]}
        draftOpen
        onCreate={onCreate}
        onCancelDraft={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("产出名称（必填），填完点其他地方或回车即创建");
    await userEvent.type(input, "  首页原型图  ");
    await userEvent.keyboard("{Enter}");

    expect(onCreate).toHaveBeenCalledWith("首页原型图");
  });

  it("草稿行名称为空时按回车，onCancelDraft 被调用而不是 onCreate（边界：不能创建空名称产出）", async () => {
    const onCreate = vi.fn();
    const onCancelDraft = vi.fn();
    render(
      <DeliverablesTab
        deliverables={[]}
        draftOpen
        onCreate={onCreate}
        onCancelDraft={onCancelDraft}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("产出名称（必填），填完点其他地方或回车即创建");
    await userEvent.click(input);
    await userEvent.keyboard("{Enter}");

    expect(onCreate).not.toHaveBeenCalled();
    expect(onCancelDraft).toHaveBeenCalled();
  });

  it("点击勾选框，onUpdate 收到 checked 取反后的值（未完成→完成）", async () => {
    const onUpdate = vi.fn();
    render(
      <DeliverablesTab
        deliverables={[makeDeliverable({ checked: false })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "标记为完成" }));

    expect(onUpdate).toHaveBeenCalledWith("d-1", { checked: true });
  });

  it("点击删除按钮，onRemove 收到目标产出的 id", async () => {
    const onRemove = vi.fn();
    render(
      <DeliverablesTab
        deliverables={[makeDeliverable()]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={onRemove}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "删除这条产出" }));

    expect(onRemove).toHaveBeenCalledWith("d-1");
  });

  it("未挂附件时点击\"附加文件或链接\"展开链接输入框，输入链接回车后 onUpdate 收到 link 类型附件", async () => {
    const onUpdate = vi.fn();
    render(
      <DeliverablesTab
        deliverables={[makeDeliverable({ attach: null })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByText("附加文件或链接"));
    const linkInput = screen.getByPlaceholderText("粘贴链接，回车添加");
    await userEvent.type(linkInput, "https://example.com/spec");
    await userEvent.keyboard("{Enter}");

    expect(onUpdate).toHaveBeenCalledWith("d-1", {
      attach: { type: "link", url: "https://example.com/spec", label: "https://example.com/spec" },
    });
  });

  it("已挂文件附件时展示附件条和名称，点击\"移除附件\"只清 attach，不触发 onRemove（保留产出条目本身）", async () => {
    const onUpdate = vi.fn();
    const onRemove = vi.fn();
    render(
      <DeliverablesTab
        deliverables={[
          makeDeliverable({ attach: { type: "file", url: "/tmp/design.fig", label: "design.fig" } }),
        ]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={onUpdate}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText("design.fig")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "移除附件（保留这条产出）" }));

    expect(onUpdate).toHaveBeenCalledWith("d-1", { attach: null });
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("点击已挂的文件附件条，调用系统默认应用打开（openPath），不是浏览器打开", async () => {
    render(
      <DeliverablesTab
        deliverables={[
          makeDeliverable({ attach: { type: "file", url: "/tmp/design.fig", label: "design.fig" } }),
        ]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByText("design.fig"));

    expect(openPathMock).toHaveBeenCalledWith("/tmp/design.fig");
    expect(openUrlMock).not.toHaveBeenCalled();
  });

  it("多条产出渲染多张卡片，互不影响：修改第一条不会波及第二条的名称展示", () => {
    render(
      <DeliverablesTab
        deliverables={[
          makeDeliverable({ id: "d-1", name: "产出一" }),
          makeDeliverable({ id: "d-2", name: "产出二", checked: true }),
        ]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("产出一")).toBeInTheDocument();
    expect(screen.getByDisplayValue("产出二")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "标记为未完成" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "标记为完成" })).toBeInTheDocument();
  });
});
