import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityTab } from "./ActivityTab";
import type { Comment, TransitionRecord } from "../../../types/models";

function makeTransition(overrides: Partial<TransitionRecord> = {}): TransitionRecord {
  return {
    id: "tr-1",
    from: "collect",
    to: "need",
    timestamp: "2026-01-01T09:00:00.000Z",
    by: "我",
    note: "",
    ...overrides,
  };
}

describe("ActivityTab", () => {
  it("需求从未流转过时显示空状态，不生成任何节点", () => {
    render(
      <ActivityTab
        currentStage="need"
        transitions={[]}
        comments={[]}
        closureType={null}
        onUpdateNote={vi.fn()}
        onAddComment={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("该实体还没有流转记录")).toBeInTheDocument();
  });

  it("经过 2 次流转后显示 2 个节点，按顺序排列", () => {
    const transitions = [
      makeTransition({ id: "tr-1", from: "collect", to: "need" }),
      makeTransition({ id: "tr-2", from: "need", to: "design" }),
    ];
    render(
      <ActivityTab currentStage="design" transitions={transitions} comments={[]} closureType={null} onUpdateNote={vi.fn()} onAddComment={vi.fn()} onDelete={vi.fn()} />,
    );

    expect(screen.getByText("梳理")).toBeInTheDocument();
    expect(screen.getByText("设计")).toBeInTheDocument();
  });

  it("当前阶段是废弃归档时，最后一个节点显示归档（废弃）", () => {
    const transitions = [makeTransition({ id: "tr-1", from: "dev", to: "archive" })];
    render(
      <ActivityTab currentStage="archive" transitions={transitions} comments={[]} closureType="abandoned" onUpdateNote={vi.fn()} onAddComment={vi.fn()} onDelete={vi.fn()} />,
    );

    expect(screen.getByText("归档（废弃）")).toBeInTheDocument();
  });

  it("已删除阶段使用流转记录上的名称快照，不依赖仍存在的 Schema 阶段", () => {
    render(
      <ActivityTab
        currentStage="design"
        transitions={[makeTransition({ to: "retired-stage", toLabel: "旧评审" })]}
        comments={[]}
        closureType={null}
        onUpdateNote={vi.fn()}
        onAddComment={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("旧评审")).toBeInTheDocument();
  });

  it("点击说明按钮展开输入框，失焦提交后 onUpdateNote 收到修剪后的说明", async () => {
    const onUpdateNote = vi.fn();
    render(
      <ActivityTab currentStage="need" transitions={[makeTransition()]} comments={[]} closureType={null} onUpdateNote={onUpdateNote} onAddComment={vi.fn()} onDelete={vi.fn()} />,
    );

    await userEvent.click(screen.getByText("点击添加说明…"));
    const textarea = screen.getByPlaceholderText("补充这次流转的说明…");
    await userEvent.type(textarea, "  优先级评估为 P0  ");
    await userEvent.click(document.body);

    expect(onUpdateNote).toHaveBeenCalledWith("tr-1", "优先级评估为 P0");
  });

  it("节点下的评论按所属节点关联展示，不会串到其他节点", () => {
    const transitions = [
      makeTransition({ id: "tr-1", to: "need" }),
      makeTransition({ id: "tr-2", from: "need", to: "design" }),
    ];
    const comments: Comment[] = [
      { id: "c-1", transitionId: "tr-1", content: "第一条评论", timestamp: "2026-01-02T00:00:00.000Z" },
      { id: "c-2", transitionId: "tr-2", content: "第二条评论", timestamp: "2026-01-03T00:00:00.000Z" },
    ];
    render(
      <ActivityTab currentStage="design" transitions={transitions} comments={comments} closureType={null} onUpdateNote={vi.fn()} onAddComment={vi.fn()} onDelete={vi.fn()} />,
    );

    expect(screen.getByText("第一条评论")).toBeInTheDocument();
    expect(screen.getByText("第二条评论")).toBeInTheDocument();
  });

  it("点击 + 评论展开输入框，回车提交后 onAddComment 收到目标节点 id 和内容", async () => {
    const onAddComment = vi.fn();
    render(
      <ActivityTab currentStage="need" transitions={[makeTransition()]} comments={[]} closureType={null} onUpdateNote={vi.fn()} onAddComment={onAddComment} onDelete={vi.fn()} />,
    );

    await userEvent.click(screen.getByText("+ 评论"));
    const input = screen.getByPlaceholderText("写评论，回车发送");
    await userEvent.type(input, "这个改动风险较大");
    await userEvent.keyboard("{Enter}");

    expect(onAddComment).toHaveBeenCalledWith("tr-1", "这个改动风险较大");
  });

  it("点击删除按钮弹出二次确认，取消不触发 onDelete", async () => {
    const onDelete = vi.fn();
    render(
      <ActivityTab currentStage="need" transitions={[makeTransition()]} comments={[]} closureType={null} onUpdateNote={vi.fn()} onAddComment={vi.fn()} onDelete={onDelete} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "删除该流转记录" }));
    expect(screen.getByText("删除该流转记录？")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText("删除该流转记录？")).not.toBeInTheDocument();
  });

  it("点击删除按钮二次确认后，onDelete 收到目标流转记录 id", async () => {
    const onDelete = vi.fn();
    render(
      <ActivityTab currentStage="need" transitions={[makeTransition({ id: "tr-1" })]} comments={[]} closureType={null} onUpdateNote={vi.fn()} onAddComment={vi.fn()} onDelete={onDelete} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "删除该流转记录" }));
    await userEvent.click(screen.getByRole("button", { name: "删除" }));

    expect(onDelete).toHaveBeenCalledWith("tr-1");
  });

  it("高亮节点按当前阶段匹配，不是简单取数组最后一条：删除最新流转记录后阶段不回退，高亮应落在仍匹配当前阶段的记录上", () => {
    const transitions = [
      makeTransition({ id: "tr-1", from: "collect", to: "need" }),
      makeTransition({ id: "tr-2", from: "need", to: "design" }),
    ];
    const { container } = render(
      <ActivityTab currentStage="need" transitions={transitions} comments={[]} closureType={null} onUpdateNote={vi.fn()} onAddComment={vi.fn()} onDelete={vi.fn()} />,
    );

    const dots = container.querySelectorAll("span.absolute.top-0\\.5");
    expect(dots[0]).toHaveClass("bg-(--module-scope-action-base)");
    expect(dots[1]).not.toHaveClass("bg-(--module-scope-action-base)");
  });
});
