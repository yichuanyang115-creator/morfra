import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { DetailMode } from "../../stores/uiStore";
import { useUiStore } from "../../stores/uiStore";
import { useChatStore } from "../../stores/chatStore";
import {
  RESIZER_WIDTH,
  chatOccupiedWidth,
  clampBoardWidth,
  clampChatWidth,
  detailPanelWidthFor,
} from "../../lib/boardWidth";
import { ChatPanel } from "../chat/ChatPanel";

interface MainLayoutProps {
  detailMode: DetailMode;
  boardContent: ReactNode;
  /**
   * 详情面板内容用 render-prop 而非直接传 ReactNode：MainLayout 是详情面板宽度
   * （detailPanelWidthFor）唯一的计算源头，父组件（App.tsx）不该在别处重新算一遍
   * 同样的宽度——那样两处逻辑各算一份，以后改一处忘了改另一处就会跑偏。
   */
  detailContent: (width: number) => ReactNode;
}

/**
 * 五轨道 grid：看板 | 分隔条1 | 详情面板 | 分隔条2 | 对话框。看板和详情面板用固定像素
 * 值 + "1fr" 二者之一分配，对话框和它的分隔条固定像素值（关闭时为 0）——由 grid 自动
 * 把 1fr 的那一列撑成"总宽度减去所有固定列"，天然等价于 detailPanelWidthFor / 看板
 * 撑满剩余空间的计算，不用另外在 grid 层重复算一遍。
 */
function gridTemplate(detailMode: DetailMode, boardWidth: number, chatWidth: number): string {
  const chatResizer = chatWidth > 0 ? RESIZER_WIDTH : 0;
  switch (detailMode) {
    case "expanded":
      return `${boardWidth}px ${RESIZER_WIDTH}px 1fr ${chatResizer}px ${chatWidth}px`;
    case "closed":
      return `1fr 0 0 ${chatResizer}px ${chatWidth}px`;
    case "fullscreen":
      return `0 0 1fr ${chatResizer}px ${chatWidth}px`;
  }
}

export function MainLayout({ detailMode, boardContent, detailContent }: MainLayoutProps) {
  const showBoardResizer = detailMode === "expanded";
  const boardWidth = useUiStore((s) => s.boardWidth);
  const setBoardWidth = useUiStore((s) => s.setBoardWidth);
  const chatOpen = useChatStore((s) => s.open);
  const chatStoredWidth = useChatStore((s) => s.width);
  const setChatWidth = useChatStore((s) => s.setWidth);
  const boardDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const chatDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  // 拖拽期间关掉列宽过渡动画，否则每次 pointermove 更新目标宽度都会重新起一段
  // 180ms 缓动追赶，鼠标移动越快、宽度越跟不上手（对应原型 .app-body.resizing 处理）。
  const [isDragging, setIsDragging] = useState(false);

  const clampedBoardWidth = clampBoardWidth(boardWidth, window.innerWidth);
  const clampedChatWidth = chatOpen
    ? clampChatWidth(chatStoredWidth, detailMode, boardWidth, window.innerWidth)
    : 0;
  const chatOccupied = chatOccupiedWidth(chatOpen, chatStoredWidth, detailMode, boardWidth, window.innerWidth);
  const detailPanelWidth = detailPanelWidthFor(detailMode, boardWidth, window.innerWidth, chatOccupied);

  // 视口尺寸变化会改变拖拽上限（比如窗口缩小），重新夹一遍当前宽度，
  // 避免"曾经合法、现在超界"的宽度飘着不生效（对应原型 window resize 处理）。
  useEffect(() => {
    function handleResize() {
      setBoardWidth(useUiStore.getState().boardWidth, window.innerWidth);
      const chat = useChatStore.getState();
      if (chat.open) {
        const reclamped = clampChatWidth(chat.width, detailMode, useUiStore.getState().boardWidth, window.innerWidth);
        if (reclamped !== chat.width) void setChatWidth(reclamped);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setBoardWidth, setChatWidth, detailMode]);

  // 拖拽过程中鼠标可能扫过其它文字，锁住全局选中行为，避免拖着拖着突然选中一片文字。
  useEffect(() => {
    if (!isDragging) return;
    document.body.classList.add("resizing-panel");
    return () => document.body.classList.remove("resizing-panel");
  }, [isDragging]);

  function handleBoardPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    boardDragRef.current = { startX: e.clientX, startWidth: boardWidth };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleBoardPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = boardDragRef.current;
    if (!drag) return;
    const deltaX = e.clientX - drag.startX;
    setBoardWidth(drag.startWidth + deltaX, window.innerWidth);
  }

  function handleBoardPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!boardDragRef.current) return;
    boardDragRef.current = null;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  // 对话框往右拖分隔条应该变窄（分隔条在对话框左侧），符号与看板分隔条相反。
  function handleChatPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    chatDragRef.current = { startX: e.clientX, startWidth: chatStoredWidth };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleChatPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = chatDragRef.current;
    if (!drag) return;
    const deltaX = drag.startX - e.clientX;
    void setChatWidth(clampChatWidth(drag.startWidth + deltaX, detailMode, boardWidth, window.innerWidth));
  }

  function handleChatPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!chatDragRef.current) return;
    chatDragRef.current = null;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <div
      className={`grid min-h-0 flex-1 ${isDragging ? "" : "transition-[grid-template-columns] duration-180 ease-in-out"}`}
      style={{ gridTemplateColumns: gridTemplate(detailMode, clampedBoardWidth, clampedChatWidth) }}
    >
      <main className="flex min-h-0 min-w-0 flex-col border-r border-(--border) bg-(--surface)">
        <div className="min-h-0 flex-1 overflow-y-auto">{boardContent}</div>
      </main>

      {showBoardResizer ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="调整详情面板宽度"
          onPointerDown={handleBoardPointerDown}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={handleBoardPointerUp}
          className="relative cursor-col-resize bg-(--border) transition-colors hover:bg-(--accent) active:bg-(--accent)"
        />
      ) : (
        <div />
      )}

      <aside
        className={`flex min-h-0 min-w-0 flex-col overflow-hidden bg-(--surface) ${
          detailMode === "expanded" ? "shadow-[-4px_0_16px_-4px_rgba(60,50,30,0.12)]" : ""
        }`}
      >
        <div
          className="mx-auto flex h-full min-h-0 w-full min-w-0 flex-col"
          style={{ maxWidth: detailPanelWidth > 0 ? "var(--detail-max-w)" : undefined }}
        >
          {detailContent(detailPanelWidth)}
        </div>
      </aside>

      {clampedChatWidth > 0 ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="调整对话框宽度"
          onPointerDown={handleChatPointerDown}
          onPointerMove={handleChatPointerMove}
          onPointerUp={handleChatPointerUp}
          className="relative cursor-col-resize bg-(--border) transition-colors hover:bg-(--accent) active:bg-(--accent)"
        />
      ) : (
        <div />
      )}

      <ChatPanel width={clampedChatWidth > 0 ? clampedChatWidth : null} />
    </div>
  );
}
