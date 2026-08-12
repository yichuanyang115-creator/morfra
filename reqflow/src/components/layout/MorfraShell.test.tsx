import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
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

  it("提供 Morfra 标题栏、固定导航和主显示区", () => {
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    expect(screen.getByTestId("morfra-titlebar")).toBeInTheDocument();
    expect(screen.getByText("morfra")).toBeInTheDocument();
    expect(screen.getAllByText("测试项目")).toHaveLength(2);
    expect(screen.getByTestId("morfra-sidebar")).toBeInTheDocument();
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

  it("详情已打开时，标题栏 AI 入口会切换到 AI 内容而不是继续显示详情", async () => {
    useLayoutStore.setState({ detailOpen: true });
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    fireEvent.click(screen.getByRole("button", { name: "打开 AI 表格助手" }));

    await waitFor(() => expect(screen.getByLabelText("AI 表格助手")).toBeInTheDocument());
    expect(screen.queryByRole("tab", { name: "详情" })).not.toBeInTheDocument();
  });

  it("窄窗口导航入口打开临时浮层，选择项目后关闭", async () => {
    setViewport(1199, 800);
    render(<MorfraShell mainContent={<div>主表格</div>} />);

    fireEvent.click(screen.getByRole("button", { name: "展开导航" }));
    expect(screen.getByRole("button", { name: "关闭项目导航" })).toBeInTheDocument();

    const projectButtons = screen.getAllByRole("button", { name: "测试项目" });
    fireEvent.click(projectButtons[projectButtons.length - 1]);
    await waitFor(() => expect(screen.queryByRole("button", { name: "关闭项目导航" })).not.toBeInTheDocument());
  });

  it("窄窗口折叠轨道隐藏项目包长文案，导航浮层重新显示", () => {
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

    const scope = screen.getByText("Morfra 本地项目包");
    expect(scope).toHaveClass("morfra-sidebar-scope");
    expect(container.querySelector(".morfra-sidebar-overlay-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开导航" }));
    expect(container.querySelector(".morfra-sidebar-overlay-panel .morfra-sidebar-scope")).toHaveTextContent("Morfra 本地项目包");
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
