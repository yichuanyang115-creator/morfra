import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TableDataSnapshot } from "../../types/domain";
import { useGridInteractionStore } from "../../stores/gridInteractionStore";
import { DataGrid, DataGridLoadingSkeleton, type GridLayoutConfig } from "./DataGrid";

vi.mock("@tanstack/react-virtual", () => ({ useVirtualizer: vi.fn() }));

const data: TableDataSnapshot = {
  tableId: "table-1",
  groups: [],
  fields: [
    { id: "title", tableId: "table-1", groupId: null, name: "名称", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] },
    { id: "progress", tableId: "table-1", groupId: null, name: "进度", fieldType: "progress", isTitle: false, position: 1, config: {}, options: [] },
    { id: "done", tableId: "table-1", groupId: null, name: "完成", fieldType: "checkbox", isTitle: false, position: 2, config: {}, options: [] },
    { id: "created", tableId: "table-1", groupId: null, name: "创建时间", fieldType: "created_time", isTitle: false, position: 3, config: {}, options: [] },
    { id: "tags", tableId: "table-1", groupId: null, name: "标签", fieldType: "multi_select", isTitle: false, position: 4, config: {}, options: [{ id: "tag-1", fieldId: "tags", name: "重要", color: "blue", position: 0 }] },
  ],
  records: [{ id: "record-1", tableId: "table-1", position: 0, autoNumber: 1, createdAt: "", updatedAt: "", values: { title: "旧标题", progress: 20, done: false, created: "2026-08-10" }, multiSelectValues: { tags: [] } }],
};
const config: GridLayoutConfig = { fieldIds: data.fields.map((field) => field.id), groupOrder: [], columnWidths: {}, frozenFieldId: null, rowHeight: 40, collapsedGroupIds: [] };

describe("DataGrid Phase 37 交互", () => {
  let hideVirtualCells = false;

  beforeEach(() => {
    hideVirtualCells = false;
    useGridInteractionStore.setState({ viewId: null, selection: null, editing: null, pendingCommit: null, saving: false, error: null, notice: null });
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.mocked(useVirtualizer).mockImplementation(((options: { horizontal?: boolean }) => ({ getTotalSize: () => 40, getVirtualItems: () => hideVirtualCells ? [] : options.horizontal ? [{ index: 0, start: 0 }, { index: 1, start: 240 }, { index: 2, start: 360 }, { index: 3, start: 480 }, { index: 4, start: 600 }] : [{ index: 0, start: 0 }] })) as never);
  });

  it("单击只选中，直接输入替换原值，Return 提交并移动", async () => {
    const onUpdateCell = vi.fn().mockResolvedValue(undefined);
    render(<DataGrid viewId="interaction" data={data} config={config} onConfigChange={vi.fn()} onCreate={vi.fn()} onOpenDetail={vi.fn()} onUpdateCell={onUpdateCell} />);
    const grid = screen.getByRole("grid", { name: "可编辑表格" });
    const title = screen.getByRole("gridcell", { name: /第 1 行，名称，旧标题/ });

    fireEvent.pointerDown(title);
    expect(title).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("textbox", { name: /编辑第 1 行名称/ })).not.toBeInTheDocument();
    fireEvent.keyDown(grid, { key: "新" });
    const input = screen.getByRole("textbox", { name: /编辑第 1 行名称/ });
    expect(input).toHaveValue("新");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onUpdateCell).toHaveBeenCalledWith("record-1", "title", "新"));
    expect(useGridInteractionStore.getState().selection?.active).toEqual({ row: 0, column: 0 });
  });

  it("复选框是直接操作例外，只读字段保持可选并给出原因", async () => {
    const onUpdateCell = vi.fn().mockResolvedValue(undefined);
    render(<DataGrid viewId="readonly" data={data} config={config} onConfigChange={vi.fn()} onCreate={vi.fn()} onOpenDetail={vi.fn()} onUpdateCell={onUpdateCell} />);
    fireEvent.click(screen.getByRole("button", { name: "切换完成" }));
    await waitFor(() => expect(onUpdateCell).toHaveBeenCalledWith("record-1", "done", true));
    const readonly = screen.getByRole("gridcell", { name: /创建时间.*只读/ });
    fireEvent.doubleClick(readonly);
    expect(screen.getByText("创建时间 是自动维护字段，不能编辑。")).toBeInTheDocument();
  });

  it("复选框直接保存失败后保留目标值并允许重试", async () => {
    const onUpdateCell = vi.fn().mockRejectedValueOnce(new Error("复选框保存失败")).mockResolvedValueOnce(undefined);
    render(<DataGrid viewId="checkbox-retry" data={data} config={config} onConfigChange={vi.fn()} onCreate={vi.fn()} onOpenDetail={vi.fn()} onUpdateCell={onUpdateCell} />);
    fireEvent.click(screen.getByRole("button", { name: "切换完成" }));
    fireEvent.click(await screen.findByRole("button", { name: "重试保存" }));

    await waitFor(() => expect(onUpdateCell).toHaveBeenNthCalledWith(2, "record-1", "done", true));
    await waitFor(() => expect(screen.queryByRole("button", { name: "重试保存" })).not.toBeInTheDocument());
    expect(useGridInteractionStore.getState().error).toBeNull();
  });

  it("只读单元格选中后可通过聚焦网格复制当前值", () => {
    render(<DataGrid viewId="copy-readonly" data={data} config={config} onConfigChange={vi.fn()} onCreate={vi.fn()} onOpenDetail={vi.fn()} onUpdateCell={vi.fn()} />);
    const grid = screen.getByRole("grid", { name: "可编辑表格" });
    fireEvent.pointerDown(screen.getByRole("gridcell", { name: /创建时间.*只读/ }));
    const setData = vi.fn();
    fireEvent.copy(grid, { clipboardData: { setData } });

    expect(document.activeElement).toBe(grid);
    expect(setData).toHaveBeenCalledWith("text/plain", "2026-08-10");
    expect(screen.getByText("已复制第 1 行创建时间。")).toBeInTheDocument();
  });

  it("校验错误不提交非法进度，Esc 放弃草稿", () => {
    const onUpdateCell = vi.fn();
    render(<DataGrid viewId="validation" data={data} config={config} onConfigChange={vi.fn()} onCreate={vi.fn()} onOpenDetail={vi.fn()} onUpdateCell={onUpdateCell} />);
    const cell = screen.getByRole("gridcell", { name: /进度，20/ });
    fireEvent.doubleClick(cell);
    const input = screen.getByRole("spinbutton", { name: /编辑第 1 行进度/ });
    fireEvent.change(input, { target: { value: "101" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("进度必须介于 0 到 100。")).toBeInTheDocument();
    expect(onUpdateCell).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("spinbutton", { name: /编辑第 1 行进度/ })).not.toBeInTheDocument();
  });

  it("编辑器脱离虚拟窗口后仍保留在稳定覆盖层", () => {
    const props = { viewId: "persistent", data, config, onConfigChange: vi.fn(), onCreate: vi.fn(), onOpenDetail: vi.fn(), onUpdateCell: vi.fn() };
    const { rerender } = render(<DataGrid {...props} />);
    fireEvent.doubleClick(screen.getByRole("gridcell", { name: /名称，旧标题/ }));
    expect(screen.getByRole("textbox", { name: /编辑第 1 行名称/ })).toBeInTheDocument();
    hideVirtualCells = true;
    rerender(<DataGrid {...props} />);
    expect(screen.queryByRole("gridcell", { name: /名称，旧标题/ })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /编辑第 1 行名称/ })).toBeInTheDocument();
  });

  it("多选尾部入口在点击外部后提交草稿并关闭", async () => {
    const onUpdateCell = vi.fn().mockResolvedValue(undefined);
    render(<DataGrid viewId="outside" data={data} config={config} onConfigChange={vi.fn()} onCreate={vi.fn()} onOpenDetail={vi.fn()} onUpdateCell={onUpdateCell} />);
    fireEvent.click(screen.getByRole("button", { name: "编辑标签" }));
    fireEvent.click(screen.getByRole("button", { name: "重要" }));
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(onUpdateCell).toHaveBeenCalledWith("record-1", "tags", ["tag-1"]));
  });

  it("多选保存失败后点击放弃不会被外部点击监听误重试", async () => {
    const onUpdateCell = vi.fn().mockRejectedValue(new Error("保存失败"));
    render(<DataGrid viewId="discard-multi" data={data} config={config} onConfigChange={vi.fn()} onCreate={vi.fn()} onOpenDetail={vi.fn()} onUpdateCell={onUpdateCell} />);
    fireEvent.click(screen.getByRole("button", { name: "编辑标签" }));
    fireEvent.click(screen.getByRole("button", { name: "重要" }));
    fireEvent.pointerDown(document.body);
    const discard = await screen.findByRole("button", { name: "放弃草稿" });
    fireEvent.pointerDown(discard);
    fireEvent.click(discard);

    await waitFor(() => expect(useGridInteractionStore.getState().editing).toBeNull());
    expect(onUpdateCell).toHaveBeenCalledTimes(1);
  });

  it("保存请求未完成时切换视图，失败后仍保留原草稿并可重试", async () => {
    let rejectFirst: (reason?: unknown) => void = () => undefined;
    const firstSave = new Promise<never>((_, reject) => { rejectFirst = reject; });
    const onUpdateCell = vi.fn().mockImplementationOnce(() => firstSave).mockResolvedValueOnce(undefined);
    const props = { data, config, onConfigChange: vi.fn(), onCreate: vi.fn(), onOpenDetail: vi.fn(), onUpdateCell };
    const { rerender } = render(<DataGrid viewId="view-a" {...props} />);
    fireEvent.doubleClick(screen.getByRole("gridcell", { name: /名称，旧标题/ }));
    const input = screen.getByRole("textbox", { name: /编辑第 1 行名称/ });
    fireEvent.change(input, { target: { value: "未落盘标题" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onUpdateCell).toHaveBeenCalledWith("record-1", "title", "未落盘标题"));

    const otherData = { ...data, records: [{ ...data.records[0], id: "record-2", values: { ...data.records[0].values, title: "另一视图" } }] };
    rerender(<DataGrid viewId="view-b" {...props} data={otherData} />);
    await waitFor(() => expect(useGridInteractionStore.getState().viewId).toBe("view-b"));
    await act(async () => { rejectFirst(new Error("网络中断")); await Promise.resolve(); });

    expect(useGridInteractionStore.getState().editing).toMatchObject({ viewId: "view-a", recordId: "record-1", fieldId: "title", draft: "未落盘标题" });
    fireEvent.click(await screen.findByRole("button", { name: "重试保存" }));
    await waitFor(() => expect(onUpdateCell).toHaveBeenNthCalledWith(2, "record-1", "title", "未落盘标题"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "重试保存" })).not.toBeInTheDocument());
    expect(useGridInteractionStore.getState().editing).toBeNull();
  });

  it("加载骨架按当前视图的可见字段数、宽度和行高生成", () => {
    const skeletonConfig = { ...config, fieldIds: ["title", "done"], columnWidths: { title: 280, done: 120 }, rowHeight: 56 as const };
    const { rerender } = render(<DataGridLoadingSkeleton config={skeletonConfig} />);
    const header = screen.getByTestId("grid-skeleton-header");
    expect(header.children).toHaveLength(3);
    expect(header).toHaveStyle({ gridTemplateColumns: "68px 280px 120px" });
    expect(header.nextElementSibling?.firstElementChild).toHaveStyle({ minHeight: "56px" });

    rerender(<DataGridLoadingSkeleton config={{ ...skeletonConfig, fieldIds: ["title"] }} />);
    expect(screen.getByTestId("grid-skeleton-header").children).toHaveLength(2);
    rerender(<DataGridLoadingSkeleton config={{ ...skeletonConfig, fieldIds: ["title", "progress", "done", "created", "tags"] }} />);
    expect(screen.getByTestId("grid-skeleton-header").children).toHaveLength(6);
  });

  it("键盘移动通过 aria-activedescendant 同步屏幕阅读器活动单元格", () => {
    render(<DataGrid viewId="a11y" data={data} config={config} onConfigChange={vi.fn()} onCreate={vi.fn()} onOpenDetail={vi.fn()} onUpdateCell={vi.fn()} />);
    const grid = screen.getByRole("grid", { name: "可编辑表格" });
    fireEvent.pointerDown(screen.getByRole("gridcell", { name: /名称，旧标题/ }));
    expect(document.activeElement).toBe(grid);
    fireEvent.keyDown(grid, { key: "ArrowRight" });
    const target = screen.getByRole("gridcell", { name: /进度，20/ });

    expect(document.activeElement).toBe(grid);
    expect(grid).toHaveAttribute("aria-activedescendant", target.id);
    expect(target).toHaveAttribute("aria-selected", "true");
  });

  it("首次点击行号后焦点进入网格，活动行可继续键盘导航", () => {
    render(<DataGrid viewId="row-focus" data={data} config={config} onConfigChange={vi.fn()} onCreate={vi.fn()} onOpenDetail={vi.fn()} onUpdateCell={vi.fn()} />);
    const grid = screen.getByRole("grid", { name: "可编辑表格" });
    fireEvent.pointerDown(screen.getByRole("rowheader"));

    expect(document.activeElement).toBe(grid);
    expect(useGridInteractionStore.getState().selection?.rows).toEqual([0]);
  });

  it("右键已有矩形选区内的单元格不会先坍缩选区", () => {
    render(<DataGrid viewId="context-range" data={data} config={config} onConfigChange={vi.fn()} onCreate={vi.fn()} onOpenDetail={vi.fn()} onUpdateCell={vi.fn()} />);
    const title = screen.getByRole("gridcell", { name: /名称，旧标题/ });
    const progress = screen.getByRole("gridcell", { name: /进度，20/ });
    fireEvent.pointerDown(title);
    fireEvent.pointerDown(progress, { shiftKey: true });
    fireEvent.pointerDown(title, { button: 2 });

    expect(useGridInteractionStore.getState().selection?.range).toEqual({ anchor: { row: 0, column: 0 }, focus: { row: 0, column: 1 } });
  });

  it("在网格内使用 ⌘Z 撤销存储操作并给出反馈", async () => {
    const onUndo = vi.fn().mockResolvedValue(undefined);
    render(<DataGrid viewId="undo" data={data} config={config} onConfigChange={vi.fn()} onCreate={vi.fn()} onOpenDetail={vi.fn()} onUpdateCell={vi.fn()} onUndo={onUndo} />);
    fireEvent.keyDown(screen.getByRole("grid", { name: "可编辑表格" }), { key: "z", metaKey: true });
    await waitFor(() => expect(onUndo).toHaveBeenCalledOnce());
    expect(screen.getByText("已撤销上次操作")).toBeInTheDocument();
  });
});
