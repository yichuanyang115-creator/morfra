import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const files = new Map<string, string>();

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async (path: string) => {
    if (files.has(path)) return true;
    return [...files.keys()].some((filePath) => filePath.startsWith(`${path}/`));
  }),
  mkdir: vi.fn(async () => undefined),
  readDir: vi.fn(async () => []),
  readTextFile: vi.fn(async (path: string) => files.get(path) ?? ""),
  writeTextFile: vi.fn(async (path: string, content: string) => {
    files.set(path, content);
  }),
  remove: vi.fn(async (path: string) => {
    for (const key of [...files.keys()]) {
      if (key === path || key.startsWith(`${path}/`)) files.delete(key);
    }
  }),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: vi.fn(async () => "/app-local-data"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

const { useProjectStore } = await import("../../stores/projectStore");
const { useTemplateStore } = await import("../../stores/templateStore");
const { ProjectSwitcher } = await import("./ProjectSwitcher");

describe("ProjectSwitcher（REQ-018/FLOW-009 多项目管理）", () => {
  beforeEach(() => {
    files.clear();
    useProjectStore.setState({ projects: [], currentProjectId: null, loaded: false, initializing: false, error: false });
    useTemplateStore.setState({ templates: [], loaded: true, loading: false, error: null });
  });

  it("点击列表中的项目触发切换并关闭弹层", async () => {
    const { createProject } = useProjectStore.getState();
    await createProject("项目甲");
    await createProject("项目乙");
    const [first] = useProjectStore.getState().projects;

    const onClose = vi.fn();
    render(<ProjectSwitcher onClose={onClose} />);

    await userEvent.click(screen.getByText("项目甲"));

    expect(useProjectStore.getState().currentProjectId).toBe(first.id);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("当前项目使用紫色上下文态，普通项目使用绿色悬停态", async () => {
    const { createProject } = useProjectStore.getState();
    await createProject("项目甲");
    await createProject("项目乙");
    render(<ProjectSwitcher onClose={vi.fn()} />);

    expect(screen.getByText("项目乙").closest("div.group")).toHaveClass("bg-(--module-scope-context-soft)", "text-(--module-scope-context-strong)");
    expect(screen.getByText("项目甲").closest("div.group")).toHaveClass("hover:bg-(--module-scope-action-soft)", "hover:text-(--module-scope-action-strong)");
  });

  it("只有一个项目时不显示删除按钮（FLOW-009 边界情况）", async () => {
    const { createProject } = useProjectStore.getState();
    await createProject("唯一项目");
    render(<ProjectSwitcher onClose={vi.fn()} />);

    expect(screen.queryByLabelText("删除项目")).not.toBeInTheDocument();
  });

  it("有多个项目时显示删除按钮，点击后弹出二次确认，确认前不删除", async () => {
    const { createProject } = useProjectStore.getState();
    await createProject("项目甲");
    await createProject("项目乙");
    render(<ProjectSwitcher onClose={vi.fn()} />);

    const deleteButtons = screen.getAllByLabelText("删除项目");
    await userEvent.click(deleteButtons[0]);

    expect(screen.getByText(/删除后无法撤销|无法撤销/)).toBeInTheDocument();
    expect(useProjectStore.getState().projects).toHaveLength(2);
  });

  it("二次确认后执行删除，删除后项目列表减少一项", async () => {
    const { createProject } = useProjectStore.getState();
    await createProject("项目甲");
    await createProject("项目乙");
    render(<ProjectSwitcher onClose={vi.fn()} />);

    const deleteButtons = screen.getAllByLabelText("删除项目");
    await userEvent.click(deleteButtons[0]);
    await userEvent.click(screen.getByRole("button", { name: "删除" }));

    expect(useProjectStore.getState().projects).toHaveLength(1);
  });

  it("取消二次确认弹窗不删除项目", async () => {
    const { createProject } = useProjectStore.getState();
    await createProject("项目甲");
    await createProject("项目乙");
    render(<ProjectSwitcher onClose={vi.fn()} />);

    const deleteButtons = screen.getAllByLabelText("删除项目");
    await userEvent.click(deleteButtons[0]);
    await userEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(useProjectStore.getState().projects).toHaveLength(2);
  });

  it("点击重命名图标进入内联编辑，输入新名称回车提交", async () => {
    const { createProject } = useProjectStore.getState();
    await createProject("旧名字");
    const id = useProjectStore.getState().projects[0].id;
    render(<ProjectSwitcher onClose={vi.fn()} />);

    await userEvent.click(screen.getByLabelText("重命名项目"));
    const input = screen.getByDisplayValue("旧名字");
    await userEvent.clear(input);
    await userEvent.type(input, "新名字");
    await userEvent.keyboard("{Enter}");

    const project = useProjectStore.getState().projects.find((p) => p.id === id);
    expect(project?.name).toBe("新名字");
  });

  it("底部表单输入项目名回车创建新项目，创建后清空输入框并关闭弹层", async () => {
    const onClose = vi.fn();
    render(<ProjectSwitcher onClose={onClose} />);

    const input = screen.getByPlaceholderText("新建项目名称");
    await userEvent.type(input, "新建的项目");
    await userEvent.click(screen.getByLabelText("创建"));

    expect(useProjectStore.getState().projects.map((p) => p.name)).toContain("新建的项目");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("底部表单名称为空时提交不创建项目", async () => {
    render(<ProjectSwitcher onClose={vi.fn()} />);

    await userEvent.click(screen.getByLabelText("创建"));

    expect(useProjectStore.getState().projects).toHaveLength(0);
  });

  it("新建项目选择 reqflow 模板后写入完整的模板 Schema", async () => {
    useTemplateStore.setState({
      templates: [{ id: "reqflow", name: "需求管理模板", schemaSnapshot: (await import("../../lib/schemaDefaults")).reqflowTemplateSnapshot() }],
    });
    render(<ProjectSwitcher onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("radio", { name: /需求管理模板/ }));
    await userEvent.type(screen.getByPlaceholderText("新建项目名称"), "模板项目");
    await userEvent.click(screen.getByLabelText("创建"));

    const project = useProjectStore.getState().projects[0];
    const schema = JSON.parse(files.get(`/app-local-data/projects/${project.id}/schema.json`) ?? "{}") as { stageOptions: unknown[] };
    expect(schema.stageOptions).toHaveLength(7);
  });
});
