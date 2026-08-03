import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { Board, resolveDropTransition, resolveReorder } from "./Board";
import type { Requirement } from "../../types/models";
import type { StageOption } from "../../types/schema";
import { defaultStageSort } from "../../lib/requirementSort";
import { useUiStore } from "../../stores/uiStore";
import { useSchemaStore } from "../../stores/schemaStore";
import { legacyEquivalentSchema } from "../../lib/schemaDefaults";

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

const STAGE_OPTIONS: StageOption[] = [
  { id: "collect", label: "收集", color: "#eee", isTerminal: false },
  { id: "design", label: "设计", color: "#eee", isTerminal: false },
  { id: "dev", label: "开发", color: "#eee", isTerminal: false },
  { id: "release", label: "发布", color: "#eee", isTerminal: false },
  { id: "archive", label: "归档", color: "#eee", isTerminal: true },
];

function makeRequirement(overrides: Partial<Omit<Requirement, "attributeValues">> = {}): Requirement {
  return {
    id: "r-1",
    name: "需求一",
    stage: "design",
    createdAt: "2026-01-01T00:00:00.000Z",
    manualOrder: 0,
    body: "",
    attributeValues: {
      priority: "P2",
      source: "内部想法",
      assignee: "",
      deadline: "",
      progress: null,
      release_method: "",
      release_date: "",
      result: null,
    },
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
  onAttributeChange: vi.fn(),
  onTransition: vi.fn(),
  onReorder: vi.fn(),
  onEditAttribute: vi.fn(),
};

describe("resolveDropTransition", () => {
  it("拖到不同阶段区域时返回目标需求 id 和目标阶段", () => {
    const requirements = [makeRequirement({ id: "r-1", stage: "design" })];

    const result = resolveDropTransition(requirements, STAGE_OPTIONS, "r-1", "dev");

    expect(result).toEqual({ requirementId: "r-1", toStage: "dev" });
  });

  it("拖拽落点没有命中任何可放置区域（over 为 undefined）时不触发流转", () => {
    const requirements = [makeRequirement({ id: "r-1", stage: "design" })];

    const result = resolveDropTransition(requirements, STAGE_OPTIONS, "r-1", undefined);

    expect(result).toBeNull();
  });

  it("拖回同一阶段（原位）时不触发流转", () => {
    const requirements = [makeRequirement({ id: "r-1", stage: "design" })];

    const result = resolveDropTransition(requirements, STAGE_OPTIONS, "r-1", "design");

    expect(result).toBeNull();
  });

  it("被拖拽的需求 id 在列表中找不到对应需求时不触发流转（边界：需求已被删除）", () => {
    const requirements = [makeRequirement({ id: "r-1", stage: "design" })];

    const result = resolveDropTransition(requirements, STAGE_OPTIONS, "non-existent-id", "dev");

    expect(result).toBeNull();
  });

  it("拖到归档区域时正常返回流转结果，不被特殊排除", () => {
    const requirements = [makeRequirement({ id: "r-1", stage: "release" })];

    const result = resolveDropTransition(requirements, STAGE_OPTIONS, "r-1", "archive");

    expect(result).toEqual({ requirementId: "r-1", toStage: "archive" });
  });

  it("over 是同阶段另一行需求的 id（悬停在行上而非区域容器上）时不触发流转", () => {
    const requirements = [
      makeRequirement({ id: "r-1", stage: "design" }),
      makeRequirement({ id: "r-2", stage: "design" }),
    ];

    const result = resolveDropTransition(requirements, STAGE_OPTIONS, "r-1", "r-2");

    expect(result).toBeNull();
  });

  it("over 是不同阶段另一行需求的 id 时按该行所属阶段触发流转", () => {
    const requirements = [
      makeRequirement({ id: "r-1", stage: "design" }),
      makeRequirement({ id: "r-2", stage: "dev" }),
    ];

    const result = resolveDropTransition(requirements, STAGE_OPTIONS, "r-1", "r-2");

    expect(result).toEqual({ requirementId: "r-1", toStage: "dev" });
  });
});

describe("resolveReorder", () => {
  it("同阶段内拖到另一行时返回按新顺序排列的该阶段完整列表", () => {
    const requirements = [
      makeRequirement({ id: "r-1", stage: "design", createdAt: "2026-01-01T00:00:00.000Z" }),
      makeRequirement({ id: "r-2", stage: "design", createdAt: "2026-01-02T00:00:00.000Z" }),
      makeRequirement({ id: "r-3", stage: "design", createdAt: "2026-01-03T00:00:00.000Z" }),
    ];
    // 默认排序按创建时间降序：r-3, r-2, r-1

    const result = resolveReorder(requirements, STAGE_OPTIONS, "r-1", "r-3", defaultStageSort());

    expect(result?.map((r) => r.id)).toEqual(["r-1", "r-3", "r-2"]);
  });

  it("over 是阶段容器 id（不是同阶段的行）时不触发重排", () => {
    const requirements = [makeRequirement({ id: "r-1", stage: "design" })];

    const result = resolveReorder(requirements, STAGE_OPTIONS, "r-1", "design", defaultStageSort());

    expect(result).toBeNull();
  });

  it("active 和 over 不同阶段时不触发重排", () => {
    const requirements = [
      makeRequirement({ id: "r-1", stage: "design" }),
      makeRequirement({ id: "r-2", stage: "dev" }),
    ];

    const result = resolveReorder(requirements, STAGE_OPTIONS, "r-1", "r-2", defaultStageSort());

    expect(result).toBeNull();
  });

  it("拖到自己身上时不触发重排", () => {
    const requirements = [makeRequirement({ id: "r-1", stage: "design" })];

    const result = resolveReorder(requirements, STAGE_OPTIONS, "r-1", "r-1", defaultStageSort());

    expect(result).toBeNull();
  });

  it("over 为 undefined 时不触发重排", () => {
    const requirements = [makeRequirement({ id: "r-1", stage: "design" })];

    const result = resolveReorder(requirements, STAGE_OPTIONS, "r-1", undefined, defaultStageSort());

    expect(result).toBeNull();
  });
});

describe("Board", () => {
  beforeEach(() => {
    useSchemaStore.setState({ schema: legacyEquivalentSchema([]), loadedProjectId: "p-1", justMigrated: false });
    useUiStore.setState({ boardSort: {} });
  });

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

  it("正常状态下渲染 schema 中的全部阶段区域和表头列名", () => {
    render(
      <Board requirements={[]} loading={false} error={false} selectedRequirementId={null} {...noop} />,
    );

    expect(screen.getByText("收集")).toBeInTheDocument();
    expect(screen.getByText("归档")).toBeInTheDocument();
    expect(screen.getByText("名称")).toBeInTheDocument();
    expect(screen.getByText("停留天数")).toBeInTheDocument();
  });

  it("schema 为空（未加载）时不渲染任何阶段区域，不报错", () => {
    useSchemaStore.setState({ schema: null, loadedProjectId: null, justMigrated: false });
    render(
      <Board requirements={[]} loading={false} error={false} selectedRequirementId={null} {...noop} />,
    );

    expect(screen.getByText("名称")).toBeInTheDocument();
    expect(screen.queryByText("收集")).not.toBeInTheDocument();
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

  it("拖拽结束落在同阶段另一行上时调用 onReorder 并把该阶段切到手动排序", () => {
    const onReorder = vi.fn();

    render(
      <Board
        requirements={[
          makeRequirement({ id: "r-1", stage: "design", createdAt: "2026-01-01T00:00:00.000Z" }),
          makeRequirement({ id: "r-2", stage: "design", createdAt: "2026-01-02T00:00:00.000Z" }),
        ]}
        loading={false}
        error={false}
        selectedRequirementId={null}
        {...noop}
        onReorder={onReorder}
      />,
    );

    capturedOnDragEnd?.({
      active: { id: "r-1" },
      over: { id: "r-2" },
    } as unknown as DragEndEvent);

    expect(onReorder).toHaveBeenCalled();
    expect(useUiStore.getState().getStageSort("design").mode).toBe("manual");
  });

  it("终态阶段（归档）的需求拖拽不触发 onReorder（终态不参与手动排序）", () => {
    const onReorder = vi.fn();

    render(
      <Board
        requirements={[
          makeRequirement({ id: "r-1", stage: "archive" }),
          makeRequirement({ id: "r-2", stage: "archive" }),
        ]}
        loading={false}
        error={false}
        selectedRequirementId={null}
        {...noop}
        onReorder={onReorder}
      />,
    );

    capturedOnDragEnd?.({
      active: { id: "r-1" },
      over: { id: "r-2" },
    } as unknown as DragEndEvent);

    expect(onReorder).not.toHaveBeenCalled();
  });
});
