import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { DetailMode } from "../../stores/uiStore";
import { useUiStore } from "../../stores/uiStore";
import { RESIZER_WIDTH, chatPanelWidth, clampBoardWidth } from "../../lib/boardWidth";
import { ChatPanel } from "../chat/ChatPanel";

interface MainLayoutProps {
  detailMode: DetailMode;
  boardContent: ReactNode;
  detailContent: ReactNode;
}

function gridTemplate(detailMode: DetailMode, boardWidth: number): string {
  switch (detailMode) {
    case "expanded":
      return `${boardWidth}px 6px 1fr`;
    case "collapsed":
      return "1fr 0 0";
    case "fullscreen":
      return "0 0 1fr";
  }
}

export function MainLayout({ detailMode, boardContent, detailContent }: MainLayoutProps) {
  const showResizer = detailMode === "expanded";
  const boardWidth = useUiStore((s) => s.boardWidth);
  const setBoardWidth = useUiStore((s) => s.setBoardWidth);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  // 拖拽期间关掉列宽过渡动画，否则每次 pointermove 更新目标宽度都会重新起一段
  // 180ms 缓动追赶，鼠标移动越快、宽度越跟不上手（对应原型 .app-body.resizing 处理）。
  const [isDragging, setIsDragging] = useState(false);

  // 视口尺寸变化会改变拖拽上限（比如窗口缩小），重新夹一遍当前宽度，
  // 避免"曾经合法、现在超界"的宽度飘着不生效（对应原型 window resize 处理）。
  useEffect(() => {
    function handleResize() {
      setBoardWidth(useUiStore.getState().boardWidth, window.innerWidth);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setBoardWidth]);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragStateRef.current = { startX: e.clientX, startWidth: boardWidth };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  // 拖拽过程中鼠标可能扫过其它文字，锁住全局选中行为，避免拖着拖着突然选中一片文字。
  useEffect(() => {
    if (!isDragging) return;
    document.body.classList.add("resizing-panel");
    return () => document.body.classList.remove("resizing-panel");
  }, [isDragging]);

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;
    if (!drag) return;
    const deltaX = e.clientX - drag.startX;
    setBoardWidth(drag.startWidth + deltaX, window.innerWidth);
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  const clampedBoardWidth = clampBoardWidth(boardWidth, window.innerWidth);
  // 详情面板的实际像素宽度：expanded 态 = 视口 - 看板 - 分隔条；fullscreen 态占满视口；
  // collapsed 态为 0（对话框此时也不显示，见下方 detailPanelWidth === 0 判断）。
  const detailPanelWidth =
    detailMode === "collapsed" ? 0 : detailMode === "fullscreen" ? window.innerWidth : window.innerWidth - clampedBoardWidth - RESIZER_WIDTH;
  const chatWidth = detailPanelWidth === 0 ? null : chatPanelWidth(detailPanelWidth);

  return (
    <div
      className={`grid min-h-0 flex-1 ${isDragging ? "" : "transition-[grid-template-columns] duration-180 ease-in-out"}`}
      style={{ gridTemplateColumns: gridTemplate(detailMode, clampedBoardWidth) }}
    >
      <main className="flex min-h-0 min-w-0 flex-col border-r border-(--border)">
        <div className="min-h-0 flex-1 overflow-y-auto">{boardContent}</div>
      </main>

      {showResizer && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="调整详情面板宽度"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative cursor-col-resize bg-(--border) transition-colors hover:bg-(--accent) active:bg-(--accent)"
        />
      )}
      {!showResizer && <div />}

      <aside
        className={`flex min-h-0 min-w-0 flex-row overflow-hidden bg-(--surface) ${
          detailMode === "expanded" ? "border-l border-(--border)" : ""
        }`}
      >
        <div
          className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
          style={{ maxWidth: detailMode === "fullscreen" ? "100%" : "var(--detail-max-w)" }}
        >
          {detailContent}
        </div>
        <ChatPanel width={chatWidth} />
      </aside>
    </div>
  );
}
