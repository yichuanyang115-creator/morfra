import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { useChatStore } from "./stores/chatStore";
import { useProjectStore } from "./stores/projectStore";
import { useRequirementStore } from "./stores/requirementStore";
import { useSchemaStore } from "./stores/schemaStore";
import { useThemeStore } from "./stores/themeStore";

const loadTheme = vi.fn();
const acknowledgeRecovery = vi.fn();
const initProjects = vi.fn();

function setReadyAppState(): void {
  useProjectStore.setState({
    projects: [{ id: "project-1", name: "测试项目", sources: [] }],
    currentProjectId: "project-1",
    loaded: true,
    error: false,
    init: initProjects,
  });
  useRequirementStore.setState({ requirements: [], loading: false, error: false, loadedProjectId: "project-1" });
  useSchemaStore.setState({ schema: null, loadedProjectId: "project-1", justMigrated: false });
  useChatStore.setState({ loadedProjectId: "project-1" });
}

describe("App 主题启动门", () => {
  beforeEach(() => {
    loadTheme.mockReset();
    acknowledgeRecovery.mockReset();
    initProjects.mockReset();
    setReadyAppState();
    useThemeStore.setState({
      loaded: false,
      recoveryNotice: null,
      load: loadTheme,
      acknowledgeRecovery,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("主题未恢复前不渲染主界面", () => {
    render(<App />);

    expect(screen.getByText("加载外观…")).toBeInTheDocument();
    expect(screen.queryByText("测试项目")).not.toBeInTheDocument();
    expect(loadTheme).toHaveBeenCalledOnce();
  });

  it("恢复默认提示会显示并在超时后确认关闭", async () => {
    vi.useFakeTimers();
    useThemeStore.setState({
      loaded: true,
      recoveryNotice: "外观配置无效，已恢复默认主题",
      load: loadTheme,
      acknowledgeRecovery,
    });

    render(<App />);

    expect(screen.getByText("外观配置无效，已恢复默认主题")).toBeInTheDocument();
    expect(screen.getByText("外观配置无效，已恢复默认主题").closest("[role=\"status\"]")).toHaveClass("theme-module-feedback", "border-l-(--module-scope-feedback-danger)");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(acknowledgeRecovery).toHaveBeenCalledOnce();
  });
});
