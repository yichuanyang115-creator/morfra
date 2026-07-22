import { useEffect, useState } from "react";
import { Topbar } from "./components/topbar/Topbar";
import { MainLayout } from "./components/layout/MainLayout";
import { useProjectStore } from "./stores/projectStore";

function App() {
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const init = useProjectStore((s) => s.init);
  const loaded = useProjectStore((s) => s.loaded);

  useEffect(() => {
    void init();
  }, [init]);

  if (!loaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-(--muted) text-[13px]">
        加载中…
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col">
      <Topbar detailCollapsed={detailCollapsed} onTogglePanel={() => setDetailCollapsed((v) => !v)} />
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
