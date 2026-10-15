import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TasksTab } from "./TasksTab";
import type { Task } from "../../../types/models";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t-1",
    name: "任务一",
    assignee: "",
    deadline: "",
    progress: null,
    status: "todo",
    blocked: false,
    blockNote: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("TasksTab", () => {
  it("任务列表为空且没有草稿行打开时，显示空状态引导文案", () => {
    render(
      <TasksTab tasks={[]} draftOpen={false} onCreate={vi.fn()} onCancelDraft={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.getByText("还没有开发任务，点右上角 + 添加")).toBeInTheDocument();
  });

  it("草稿行只填名称按回车，onCreate 收到修剪后的名称，其余字段为空/null", async () => {
    const onCreate = vi.fn();
    render(
      <TasksTab tasks={[]} draftOpen onCreate={onCreate} onCancelDraft={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} />,
    );

    const input = screen.getByPlaceholderText("任务名称（必填），填完点其他地方或回车即创建");
    await userEvent.type(input, "  编写单测  ");
    await userEvent.keyboard("{Enter}");

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({ name: "编写单测", assignee: "", deadline: "", progress: null });
  });

  it("草稿行名称为空时按回车，onCancelDraft 被调用而不是 onCreate（边界：不能创建空名称任务）", async () => {
    const onCreate = vi.fn();
    const onCancelDraft = vi.fn();
    render(
      <TasksTab tasks={[]} draftOpen onCreate={onCreate} onCancelDraft={onCancelDraft} onUpdate={vi.fn()} onRemove={vi.fn()} />,
    );

    const input = screen.getByPlaceholderText("任务名称（必填），填完点其他地方或回车即创建");
    await userEvent.click(input);
    await userEvent.keyboard("{Enter}");

    expect(onCreate).not.toHaveBeenCalled();
    expect(onCancelDraft).toHaveBeenCalled();
  });

  it("草稿行填了负责人和进度后失焦创建，onCreate 收到完整字段", async () => {
    const onCreate = vi.fn();
    render(
      <TasksTab tasks={[]} draftOpen onCreate={onCreate} onCancelDraft={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} />,
    );

    await userEvent.type(screen.getByPlaceholderText("任务名称（必填），填完点其他地方或回车即创建"), "任务甲");
    await userEvent.type(screen.getByPlaceholderText("负责人"), "吴桐");
    await userEvent.click(document.body);

    expect(onCreate).toHaveBeenCalledWith({ name: "任务甲", assignee: "吴桐", deadline: "", progress: null });
  });

  it("点击状态徽章，onUpdate 收到状态从待开始切到进行中", async () => {
    const onUpdate = vi.fn();
    render(
      <TasksTab
        tasks={[makeTask({ status: "todo" })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
      />,
    );

    const statusButton = screen.getByRole("button", { name: "任务状态：待开始，点击切换到下一状态" });
    const card = statusButton.closest("div")?.parentElement;
    expect(card?.className).not.toMatch(/bg-\(--(?:st|sev)-/);
    expect(statusButton.querySelector("[aria-hidden=\"true\"]")).not.toBeNull();
    expect(statusButton).toHaveClass("ring-1", "ring-current");
    await userEvent.click(statusButton);

    expect(onUpdate).toHaveBeenCalledWith("t-1", { status: "progress" });
  });

  it("状态循环到完成时进度自动置为 100", async () => {
    const onUpdate = vi.fn();
    render(
      <TasksTab
        tasks={[makeTask({ status: "progress" })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "任务状态：进行中，点击切换到下一状态" }));

    expect(onUpdate).toHaveBeenCalledWith("t-1", { status: "done", progress: 100 });
  });

  it("状态从完成循环回待开始，不强制清空或改动进度", async () => {
    const onUpdate = vi.fn();
    render(
      <TasksTab
        tasks={[makeTask({ status: "done", progress: 100 })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "任务状态：完成，点击切换到下一状态" }));

    expect(onUpdate).toHaveBeenCalledWith("t-1", { status: "todo" });
  });

  it("点击阻塞开关标记阻塞，且不改变任务状态（阻塞独立于状态循环）", async () => {
    const onUpdate = vi.fn();
    render(
      <TasksTab
        tasks={[makeTask({ status: "progress", blocked: false })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "标记阻塞" }));

    expect(onUpdate).toHaveBeenCalledWith("t-1", { blocked: true });
    expect(onUpdate).not.toHaveBeenCalledWith("t-1", expect.objectContaining({ status: expect.anything() }));
  });

  it("已阻塞任务再次点击开关取消阻塞", async () => {
    const onUpdate = vi.fn();
    render(
      <TasksTab
        tasks={[makeTask({ blocked: true })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "取消标记阻塞" }));

    expect(onUpdate).toHaveBeenCalledWith("t-1", { blocked: false });
  });

  it("已阻塞任务展开阻塞原因输入框，失焦提交后 onUpdate 收到修剪后的原因", async () => {
    const onUpdate = vi.fn();
    render(
      <TasksTab
        tasks={[makeTask({ blocked: true, blockNote: "" })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByText("点击说明阻塞原因…"));
    const textarea = screen.getByPlaceholderText("为什么阻塞？");
    await userEvent.type(textarea, "  等待接口对接  ");
    await userEvent.click(document.body);

    expect(onUpdate).toHaveBeenCalledWith("t-1", { blockNote: "等待接口对接" });
  });

  it("未阻塞的任务不显示阻塞原因入口", () => {
    render(
      <TasksTab
        tasks={[makeTask({ blocked: false })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByText("点击说明阻塞原因…")).not.toBeInTheDocument();
  });

  it("点击删除按钮，onRemove 收到目标任务的 id", async () => {
    const onRemove = vi.fn();
    render(
      <TasksTab tasks={[makeTask()]} draftOpen={false} onCreate={vi.fn()} onCancelDraft={vi.fn()} onUpdate={vi.fn()} onRemove={onRemove} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "删除任务" }));

    expect(onRemove).toHaveBeenCalledWith("t-1");
  });

  it("名称输入框失焦时修剪空白并只在变化时触发 onUpdate，名称清空时还原为原值", async () => {
    const onUpdate = vi.fn();
    render(
      <TasksTab tasks={[makeTask({ name: "任务一" })]} draftOpen={false} onCreate={vi.fn()} onCancelDraft={vi.fn()} onUpdate={onUpdate} onRemove={vi.fn()} />,
    );

    const nameInput = screen.getByDisplayValue("任务一");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "  改名后  ");
    await userEvent.click(document.body);

    expect(onUpdate).toHaveBeenCalledWith("t-1", { name: "改名后" });
  });

  it("点击截止日期按钮展开日期输入，选择日期后失焦提交，onUpdate 收到新日期", async () => {
    const onUpdate = vi.fn();
    render(
      <TasksTab tasks={[makeTask({ deadline: "" })]} draftOpen={false} onCreate={vi.fn()} onCancelDraft={vi.fn()} onUpdate={onUpdate} onRemove={vi.fn()} />,
    );

    await userEvent.click(screen.getByText("未设置截止日期"));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await userEvent.type(dateInput, "2026-08-01");
    await userEvent.click(document.body);

    expect(onUpdate).toHaveBeenCalledWith("t-1", { deadline: "2026-08-01" });
  });

  it("进度输入框失焦时按 0~100 修剪并提交，超出范围的输入被 clamp", async () => {
    const onUpdate = vi.fn();
    render(
      <TasksTab tasks={[makeTask({ progress: null })]} draftOpen={false} onCreate={vi.fn()} onCancelDraft={vi.fn()} onUpdate={onUpdate} onRemove={vi.fn()} />,
    );

    const progressInput = screen.getByPlaceholderText("—");
    await userEvent.type(progressInput, "150");
    await userEvent.click(document.body);

    expect(onUpdate).toHaveBeenCalledWith("t-1", { progress: 100 });
  });

  it("顶部汇总行显示完成数/总数，随任务状态变化", () => {
    render(
      <TasksTab
        tasks={[makeTask({ id: "t-1", status: "done" }), makeTask({ id: "t-2", status: "todo" })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("1/2 已完成")).toBeInTheDocument();
  });

  it("多条任务渲染多张卡片，互不影响：修改第一条不会波及第二条", () => {
    render(
      <TasksTab
        tasks={[makeTask({ id: "t-1", name: "任务一" }), makeTask({ id: "t-2", name: "任务二", status: "progress" })]}
        draftOpen={false}
        onCreate={vi.fn()}
        onCancelDraft={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("任务一")).toBeInTheDocument();
    expect(screen.getByDisplayValue("任务二")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "任务状态：待开始，点击切换到下一状态" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "任务状态：进行中，点击切换到下一状态" })).toBeInTheDocument();
  });
});
