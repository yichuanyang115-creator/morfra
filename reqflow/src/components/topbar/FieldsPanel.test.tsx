import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { FieldsPanel } from "./FieldsPanel";
import type { Attribute } from "../../types/schema";

let capturedOnDragEnd: ((event: DragEndEvent) => void) | null = null;

vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");
  return {
    ...actual,
    DndContext: ({ children, onDragEnd }: { children: ReactNode; onDragEnd: (event: DragEndEvent) => void }) => {
      capturedOnDragEnd = onDragEnd;
      return children;
    },
  };
});

function makeAttribute(overrides: Partial<Attribute>): Attribute {
  return { id: "a", name: "属性", type: "text", showOnBoard: true, showOnDetail: true, ...overrides };
}

function renderPanel(overrides: { attributes?: Attribute[]; onToggleBoard?: (id: string, next: boolean) => void } = {}) {
  const onToggleBoard = overrides.onToggleBoard ?? vi.fn();
  const onReorder = vi.fn();
  const onAdd = vi.fn();
  const onClose = vi.fn();
  const attributes = overrides.attributes ?? [makeAttribute({ id: "priority", name: "优先级", type: "singleSelect" })];
  render(
    <FieldsPanel attributes={attributes} onToggleBoard={onToggleBoard} onReorder={onReorder} onAdd={onAdd} onClose={onClose} />,
  );
  return { onToggleBoard, onReorder, onAdd, onClose };
}

describe("FieldsPanel", () => {
  it("渲染全部属性行（含已从看板隐藏的）与类型标签", () => {
    renderPanel({
      attributes: [
        makeAttribute({ id: "priority", name: "优先级", type: "singleSelect" }),
        makeAttribute({ id: "source", name: "来源", showOnBoard: false }),
      ],
    });
    expect(screen.getByText("优先级")).toBeInTheDocument();
    expect(screen.getByText("来源")).toBeInTheDocument();
    // 类型标签与下拉选项可能同名（如"单选"），用 getAllByText 确认标签存在
    expect(screen.getAllByText("单选").length).toBeGreaterThan(0);
    expect(screen.getAllByText("文本").length).toBeGreaterThan(0);
  });

  it("点可见属性的眼睛图标，带当前属性 id 和 false 触发 onToggleBoard（隐藏该列）", async () => {
    const { onToggleBoard } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "隐藏「优先级」看板列" }));
    expect(onToggleBoard).toHaveBeenCalledWith("priority", false);
  });

  it("点已隐藏属性的眼睛图标，带 true 触发 onToggleBoard（恢复显示）", async () => {
    const { onToggleBoard } = renderPanel({
      attributes: [makeAttribute({ id: "source", name: "来源", showOnBoard: false })],
    });
    await userEvent.click(screen.getByRole("button", { name: "显示「来源」看板列" }));
    expect(onToggleBoard).toHaveBeenCalledWith("source", true);
  });

  it("拖拽排序松手后把换位后的完整属性 id 顺序传给 onReorder", () => {
    const { onReorder } = renderPanel({
      attributes: [
        makeAttribute({ id: "priority", name: "优先级" }),
        makeAttribute({ id: "assignee", name: "负责人" }),
        makeAttribute({ id: "deadline", name: "截止日期" }),
      ],
    });

    capturedOnDragEnd?.({
      active: { id: "priority" },
      over: { id: "deadline" },
    } as unknown as DragEndEvent);

    expect(onReorder).toHaveBeenCalledWith(["assignee", "deadline", "priority"]);
  });

  it("拖到自己身上（active 和 over 相同）时不触发 onReorder", () => {
    const { onReorder } = renderPanel();
    capturedOnDragEnd?.({ active: { id: "priority" }, over: { id: "priority" } } as unknown as DragEndEvent);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("输入名称回车后新建属性：默认看板+详情都显示，选项为空，类型默认文本", async () => {
    const { onAdd } = renderPanel();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("新属性名称"), "里程碑");
    await user.keyboard("{Enter}");
    expect(onAdd).toHaveBeenCalledTimes(1);
    const added = onAdd.mock.calls[0][0] as Attribute;
    expect(added.name).toBe("里程碑");
    expect(added.type).toBe("text");
    expect(added.options).toEqual([]);
    expect(added.showOnBoard).toBe(true);
    expect(added.showOnDetail).toBe(true);
    expect(added.id).toBeTruthy();
  });

  it("选择类型后回车，新建的属性类型跟随所选值", async () => {
    const { onAdd } = renderPanel();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("新属性名称"), "工数");
    await user.selectOptions(screen.getByLabelText("新属性类型"), "number");
    await user.click(screen.getByRole("button", { name: "新建属性" }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: "工数", type: "number" }));
  });

  it("同名属性新建被拦截，提示错误且不触发 onAdd", async () => {
    const { onAdd } = renderPanel();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("新属性名称"), "优先级");
    await user.keyboard("{Enter}");
    expect(screen.getByText("同名属性已存在")).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("只输入空格不提交新建", async () => {
    const { onAdd } = renderPanel();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("新属性名称"), "   ");
    await user.keyboard("{Enter}");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("没有任何属性时显示空状态引导文案", () => {
    renderPanel({ attributes: [] });
    expect(screen.getByText("还没有字段，在下方新建一个")).toBeInTheDocument();
  });

  it("按 Esc 触发 onClose 关闭面板", () => {
    const { onClose } = renderPanel();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
