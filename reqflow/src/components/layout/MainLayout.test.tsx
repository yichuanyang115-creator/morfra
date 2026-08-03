import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MainLayout } from "./MainLayout";
import { useUiStore } from "../../stores/uiStore";
import { useChatStore } from "../../stores/chatStore";
import {
  BOARD_DEFAULT_WIDTH,
  BOARD_MIN_WIDTH,
  CHAT_DEFAULT_WIDTH,
  CHAT_MIN_WIDTH,
  RESIZER_WIDTH,
  clampBoardWidth,
} from "../../lib/boardWidth";

// 拖拽对话框分隔条会触发 chatStore.setWidth 落盘（fire-and-forget），需要 mock 掉底层
// 文件系统调用，否则测试环境里真实的 @tauri-apps invoke 会抛出未处理的 rejection。
vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => ""),
  writeTextFile: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: vi.fn(async () => "/app-local-data"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

const CHAT_INPUT_PLACEHOLDER = "输入消息，回车发送…";
const BOARD_RESIZER_LABEL = "调整详情面板宽度";
const CHAT_RESIZER_LABEL = "调整对话框宽度";

// 用一个明显宽于 BOARD_DEFAULT_WIDTH + 分隔条 + DETAIL_MIN_WIDTH（821+6+480=1307）的视口，
// 而不是应用默认窗口宽度 1280（tauri.conf.json app.windows[0].width）——480px 详情面板
// 底线（REQ-003 v2.8）已经比默认窗口更宽，用默认窗口宽度测"正常拖拽"会恰好撞上收窄
// 边界，不能反映"空间充足时"的行为，改用一个宽松视口专测拖拽本身的联动关系。
const WIDE_TEST_VIEWPORT = 1600;

describe("MainLayout（AC-005/006：详情面板三态布局联动，REQ-003 分隔条拖拽调宽）", () => {
  beforeEach(() => {
    useUiStore.setState({ boardWidth: BOARD_DEFAULT_WIDTH });
    useChatStore.setState({ open: false, width: CHAT_DEFAULT_WIDTH, messages: [], thinking: false, loadedProjectId: "proj-1" });
    vi.stubGlobal("innerWidth", WIDE_TEST_VIEWPORT);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("expanded：主内容区与详情面板并排展示，分隔条可见", () => {
    render(
      <MainLayout
        detailMode="expanded"
        boardContent={<div>看板内容</div>}
        detailContent={() => <div>详情内容</div>}
      />,
    );

    expect(screen.getByText("看板内容")).toBeInTheDocument();
    expect(screen.getByText("详情内容")).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: BOARD_RESIZER_LABEL })).toBeInTheDocument();
  });

  it("closed：详情面板宽度归零，看板分隔条不渲染，主内容区仍可见（AC-006：收起后主内容区撑满）", () => {
    render(
      <MainLayout
        detailMode="closed"
        boardContent={<div>看板内容</div>}
        detailContent={() => <div>详情内容</div>}
      />,
    );

    expect(screen.getByText("看板内容")).toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: BOARD_RESIZER_LABEL })).not.toBeInTheDocument();
  });

  it("fullscreen：主内容区宽度归零，详情面板占满主内容区位置（AC-005：全屏详情占满主内容区）", () => {
    const { container } = render(
      <MainLayout
        detailMode="fullscreen"
        boardContent={<div>看板内容</div>}
        detailContent={() => <div>详情内容</div>}
      />,
    );

    expect(screen.getByText("详情内容")).toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: BOARD_RESIZER_LABEL })).not.toBeInTheDocument();

    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("0 0 1fr 0px 0px");
  });

  it("三态的 gridTemplateColumns 各不相同，联动关系可回归（对话框关闭时最后两列恒为 0）", () => {
    const { container: expandedContainer } = render(
      <MainLayout detailMode="expanded" boardContent={<div />} detailContent={() => <div />} />,
    );
    const { container: closedContainer } = render(
      <MainLayout detailMode="closed" boardContent={<div />} detailContent={() => <div />} />,
    );

    const expandedGrid = expandedContainer.firstElementChild as HTMLElement;
    const closedGrid = closedContainer.firstElementChild as HTMLElement;

    expect(expandedGrid.style.gridTemplateColumns).toBe(`${BOARD_DEFAULT_WIDTH}px 6px 1fr 0px 0px`);
    expect(closedGrid.style.gridTemplateColumns).toBe("1fr 0 0 0px 0px");
  });

  it("拖动分隔条：向右拖动增加看板宽度，向左拖动减少看板宽度（REQ-003 MUST 分隔条支持拖拽调整详情面板宽度）", () => {
    useUiStore.setState({ boardWidth: BOARD_DEFAULT_WIDTH - 100 });
    const { container } = render(
      <MainLayout detailMode="expanded" boardContent={<div />} detailContent={() => <div />} />,
    );
    const resizer = screen.getByRole("separator", { name: BOARD_RESIZER_LABEL });
    const grid = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(resizer, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: 560, pointerId: 1 });

    expect(grid.style.gridTemplateColumns).toBe(`${BOARD_DEFAULT_WIDTH - 40}px 6px 1fr 0px 0px`);

    fireEvent.pointerUp(resizer, { clientX: 560, pointerId: 1 });
  });

  it("拖动超过下限时宽度夹到 BOARD_MIN_WIDTH，不会继续变窄", () => {
    const { container } = render(
      <MainLayout detailMode="expanded" boardContent={<div />} detailContent={() => <div />} />,
    );
    const resizer = screen.getByRole("separator", { name: BOARD_RESIZER_LABEL });
    const grid = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(resizer, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: -1000, pointerId: 1 });

    expect(grid.style.gridTemplateColumns).toBe(`${BOARD_MIN_WIDTH}px 6px 1fr 0px 0px`);
  });

  it("松手（pointerup）后再移动鼠标不再改变宽度，拖拽状态已结束", () => {
    useUiStore.setState({ boardWidth: BOARD_DEFAULT_WIDTH - 100 });
    const { container } = render(
      <MainLayout detailMode="expanded" boardContent={<div />} detailContent={() => <div />} />,
    );
    const resizer = screen.getByRole("separator", { name: BOARD_RESIZER_LABEL });
    const grid = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(resizer, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: 560, pointerId: 1 });
    fireEvent.pointerUp(resizer, { clientX: 560, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: 900, pointerId: 1 });

    expect(grid.style.gridTemplateColumns).toBe(`${BOARD_DEFAULT_WIDTH - 40}px 6px 1fr 0px 0px`);
  });

  it("closed/fullscreen 态下看板分隔条不渲染，无法拖拽调宽", () => {
    render(<MainLayout detailMode="fullscreen" boardContent={<div />} detailContent={() => <div />} />);
    expect(screen.queryByRole("separator", { name: BOARD_RESIZER_LABEL })).not.toBeInTheDocument();
  });

  it("从默认宽度继续向右拖动不会超过 BOARD_DEFAULT_WIDTH，避免看板内容已到上限后中间露出无意义空白", () => {
    const { container } = render(
      <MainLayout detailMode="expanded" boardContent={<div />} detailContent={() => <div />} />,
    );
    const resizer = screen.getByRole("separator", { name: BOARD_RESIZER_LABEL });
    const grid = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(resizer, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: 700, pointerId: 1 });

    expect(grid.style.gridTemplateColumns).toBe(`${BOARD_DEFAULT_WIDTH}px 6px 1fr 0px 0px`);
  });

  it("detailContent 收到的 width 参数与 MainLayout 自己算出的详情面板宽度一致（回归：REQ-003 v2.8 详情面板收缩 bug——此前 DetailPanel 用 ResizeObserver 自己反推宽度，量测链路不可靠，改为 MainLayout 直接传确切值）", () => {
    const viewport = WIDE_TEST_VIEWPORT;
    const board = BOARD_DEFAULT_WIDTH;
    const expectedWidth = viewport - clampBoardWidth(board, viewport) - RESIZER_WIDTH;

    let receivedWidth: number | null = null;
    render(
      <MainLayout
        detailMode="expanded"
        boardContent={<div />}
        detailContent={(width) => {
          receivedWidth = width;
          return <div>详情</div>;
        }}
      />,
    );

    expect(receivedWidth).toBe(expectedWidth);
  });

  it("看板拖窄后，detailContent 收到的 width 参数跟着联动变化，不是渲染时定死的一次性值", () => {
    useUiStore.setState({ boardWidth: BOARD_DEFAULT_WIDTH - 100 });
    let receivedWidth: number | null = null;

    render(
      <MainLayout
        detailMode="expanded"
        boardContent={<div />}
        detailContent={(width) => {
          receivedWidth = width;
          return <div>详情</div>;
        }}
      />,
    );

    const widthBeforeDrag = receivedWidth;
    const resizer = screen.getByRole("separator", { name: BOARD_RESIZER_LABEL });
    fireEvent.pointerDown(resizer, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: 560, pointerId: 1 });

    expect(receivedWidth).not.toBe(widthBeforeDrag);
    expect(receivedWidth).toBe((widthBeforeDrag ?? 0) - 60);
  });
});

describe("MainLayout 对话框独立第三栏（REQ-003 / REQ-024 v2.8：显隐与详情面板状态完全解耦）", () => {
  beforeEach(() => {
    useUiStore.setState({ boardWidth: BOARD_DEFAULT_WIDTH });
    useChatStore.setState({ open: false, width: CHAT_DEFAULT_WIDTH, messages: [], thinking: false, loadedProjectId: "proj-1" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("开关关闭时不渲染对话框，即使空间充足", () => {
    vi.stubGlobal("innerWidth", 2000);
    render(<MainLayout detailMode="expanded" boardContent={<div />} detailContent={() => <div />} />);

    expect(screen.queryByPlaceholderText(CHAT_INPUT_PLACEHOLDER)).not.toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: CHAT_RESIZER_LABEL })).not.toBeInTheDocument();
  });

  it("开关打开且视口足够宽时，对话框作为独立栏位渲染，带自己的分隔条", () => {
    vi.stubGlobal("innerWidth", 2000);
    useChatStore.setState({ open: true });

    render(<MainLayout detailMode="expanded" boardContent={<div />} detailContent={() => <div />} />);

    expect(screen.getByPlaceholderText(CHAT_INPUT_PLACEHOLDER)).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: CHAT_RESIZER_LABEL })).toBeInTheDocument();
  });

  it("详情面板收起（0 宽度）时，对话框仍按自己的开关状态独立显示，不因面板收起而被强制隐藏（v2.7 规则已被 v2.8 推翻）", () => {
    vi.stubGlobal("innerWidth", 2000);
    useChatStore.setState({ open: true });

    render(<MainLayout detailMode="closed" boardContent={<div />} detailContent={() => <div />} />);

    expect(screen.getByPlaceholderText(CHAT_INPUT_PLACEHOLDER)).toBeInTheDocument();
  });

  it("全屏态下对话框仍按开关状态独立显示在详情右侧", () => {
    vi.stubGlobal("innerWidth", 2000);
    useChatStore.setState({ open: true });

    render(<MainLayout detailMode="fullscreen" boardContent={<div />} detailContent={() => <div />} />);

    expect(screen.getByPlaceholderText(CHAT_INPUT_PLACEHOLDER)).toBeInTheDocument();
  });

  it("拖动对话框分隔条：向左拖动（远离对话框）增加宽度，向右拖动减少宽度", () => {
    vi.stubGlobal("innerWidth", 2000);
    useChatStore.setState({ open: true, width: CHAT_DEFAULT_WIDTH });

    const { container } = render(<MainLayout detailMode="expanded" boardContent={<div />} detailContent={() => <div />} />);
    const resizer = screen.getByRole("separator", { name: CHAT_RESIZER_LABEL });
    const grid = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(resizer, { clientX: 1000, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: 940, pointerId: 1 });
    fireEvent.pointerUp(resizer, { clientX: 940, pointerId: 1 });

    expect(grid.style.gridTemplateColumns).toContain(`${CHAT_DEFAULT_WIDTH + 60}px`);
  });

  it("对话框拖到比 240 还窄时夹到 CHAT_MIN_WIDTH", () => {
    vi.stubGlobal("innerWidth", 2000);
    useChatStore.setState({ open: true, width: CHAT_DEFAULT_WIDTH });

    const { container } = render(<MainLayout detailMode="expanded" boardContent={<div />} detailContent={() => <div />} />);
    const resizer = screen.getByRole("separator", { name: CHAT_RESIZER_LABEL });
    const grid = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(resizer, { clientX: 1000, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: 3000, pointerId: 1 });

    expect(grid.style.gridTemplateColumns).toContain(`${CHAT_MIN_WIDTH}px`);
  });

  it("对话框拖宽超过上限时夹住，详情面板保持在 480px 底线不再被继续挤窄", () => {
    vi.stubGlobal("innerWidth", 1600);
    useChatStore.setState({ open: true, width: CHAT_DEFAULT_WIDTH });

    const { container } = render(<MainLayout detailMode="expanded" boardContent={<div />} detailContent={() => <div />} />);
    const resizer = screen.getByRole("separator", { name: CHAT_RESIZER_LABEL });
    const grid = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(resizer, { clientX: 1000, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: -5000, pointerId: 1 });

    // 1600 视口、看板 821（clamp 后）、详情底线 480、两条分隔条各 6px
    // → 对话框上限 = 1600 - (821+6) - 480 - 6 = 287
    expect(grid.style.gridTemplateColumns).toContain("287px");
  });

  it("切换需求（detailContent 变化）不重新挂载对话框，已有对话内容保留——挂载点在 MainLayout 层而非 detailContent 内部", () => {
    vi.stubGlobal("innerWidth", 2000);
    useChatStore.setState({ open: true, messages: [{ id: "m1", role: "user", content: "已有对话" }] });

    const { rerender } = render(
      <MainLayout detailMode="expanded" boardContent={<div />} detailContent={() => <div>需求 A 详情</div>} />,
    );
    expect(screen.getByText("已有对话")).toBeInTheDocument();

    rerender(<MainLayout detailMode="expanded" boardContent={<div />} detailContent={() => <div>需求 B 详情</div>} />);

    expect(screen.getByText("需求 B 详情")).toBeInTheDocument();
    expect(screen.getByText("已有对话")).toBeInTheDocument();
  });
});
