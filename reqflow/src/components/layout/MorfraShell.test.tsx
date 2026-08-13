import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MorfraShell } from "./MorfraShell";
import { useLayoutStore } from "../../stores/layoutStore";
import { useAIProviderStore } from "../../stores/aiProviderStore";
import { useProjectStore } from "../../stores/projectStore";

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}

describe("MorfraShell", () => {
  beforeEach(() => {
    setViewport(1280, 800);
    window.localStorage.clear();
    useProjectStore.setState({
      projects: [{ id: "project-1", name: "测试项目", sources: [] }],
      currentProjectId: "project-1",
      loaded: true,
      initializing: false,
      error: false,
    });
    useLayoutStore.setState({
      hydrated: false,
      sidebarOpen: true,
      sidebarWidth: 240,
      detailOpen: false,
      detailWidth: 440,
      aiOpen: false,
      aiWidth: 360,
      activeRightPanel: "detail",
      appearanceMode: "system",
    });
  });

  it("将项目上下文和切换入口放在标题栏，侧栏只保留表导航", () => {
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    expect(screen.getByTestId("morfra-titlebar")).toBeInTheDocument();
    expect(screen.queryByText("morfra")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建表" })).toHaveAttribute("title", "新建表");
    expect(screen.getByRole("button", { name: "测试项目" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "测试项目" }));
    expect(screen.getByRole("menu", { name: "最近项目" })).toBeInTheDocument();
    expect(screen.getByTestId("morfra-sidebar")).toBeInTheDocument();
    expect(screen.queryByText("Morfra 本地项目包")).not.toBeInTheDocument();
    expect(screen.queryByText("当前项目")).not.toBeInTheDocument();
    expect(screen.getByText("主表格")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("separator", { name: "调整导航宽度" }), { key: "ArrowRight" });
    expect(useLayoutStore.getState().sidebarWidth).toBe(256);
  });

  it("标题栏 AI 入口可切换右侧抽屉且不影响主区域", async () => {
    setViewport(1199, 800);
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    const toggle = screen.getByRole("button", { name: "打开 AI 表格助手" });
    fireEvent.click(toggle);

    await waitFor(() => expect(screen.getByRole("button", { name: "关闭 AI 表格助手" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByTestId("morfra-shell")).toHaveAttribute("data-window-mode", "narrow");
    expect(screen.getByTestId("morfra-shell")).toHaveAttribute("data-right-panel-mode", "drawer");
    expect(screen.getByText("主表格")).toBeInTheDocument();
  });

  it("双栏实际网格包含侧栏与右栏分隔条，主区保留 560px 计算底线", () => {
    setViewport(1600, 900);
    useLayoutStore.setState({ hydrated: true, detailOpen: true, aiOpen: true });
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    const body = screen.getByTestId("morfra-shell").querySelector<HTMLElement>(".morfra-shell-body");
    expect(body?.style.gridTemplateColumns).toBe("240px 8px minmax(0, 1fr) 8px 440px 8px 336px");
  });

  it("侧栏分隔条可停留在中间宽度，并在同一手势中吸附收起和反向展开", async () => {
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    const resizer = screen.getByRole("separator", { name: "调整导航宽度" });
    fireEvent.pointerDown(resizer, { pointerId: 1, clientX: 500 });
    fireEvent.pointerMove(resizer, { pointerId: 1, clientX: 450 });

    expect(screen.getByTestId("morfra-shell")).toHaveAttribute("data-sidebar-open", "true");
    expect(screen.getByTestId("morfra-sidebar")).not.toHaveClass("is-collapsed");
    expect(screen.getByTestId("morfra-shell").querySelector<HTMLElement>(".morfra-shell-body")?.style.gridTemplateColumns).toContain("190px");
    expect(useLayoutStore.getState().sidebarWidth).toBe(190);

    fireEvent.pointerMove(resizer, { pointerId: 1, clientX: 308 });

    expect(screen.getByTestId("morfra-shell")).toHaveAttribute("data-sidebar-open", "false");
    expect(screen.getByTestId("morfra-sidebar")).toHaveClass("is-collapsed");
    expect(resizer).toHaveAttribute("aria-valuenow", "48");
    expect(resizer).toHaveAttribute("aria-valuemin", "48");

    fireEvent.pointerMove(resizer, { pointerId: 1, clientX: 388 });

    await waitFor(() => expect(screen.getByTestId("morfra-shell")).toHaveAttribute("data-sidebar-open", "true"));
    expect(useLayoutStore.getState().sidebarWidth).toBe(96);
    fireEvent.pointerMove(resizer, { pointerId: 1, clientX: 532 });
    await waitFor(() => expect(useLayoutStore.getState().sidebarWidth).toBe(240));
    fireEvent.pointerUp(resizer, { pointerId: 1 });
  });

  it("拖拽在中间宽度松开后保留完整表项展示与宽度", () => {
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    const resizer = screen.getByRole("separator", { name: "调整导航宽度" });
    fireEvent.pointerDown(resizer, { pointerId: 1, clientX: 500 });
    fireEvent.pointerMove(resizer, { pointerId: 1, clientX: 450 });
    fireEvent.pointerUp(resizer, { pointerId: 1, clientX: 450 });

    expect(screen.getByTestId("morfra-shell")).toHaveAttribute("data-sidebar-open", "true");
    expect(screen.getByTestId("morfra-sidebar")).not.toHaveClass("is-collapsed");
    expect(useLayoutStore.getState().sidebarWidth).toBe(190);
  });

  it("详情已打开时，标题栏 AI 入口会切换到 AI 内容而不是继续显示详情", async () => {
    useLayoutStore.setState({ detailOpen: true });
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    fireEvent.click(screen.getByRole("button", { name: "打开 AI 表格助手" }));

    await waitFor(() => expect(screen.getByLabelText("AI 表格助手")).toBeInTheDocument());
    expect(screen.queryByRole("tab", { name: "详情" })).not.toBeInTheDocument();
  });

  it("窄窗口导航入口打开仅含表导航的临时浮层，选择表后关闭", async () => {
    setViewport(1199, 800);
    useProjectStore.setState({
      projects: [{
        id: "project-1",
        name: "测试项目",
        sources: [],
        storageSnapshot: {
          manifest: { id: "project-1", name: "测试项目", formatVersion: 3, createdAt: "2026-08-12T00:00:00.000Z", updatedAt: "2026-08-12T00:00:00.000Z" },
          tables: [{ id: "table-1", name: "测试表", emoji: "📋", position: 0, titleFieldId: "field-1", recordCount: 0, views: [] }],
        },
      }],
    });
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    fireEvent.click(screen.getByRole("button", { name: "展开导航" }));
    expect(screen.getByRole("button", { name: "关闭项目导航" })).toBeInTheDocument();
    expect(screen.queryByText("Morfra 本地项目包")).not.toBeInTheDocument();
    expect(screen.queryByText("当前项目")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("测试表").closest("button")!);
    await waitFor(() => expect(screen.queryByRole("button", { name: "关闭项目导航" })).not.toBeInTheDocument());
  });

  it("从标题栏切换项目后，侧栏同步显示新项目的表", async () => {
    useProjectStore.setState({
      projects: [
        { id: "project-1", name: "项目甲", sources: [], storageSnapshot: { manifest: { id: "project-1", name: "项目甲", formatVersion: 3, createdAt: "2026-08-12T00:00:00.000Z", updatedAt: "2026-08-12T00:00:00.000Z" }, tables: [{ id: "table-a", name: "甲表", emoji: "📋", position: 0, titleFieldId: "field-a", recordCount: 0, views: [] }] } },
        { id: "project-2", name: "项目乙", sources: [], storageSnapshot: { manifest: { id: "project-2", name: "项目乙", formatVersion: 3, createdAt: "2026-08-12T00:00:00.000Z", updatedAt: "2026-08-12T00:00:00.000Z" }, tables: [{ id: "table-b", name: "乙表", emoji: "🚀", position: 0, titleFieldId: "field-b", recordCount: 0, views: [] }] } },
      ],
      currentProjectId: "project-1",
    });
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    fireEvent.click(screen.getByRole("button", { name: "项目甲" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "项目乙" }));

    await waitFor(() => expect(screen.getByText("乙表").closest("button")).toBeInTheDocument());
    expect(screen.queryByText("甲表")).not.toBeInTheDocument();
    expect(screen.queryByText("当前项目")).not.toBeInTheDocument();
  });

  it("窄窗口折叠轨道没有项目残留，浮层只显示表导航", () => {
    setViewport(960, 800);
    useProjectStore.setState({
      projects: [{
        id: "project-1",
        name: "测试项目",
        sources: [],
        storageSnapshot: {
          manifest: { id: "project-1", name: "测试项目", formatVersion: 3, createdAt: "2026-08-12T00:00:00.000Z", updatedAt: "2026-08-12T00:00:00.000Z" },
          tables: [],
        },
      }],
    });
    const { container } = render(<MorfraShell mainContent={<div>主表格</div>} />);

    expect(container.querySelector(".morfra-sidebar-overlay-panel")).not.toBeInTheDocument();

    const collapsedSidebar = screen.getByTestId("morfra-sidebar");
    expect(collapsedSidebar).toHaveClass("is-collapsed");
    expect(collapsedSidebar).toContainElement(screen.getByRole("region", { name: "当前项目的表" }));
    expect(collapsedSidebar.querySelector(".morfra-table-row")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开导航" }));
    expect(container.querySelector(".morfra-sidebar-overlay-panel .morfra-sidebar")).toBeInTheDocument();
    expect(screen.queryByText("Morfra 本地项目包")).not.toBeInTheDocument();
  });

  it("常规窗口手动收起后只保留可切换的表图标，再展开恢复表名", () => {
    useProjectStore.setState({
      projects: [{ id: "project-1", name: "测试项目", sources: [], storageSnapshot: {
        manifest: { id: "project-1", name: "测试项目", formatVersion: 3, createdAt: "2026-08-12T00:00:00.000Z", updatedAt: "2026-08-12T00:00:00.000Z" },
        tables: [{ id: "table-1", name: "很长的测试表名", emoji: "🎯", position: 0, titleFieldId: "field-1", recordCount: 0, views: [] }],
      } }],
    });
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    fireEvent.click(screen.getByRole("button", { name: "收起导航" }));

    expect(screen.getByRole("button", { name: "展开导航" })).toBeInTheDocument();
    expect(screen.getByTestId("morfra-sidebar")).toHaveClass("is-collapsed");
    const compactTable = screen.getByRole("button", { name: "很长的测试表名" });
    expect(compactTable).toHaveAttribute("title", "很长的测试表名");
    expect(compactTable).toHaveTextContent("🎯");
    expect(screen.queryByText("很长的测试表名")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更多表操作 很长的测试表名" })).not.toBeInTheDocument();
    expect(screen.getByText("主表格")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开导航" }));
    expect(screen.getByText("很长的测试表名")).toBeInTheDocument();
  });

  it("表列表直接从侧栏顶部内边距开始，不保留无意义分隔", () => {
    useProjectStore.setState({
      projects: [{ id: "project-1", name: "测试项目", sources: [], storageSnapshot: {
        manifest: { id: "project-1", name: "测试项目", formatVersion: 3, createdAt: "2026-08-12T00:00:00.000Z", updatedAt: "2026-08-12T00:00:00.000Z" },
        tables: [{ id: "table-1", name: "首张表", emoji: "📋", position: 0, titleFieldId: "field-1", recordCount: 0, views: [] }],
      } }],
    });
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    const tableList = screen.getByRole("region", { name: "当前项目的表" });
    expect(tableList).toHaveClass("morfra-table-list");
    expect(tableList.querySelectorAll(".morfra-table-row")).toHaveLength(1);
  });

  it("侧栏极光背景不新增可聚焦或可访问的装饰节点", () => {
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    const sidebar = screen.getByTestId("morfra-sidebar");
    expect(sidebar.querySelectorAll("[aria-hidden='true']")).toHaveLength(0);
    expect(sidebar.querySelectorAll("[tabindex]")).toHaveLength(0);
  });

  it("标题栏新建表入口展开侧栏并进入既有命名流程", () => {
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    fireEvent.click(screen.getByRole("button", { name: "新建表" }));

    expect(screen.getByRole("textbox", { name: "新表名称" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "新表名称" })).toHaveAttribute("placeholder", "未命名表");
  });

  it("表操作菜单脱离侧栏滚动裁切，并支持键盘关闭后恢复焦点", async () => {
    useProjectStore.setState({
      projects: [{
        id: "project-1",
        name: "测试项目",
        sources: [],
        storageSnapshot: {
          manifest: { id: "project-1", name: "测试项目", formatVersion: 3, createdAt: "2026-08-12T00:00:00.000Z", updatedAt: "2026-08-12T00:00:00.000Z" },
          tables: [{ id: "table-1", name: "测试表", emoji: "📋", position: 0, titleFieldId: "field-1", recordCount: 0, views: [] }],
        },
      }],
    });
    render(<MorfraShell mainContent={<div>主表格</div>} />);
    const trigger = screen.getByRole("button", { name: "更多表操作 测试表" });
    trigger.getBoundingClientRect = () => ({ x: 200, y: 760, width: 24, height: 28, top: 760, right: 224, bottom: 788, left: 200, toJSON: () => ({}) });

    fireEvent.click(trigger);

    const menu = screen.getByRole("menu", { name: "测试表的表操作" });
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveClass("morfra-table-actions-menu");
    expect(menu.style.top).toBe("592px");
    expect(screen.getByRole("menuitem", { name: "重命名" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: /更换 Emoji/ })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu", { name: "测试表的表操作" })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("表操作菜单可以搜索并保存内置 Emoji", async () => {
    const updateTableEmoji = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({
      updateTableEmoji,
      projects: [{ id: "project-1", name: "测试项目", sources: [], storageSnapshot: {
        manifest: { id: "project-1", name: "测试项目", formatVersion: 3, createdAt: "2026-08-12T00:00:00.000Z", updatedAt: "2026-08-12T00:00:00.000Z" },
        tables: [{ id: "table-1", name: "测试表", emoji: "📋", position: 0, titleFieldId: "field-1", recordCount: 0, views: [] }],
      } }],
    });
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    fireEvent.click(screen.getByRole("button", { name: "更多表操作 测试表" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /更换 Emoji/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索 Emoji" }), { target: { value: "发布" } });
    fireEvent.click(screen.getByRole("gridcell", { name: "火箭" }));

    await waitFor(() => expect(updateTableEmoji).toHaveBeenCalledWith("table-1", "🚀"));
    await waitFor(() => expect(screen.queryByRole("menu", { name: "测试表的表操作" })).not.toBeInTheDocument());
  });

  it("点击表操作菜单外部会关闭菜单并恢复三点按钮焦点", async () => {
    useProjectStore.setState({
      projects: [{
        id: "project-1",
        name: "测试项目",
        sources: [],
        storageSnapshot: {
          manifest: { id: "project-1", name: "测试项目", formatVersion: 3, createdAt: "2026-08-12T00:00:00.000Z", updatedAt: "2026-08-12T00:00:00.000Z" },
          tables: [{ id: "table-1", name: "测试表", emoji: "📋", position: 0, titleFieldId: "field-1", recordCount: 0, views: [] }],
        },
      }],
    });
    render(<MorfraShell mainContent={<button type="button">菜单外部</button>} />);
    const trigger = screen.getByRole("button", { name: "更多表操作 测试表" });

    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole("button", { name: "菜单外部" }));

    await waitFor(() => expect(screen.queryByRole("menu", { name: "测试表的表操作" })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("表生命周期撤销只通过 Command+Z 触发且没有可见撤销按钮", async () => {
    const undoStorageChange = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({ canUndo: true, undoStorageChange });
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    expect(screen.queryByRole("button", { name: /撤销/ })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(undoStorageChange).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "z", metaKey: true });

    await waitFor(() => expect(undoStorageChange).toHaveBeenCalledOnce());
  });

  it("标题栏不重复承载文件或外观全局操作", () => {
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    expect(screen.queryByRole("button", { name: "文件" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /切换外观/ })).not.toBeInTheDocument();
  });

  it("AI 面板的设置事件在 Morfra 宿主打开可关闭的服务设置", async () => {
    useAIProviderStore.setState({ loaded: true, configs: [], secretStatus: {} });
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    window.dispatchEvent(new CustomEvent("open-ai-service-settings"));

    await waitFor(() => expect(screen.getByRole("dialog", { name: "应用设置" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "AI 服务" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getAllByRole("button", { name: "关闭应用设置" })[1]);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "应用设置" })).not.toBeInTheDocument());
  });

  it("AI 收起后完成生成在标题栏显示提示，重新打开后清除", async () => {
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    window.dispatchEvent(new CustomEvent("ai-generation-completed"));
    await waitFor(() => expect(screen.getByRole("status", { name: "AI 已完成" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "打开 AI 表格助手" }));

    await waitFor(() => expect(screen.queryByRole("status", { name: "AI 已完成" })).not.toBeInTheDocument());
  });

  it("AI 面板内部不渲染第二个关闭按钮", () => {
    useLayoutStore.setState({ hydrated: true, aiOpen: true, activeRightPanel: "ai" });
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    expect(screen.queryByRole("button", { name: "收起 AI 面板" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭 AI 表格助手" })).toBeInTheDocument();
  });
});
