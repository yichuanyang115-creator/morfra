import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetailPanel } from "./DetailPanel";
import type { Requirement } from "../../types/models";
import type { Attribute, TabDefinition } from "../../types/schema";

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

function makeAttribute(overrides: Partial<Attribute>): Attribute {
  return { id: "a", name: "属性", type: "text", showOnBoard: true, showOnDetail: true, ...overrides };
}

const noopHandlers = {
  onClose: vi.fn(),
  onSelectTab: vi.fn(),
  onRename: vi.fn(),
  onAttributeChange: vi.fn(),
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

const genericTabs: TabDefinition[] = [
  { id: "review", name: "复盘", renderer: "generic", visible: true, fields: [{ id: "name", name: "名称", type: "text" }] },
];

describe("DetailPanel（AC-002/004/005：右栏切换与全屏）", () => {
  it("自定义 Tab 的新建记录入口位于 Tab 栏右侧，点击后显示内容区草稿", async () => {
    render(
      <DetailPanel
        requirement={makeRequirement()}
        attributes={[]}
        tabs={genericTabs}
        projectId="p-1"
        isTerminal={false}
        width={800}
        fullscreen={false}
        activeTab="review"
        onToggleFullscreen={vi.fn()}
        {...noopHandlers}
      />,
    );

    expect(screen.getByRole("button", { name: "新建复盘记录" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ 添加记录" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "新建复盘记录" }));
    expect(screen.getByRole("button", { name: "保存记录" })).toBeInTheDocument();
  });

  it("requirement 为 null 时显示引导占位文案，不渲染详情内容（未选中任何需求）", () => {
    render(
      <DetailPanel
        requirement={null}
        attributes={[]}
        isTerminal={false}
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
        attributes={[makeAttribute({ id: "assignee", name: "负责人", type: "text" })]}
        isTerminal={false}
        width={800}
        fullscreen={false}
        activeTab="body"
        onToggleFullscreen={vi.fn()}
        {...noopHandlers}
      />,
    );

    expect(screen.getByDisplayValue("登录页优化")).toBeInTheDocument();
    expect(screen.getByText("负责人")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "正文" })).toHaveAttribute("aria-selected", "true");
  });

  it("点击全屏按钮触发 onToggleFullscreen，不依赖父组件已把 fullscreen 置 true", async () => {
    const onToggleFullscreen = vi.fn();
    render(
      <DetailPanel
        requirement={makeRequirement()}
        attributes={[]}
        isTerminal={false}
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

  it("点击关闭×按钮触发 onClose（AC-006：面板关闭主内容区恢复全宽）", async () => {
    const onClose = vi.fn();
    render(
      <DetailPanel
        requirement={makeRequirement()}
        attributes={[]}
        isTerminal={false}
        width={800}
        fullscreen={false}
        activeTab="body"
        onToggleFullscreen={vi.fn()}
        {...noopHandlers}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "关闭" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("切换到 produce Tab 后渲染产出 Tab 内容而不是正文编辑器", () => {
    render(
      <DetailPanel
        requirement={makeRequirement()}
        attributes={[]}
        isTerminal={false}
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
        attributes={[]}
        isTerminal={false}
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
        attributes={[]}
        isTerminal={false}
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
        attributes={[]}
        isTerminal={false}
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
        attributes={[]}
        isTerminal={false}
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
