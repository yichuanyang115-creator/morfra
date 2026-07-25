import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MainLayout } from "./MainLayout";
import { useUiStore } from "../../stores/uiStore";
import { useChatStore } from "../../stores/chatStore";
import { BOARD_DEFAULT_WIDTH, BOARD_MIN_WIDTH } from "../../lib/boardWidth";

const CHAT_INPUT_PLACEHOLDER = "输入消息，回车发送…";

// 应用窗口默认宽度 1280（tauri.conf.json app.windows[0].width），比 jsdom 默认的
// 1024 宽出不少——用真实默认值，而不是 jsdom 偶然给的 innerWidth，避免测试恰好卡在
// clampBoardWidth 的收窄边界上（BOARD_DEFAULT_WIDTH + 分隔条 + DETAIL_MIN_WIDTH = 1187）。
const APP_DEFAULT_WINDOW_WIDTH = 1280;

describe("MainLayout（AC-005/006：详情面板三态布局联动，REQ-003 分隔条拖拽调宽）", () => {
  beforeEach(() => {
    useUiStore.setState({ boardWidth: BOARD_DEFAULT_WIDTH });
    useChatStore.setState({ messages: [], thinking: false });
    vi.stubGlobal("innerWidth", APP_DEFAULT_WINDOW_WIDTH);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("expanded：主内容区与详情面板并排展示，分隔条可见", () => {
    render(
      <MainLayout
        detailMode="expanded"
        boardContent={<div>看板内容</div>}
        detailContent={<div>详情内容</div>}
      />,
    );

    expect(screen.getByText("看板内容")).toBeInTheDocument();
    expect(screen.getByText("详情内容")).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "调整详情面板宽度" })).toBeInTheDocument();
  });

  it("collapsed：详情面板宽度归零，分隔条不渲染，主内容区仍可见（AC-006：收起后主内容区撑满）", () => {
    render(
      <MainLayout
        detailMode="collapsed"
        boardContent={<div>看板内容</div>}
        detailContent={<div>详情内容</div>}
      />,
    );

    expect(screen.getByText("看板内容")).toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: "调整详情面板宽度" })).not.toBeInTheDocument();
  });

  it("fullscreen：主内容区宽度归零，详情面板占满主内容区位置（AC-005：全屏详情占满主内容区）", () => {
    const { container } = render(
      <MainLayout
        detailMode="fullscreen"
        boardContent={<div>看板内容</div>}
        detailContent={<div>详情内容</div>}
      />,
    );

    expect(screen.getByText("详情内容")).toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: "调整详情面板宽度" })).not.toBeInTheDocument();

    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("0 0 1fr");
  });

  it("三态的 gridTemplateColumns 各不相同，联动关系可回归", () => {
    const { container: expandedContainer } = render(
      <MainLayout detailMode="expanded" boardContent={<div />} detailContent={<div />} />,
    );
    const { container: collapsedContainer } = render(
      <MainLayout detailMode="collapsed" boardContent={<div />} detailContent={<div />} />,
    );

    const expandedGrid = expandedContainer.firstElementChild as HTMLElement;
    const collapsedGrid = collapsedContainer.firstElementChild as HTMLElement;

    expect(expandedGrid.style.gridTemplateColumns).toBe(`${BOARD_DEFAULT_WIDTH}px 6px 1fr`);
    expect(collapsedGrid.style.gridTemplateColumns).toBe("1fr 0 0");
  });

  it("拖动分隔条：向右拖动增加看板宽度，向左拖动减少看板宽度（REQ-003 MUST 分隔条支持拖拽调整详情面板宽度）", () => {
    useUiStore.setState({ boardWidth: BOARD_DEFAULT_WIDTH - 100 });
    const { container } = render(
      <MainLayout detailMode="expanded" boardContent={<div />} detailContent={<div />} />,
    );
    const resizer = screen.getByRole("separator", { name: "调整详情面板宽度" });
    const grid = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(resizer, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: 560, pointerId: 1 });

    expect(grid.style.gridTemplateColumns).toBe(`${BOARD_DEFAULT_WIDTH - 40}px 6px 1fr`);

    fireEvent.pointerUp(resizer, { clientX: 560, pointerId: 1 });
  });

  it("拖动超过下限时宽度夹到 BOARD_MIN_WIDTH，不会继续变窄", () => {
    const { container } = render(
      <MainLayout detailMode="expanded" boardContent={<div />} detailContent={<div />} />,
    );
    const resizer = screen.getByRole("separator", { name: "调整详情面板宽度" });
    const grid = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(resizer, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: -1000, pointerId: 1 });

    expect(grid.style.gridTemplateColumns).toBe(`${BOARD_MIN_WIDTH}px 6px 1fr`);
  });

  it("松手（pointerup）后再移动鼠标不再改变宽度，拖拽状态已结束", () => {
    useUiStore.setState({ boardWidth: BOARD_DEFAULT_WIDTH - 100 });
    const { container } = render(
      <MainLayout detailMode="expanded" boardContent={<div />} detailContent={<div />} />,
    );
    const resizer = screen.getByRole("separator", { name: "调整详情面板宽度" });
    const grid = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(resizer, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: 560, pointerId: 1 });
    fireEvent.pointerUp(resizer, { clientX: 560, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: 900, pointerId: 1 });

    expect(grid.style.gridTemplateColumns).toBe(`${BOARD_DEFAULT_WIDTH - 40}px 6px 1fr`);
  });

  it("collapsed/fullscreen 态下分隔条不渲染，无法拖拽调宽", () => {
    render(<MainLayout detailMode="fullscreen" boardContent={<div />} detailContent={<div />} />);
    expect(screen.queryByRole("separator", { name: "调整详情面板宽度" })).not.toBeInTheDocument();
  });

  it("从默认宽度继续向右拖动不会超过 BOARD_DEFAULT_WIDTH，避免看板内容已到上限后中间露出无意义空白", () => {
    const { container } = render(
      <MainLayout detailMode="expanded" boardContent={<div />} detailContent={<div />} />,
    );
    const resizer = screen.getByRole("separator", { name: "调整详情面板宽度" });
    const grid = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(resizer, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: 700, pointerId: 1 });

    expect(grid.style.gridTemplateColumns).toBe(`${BOARD_DEFAULT_WIDTH}px 6px 1fr`);
  });
});

describe("MainLayout 详情面板对话框接入（REQ-024）", () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], thinking: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("视口宽度不足时（默认看板宽度下详情面板剩余空间 <280px），对话框不渲染", () => {
    vi.stubGlobal("innerWidth", 1280);
    useUiStore.setState({ boardWidth: BOARD_DEFAULT_WIDTH });

    render(<MainLayout detailMode="expanded" boardContent={<div />} detailContent={<div />} />);

    expect(screen.queryByPlaceholderText(CHAT_INPUT_PLACEHOLDER)).not.toBeInTheDocument();
  });

  it("视口足够宽、详情面板剩余空间 ≥280px 时，对话框渲染出来", () => {
    // 视口 2000、看板 821、分隔条 6 → 详情面板 1173，减去内容限宽 660 = 513 ≥ 280
    vi.stubGlobal("innerWidth", 2000);
    useUiStore.setState({ boardWidth: BOARD_DEFAULT_WIDTH });

    render(<MainLayout detailMode="expanded" boardContent={<div />} detailContent={<div />} />);

    expect(screen.getByPlaceholderText(CHAT_INPUT_PLACEHOLDER)).toBeInTheDocument();
  });

  it("详情面板收起（0 宽度）时对话框一并隐藏，即使视口很宽", () => {
    vi.stubGlobal("innerWidth", 2000);

    render(<MainLayout detailMode="collapsed" boardContent={<div />} detailContent={<div />} />);

    expect(screen.queryByPlaceholderText(CHAT_INPUT_PLACEHOLDER)).not.toBeInTheDocument();
  });

  it("全屏态下面板占满视口，剩余空间够时对话框按同一规则显示", () => {
    // 全屏详情面板宽度 = 视口 1200，减去内容限宽 660 = 540 ≥ 280
    vi.stubGlobal("innerWidth", 1200);

    render(<MainLayout detailMode="fullscreen" boardContent={<div />} detailContent={<div />} />);

    expect(screen.getByPlaceholderText(CHAT_INPUT_PLACEHOLDER)).toBeInTheDocument();
  });

  it("全屏态下视口不够宽时，对话框同样隐藏（跟展开态判断规则一致）", () => {
    // 全屏详情面板宽度 = 视口 900，减去内容限宽 660 = 240 < 280
    vi.stubGlobal("innerWidth", 900);

    render(<MainLayout detailMode="fullscreen" boardContent={<div />} detailContent={<div />} />);

    expect(screen.queryByPlaceholderText(CHAT_INPUT_PLACEHOLDER)).not.toBeInTheDocument();
  });

  it("切换需求（detailContent 变化）不重新挂载对话框，已有对话内容保留——挂载点在 MainLayout 层而非 detailContent 内部", () => {
    vi.stubGlobal("innerWidth", 2000);
    useUiStore.setState({ boardWidth: BOARD_DEFAULT_WIDTH });
    useChatStore.setState({ messages: [{ id: "m1", role: "user", content: "已有对话" }] });

    const { rerender } = render(
      <MainLayout detailMode="expanded" boardContent={<div />} detailContent={<div>需求 A 详情</div>} />,
    );
    expect(screen.getByText("已有对话")).toBeInTheDocument();

    rerender(<MainLayout detailMode="expanded" boardContent={<div />} detailContent={<div>需求 B 详情</div>} />);

    expect(screen.getByText("需求 B 详情")).toBeInTheDocument();
    expect(screen.getByText("已有对话")).toBeInTheDocument();
  });
});
