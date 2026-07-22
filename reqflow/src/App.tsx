import { useState } from "react";
import { Topbar } from "./components/topbar/Topbar";
import { MainLayout } from "./components/layout/MainLayout";

function App() {
  const [detailCollapsed, setDetailCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-screen flex-col">
      <Topbar
        projectName="项目"
        detailCollapsed={detailCollapsed}
        onTogglePanel={() => setDetailCollapsed((v) => !v)}
      />
      <MainLayout
        detailMode={detailCollapsed ? "collapsed" : "expanded"}
        boardContent={
          <div className="flex h-full items-center justify-center text-(--muted) text-[13px]">
            看板将在下个 Phase 实现
          </div>
        }
        detailContent={
          <div className="flex h-full items-center justify-center text-(--muted) text-[13px]">
            需求详情将在后续 Phase 实现
          </div>
        }
      />
    </div>
  );
}

export default App;
