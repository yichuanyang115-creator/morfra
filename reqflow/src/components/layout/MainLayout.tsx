import { type ReactNode } from "react";

type DetailMode = "expanded" | "collapsed" | "fullscreen";

interface MainLayoutProps {
  detailMode: DetailMode;
  boardContent: ReactNode;
  detailContent: ReactNode;
}

const GRID_TEMPLATE: Record<DetailMode, string> = {
  expanded: "var(--board-w) 6px 1fr",
  collapsed: "1fr 0 0",
  fullscreen: "0 0 1fr",
};

export function MainLayout({ detailMode, boardContent, detailContent }: MainLayoutProps) {
  const showResizer = detailMode === "expanded";

  return (
    <div
      className="grid min-h-0 flex-1 transition-[grid-template-columns] duration-180 ease-in-out"
      style={{ gridTemplateColumns: GRID_TEMPLATE[detailMode] }}
    >
      <main className="flex min-h-0 min-w-0 flex-col border-r border-(--border)">
        <div className="min-h-0 flex-1 overflow-y-auto">{boardContent}</div>
      </main>

      {showResizer && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="调整详情面板宽度"
          className="relative cursor-col-resize bg-(--border) transition-colors hover:bg-(--accent)"
        />
      )}
      {!showResizer && <div />}

      <aside
        className={`flex min-h-0 min-w-0 flex-col overflow-hidden bg-(--surface) ${
          detailMode === "expanded" ? "border-l border-(--border)" : ""
        }`}
      >
        <div
          className="flex h-full w-full min-h-0 flex-col"
          style={{ maxWidth: detailMode === "fullscreen" ? "100%" : "var(--detail-max-w)" }}
        >
          {detailContent}
        </div>
      </aside>
    </div>
  );
}
