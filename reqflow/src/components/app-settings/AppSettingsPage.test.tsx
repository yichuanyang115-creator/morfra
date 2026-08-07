import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultTheme } from "../../lib/themeDefaults";
import { useThemeStore } from "../../stores/themeStore";
import type { AppSettingsSection } from "../../stores/uiStore";
import { AppSettingsNav } from "./AppSettingsNav";
import { AppSettingsPage } from "./AppSettingsPage";

describe("AppSettingsNav", () => {
  it("提供外观和版本两个独立导航项并标记当前项", () => {
    render(<AppSettingsNav section="appearance" onSelect={vi.fn()} />);

    expect(screen.getByRole("button", { name: "外观" })).toHaveClass("bg-(--accent-selected)");
    expect(screen.getByRole("button", { name: "版本" })).toBeInTheDocument();
  });
});

describe("AppSettingsPage 外观草稿", () => {
  beforeEach(() => {
    useThemeStore.setState({
      appliedTheme: createDefaultTheme(),
      draftTheme: null,
      draftIssues: [],
    });
  });

  afterEach(() => {
    cleanup();
    useThemeStore.getState().cancelDraft();
  });

  it("编辑语义色只改变草稿，点击取消恢复并关闭设置页", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSelectSection = vi.fn<(section: AppSettingsSection) => void>();
    render(<AppSettingsPage section="appearance" onSelectSection={onSelectSection} onClose={onClose} />);

    const input = await screen.findByDisplayValue("green600");
    await user.clear(input);
    await user.type(input, "#4F9200");

    expect(useThemeStore.getState().draftTheme?.semantic.actionStrong).toBe("#4F9200");
    expect(useThemeStore.getState().appliedTheme.semantic.actionStrong).toBe("green600");
    expect(screen.getByText("综合预览")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(useThemeStore.getState().draftTheme).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("输入保留红色时显示字段错误并禁用应用", async () => {
    const user = userEvent.setup();
    render(<AppSettingsPage section="appearance" onSelectSection={vi.fn()} onClose={vi.fn()} />);

    const input = await screen.findByDisplayValue("green600");
    await user.clear(input);
    await user.type(input, "#B3261E");

    expect(screen.getByRole("alert")).toHaveTextContent("普通操作和结构角色不能占用红色或黄色保留色");
    expect(screen.getAllByRole("button", { name: "应用" }).find((button) => (button as HTMLButtonElement).disabled)).toBeTruthy();
    expect(screen.getByText("对比度待修复")).toBeInTheDocument();
  });

  it("预览区域采用草稿主题变量，并在有效草稿时显示通过状态", async () => {
    render(<AppSettingsPage section="appearance" onSelectSection={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByText("对比度通过")).toBeInTheDocument();
    const preview = screen.getByTestId("theme-preview-surface");
    expect(preview.getAttribute("style")).toContain("--semantic-action-base");
  });

  it("可单独自定义看板模块并恢复跟随，其他模块保持缺省继承", async () => {
    const user = userEvent.setup();
    render(<AppSettingsPage section="appearance" onSelectSection={vi.fn()} onClose={vi.fn()} />);

    const boardModuleSwitch = await screen.findByRole("checkbox", { name: "看板：自定义此模块" });
    await user.click(boardModuleSwitch);
    expect(useThemeStore.getState().draftTheme?.moduleOverrides.board).toBeDefined();
    expect(useThemeStore.getState().draftTheme?.moduleOverrides.topbar).toBeUndefined();
    expect(screen.getByLabelText(/模块底色/)).toBeInTheDocument();

    const selectedBackground = screen.getByLabelText(/选中背景/);
    await user.clear(selectedBackground);
    await user.type(selectedBackground, "purple100");
    expect(useThemeStore.getState().draftTheme?.moduleOverrides.board?.contextSoft).toBe("purple100");

    await user.click(screen.getByRole("button", { name: "恢复跟随主题" }));
    expect(useThemeStore.getState().draftTheme?.moduleOverrides.board).toBeUndefined();
  });
});
