import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetailPanel } from "./DetailPanel";
import type { Requirement } from "../../types/models";

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
    manualOrder: 0,
    body: "",
    deliverables: [],
    tasks: [],
    acceptance: [],
    transitions: [],
    comments: [],
    ...overrides,
  };
}

const noopHandlers = {
  onSelectTab: vi.fn(),
  onRename: vi.fn(),
  onFieldChange: vi.fn(),
  onProgressChange: vi.fn(),
  onAddSource: vi.fn(),
  onBodyChange: vi.fn(),
  onCreateDeliverable: vi.fn(),
  onUpdateDeliverable: vi.fn(),
  onRemoveDeliverable: vi.fn(),
  onCreateTask: vi.fn(),
  onUpdateTask: vi.fn(),
  onRemoveTask: vi.fn(),
  onCreateAcceptance: vi.fn(),
  onUpdateAcceptance: vi.fn(),
  onRemoveAcceptance: vi.fn(),
  onTransition: vi.fn(),
  onUpdateTransitionNote: vi.fn(),
  onAddComment: vi.fn(),
  onDeleteTransition: vi.fn(),
};

describe("DetailPanel（AC-002/004/005：右栏切换与全屏）", () => {
  it("requirement 为 null 时显示引导占位文案，不渲染详情内容（未选中任何需求）", () => {
    render(
      <DetailPanel
        requirement={null}
        sources={[]}
        width={800}
        fullscreen={false}
        activeTab="body"
        onToggleFullscreen={vi.fn()}
        {...noopHandlers}
      />,
    );

    expect(screen.getByText("选择一条需求查看详情")).toBeInTheDocument();
  });

  it("requirement 非空时渲染该需求的名称、属性区和 Tab 栏（AC-002/004：点击行后右栏切为该需求详情）", () => {
    render(
      <DetailPanel
        requirement={makeRequirement({ name: "登录页优化" })}
        sources={["内部想法"]}
        width={800}
        fullscreen={false}
        activeTab="body"
        onToggleFullscreen={vi.fn()}
        {...noopHandlers}
      />,
    );

    expect(screen.getByDisplayValue("登录页优化")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "正文" })).toHaveAttribute("aria-selected", "true");
  });

  it("点击全屏按钮触发 onToggleFullscreen，不依赖父组件已把 fullscreen 置 true", async () => {
    const onToggleFullscreen = vi.fn();
    render(
      <DetailPanel
        requirement={makeRequirement()}
        sources={[]}
        width={800}
        fullscreen={false}
        activeTab="body"
        onToggleFullscreen={onToggleFullscreen}
        {...noopHandlers}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "全屏" }));

    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it("切换到 produce Tab 后渲染产出 Tab 内容而不是正文编辑器", () => {
    render(
      <DetailPanel
        requirement={makeRequirement()}
        sources={[]}
        width={800}
        fullscreen={false}
        activeTab="produce"
        onToggleFullscreen={vi.fn()}
        {...noopHandlers}
      />,
    );

    expect(screen.getByRole("tab", { name: "产出" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("还没有产出，点右上角 + 新建")).toBeInTheDocument();
  });

  it("width 参数直接决定属性区两列/单列（REQ-003 v2.8）——不再靠 ResizeObserver 量测 DOM 反推，" +
    "由 MainLayout 算出的确切宽度值直接驱动，链路短、无中间不确定性（回归：详情面板收缩 bug，" +
    "此前用 ResizeObserver 时该逻辑从未真正生效）", () => {
    const { container: wideContainer } = render(
      <DetailPanel
        requirement={makeRequirement()}
        sources={[]}
        width={800}
        fullscreen={false}
        activeTab="body"
        onToggleFullscreen={vi.fn()}
        {...noopHandlers}
      />,
    );
    const wideGrid = wideContainer.querySelector('[style*="grid-template-columns"]') as HTMLElement;
    expect(wideGrid.style.gridTemplateColumns).toBe("58px minmax(0, 1fr) 58px minmax(0, 1fr)");

    const { container: narrowContainer } = render(
      <DetailPanel
        requirement={makeRequirement()}
        sources={[]}
        width={480}
        fullscreen={false}
        activeTab="body"
        onToggleFullscreen={vi.fn()}
        {...noopHandlers}
      />,
    );
    const narrowGrid = narrowContainer.querySelector('[style*="grid-template-columns"]') as HTMLElement;
    expect(narrowGrid.style.gridTemplateColumns).toBe("58px minmax(0, 1fr)");
  });

  it("切换需求（requirement.id 改变）后组件用 key 强制重挂载，不残留上一条需求的本地状态", () => {
    const { rerender } = render(
      <DetailPanel
        requirement={makeRequirement({ id: "r-1", name: "需求一" })}
        sources={[]}
        width={800}
        fullscreen={false}
        activeTab="body"
        onToggleFullscreen={vi.fn()}
        {...noopHandlers}
      />,
    );
    expect(screen.getByDisplayValue("需求一")).toBeInTheDocument();

    rerender(
      <DetailPanel
        requirement={makeRequirement({ id: "r-2", name: "需求二" })}
        sources={[]}
        width={800}
        fullscreen={false}
        activeTab="body"
        onToggleFullscreen={vi.fn()}
        {...noopHandlers}
      />,
    );

    expect(screen.queryByDisplayValue("需求一")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("需求二")).toBeInTheDocument();
  });
});
