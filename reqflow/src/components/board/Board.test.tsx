import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { Board } from "./Board";
import type { Requirement } from "../../types/models";

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

function makeRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: "r-1",
    name: "需求一",
    stage: "design",
    priority: "P2",
    source: "内部想法",
    assignee: "",
    deadline: "",
    progress: null,
    closureType: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    releaseMethod: "",
    releaseDate: "",
    body: "",
    deliverables: [],
    tasks: [],
    acceptance: [],
    transitions: [],
    comments: [],
    ...overrides,
  };
}

const noop = {
  onCreate: vi.fn(),
  onSelectRequirement: vi.fn(),
  onProgressChange: vi.fn(),
  onTransition: vi.fn(),
  onReleaseMethodChange: vi.fn(),
  onReleaseDateChange: vi.fn(),
};

describe("Board", () => {
  it("loading 为 true 时渲染骨架屏，不渲染阶段列表", () => {
    render(
      <Board requirements={[]} loading={true} error={false} selectedRequirementId={null} {...noop} />,
    );

    expect(screen.queryByText("收集")).not.toBeInTheDocument();
  });

  it("error 为 true 时渲染错误提示，不渲染阶段列表", () => {
    render(
      <Board requirements={[]} loading={false} error={true} selectedRequirementId={null} {...noop} />,
    );

    expect(screen.getByText("数据读取失败，请检查项目文件夹")).toBeInTheDocument();
    expect(screen.queryByText("收集")).not.toBeInTheDocument();
  });

  it("正常状态下渲染全部阶段区域和表头列名", () => {
    render(
      <Board requirements={[]} loading={false} error={false} selectedRequirementId={null} {...noop} />,
    );

    expect(screen.getByText("收集")).toBeInTheDocument();
    expect(screen.getByText("归档")).toBeInTheDocument();
    expect(screen.getByText("名称")).toBeInTheDocument();
    expect(screen.getByText("停留天数")).toBeInTheDocument();
  });

  it("需求列表为空时显示全局空状态提示", () => {
    render(
      <Board requirements={[]} loading={false} error={false} selectedRequirementId={null} {...noop} />,
    );

    expect(screen.getByText("还没有需求，点收集阶段的新建按钮记录你的第一个想法")).toBeInTheDocument();
  });

  it("需求按 stage 分发到对应阶段区域下渲染", () => {
    render(
      <Board
        requirements={[makeRequirement({ id: "r-1", name: "开发中的需求", stage: "dev" })]}
        loading={false}
        error={false}
        selectedRequirementId={null}
        {...noop}
      />,
    );

    expect(screen.getByText("开发中的需求")).toBeInTheDocument();
  });

  it("拖拽结束落在不同阶段区域时调用 onTransition，携带目标需求 id 和目标阶段", () => {
    const onTransition = vi.fn();

    render(
      <Board
        requirements={[makeRequirement({ id: "r-1", stage: "design" })]}
        loading={false}
        error={false}
        selectedRequirementId={null}
        {...noop}
        onTransition={onTransition}
      />,
    );

    capturedOnDragEnd?.({
      active: { id: "r-1" },
      over: { id: "dev" },
    } as unknown as DragEndEvent);

    expect(onTransition).toHaveBeenCalledWith("r-1", "dev");
  });

  it("拖拽结束落在原阶段区域时不调用 onTransition", () => {
    const onTransition = vi.fn();

    render(
      <Board
        requirements={[makeRequirement({ id: "r-1", stage: "design" })]}
        loading={false}
        error={false}
        selectedRequirementId={null}
        {...noop}
        onTransition={onTransition}
      />,
    );

    capturedOnDragEnd?.({
      active: { id: "r-1" },
      over: { id: "design" },
    } as unknown as DragEndEvent);

    expect(onTransition).not.toHaveBeenCalled();
  });
});
