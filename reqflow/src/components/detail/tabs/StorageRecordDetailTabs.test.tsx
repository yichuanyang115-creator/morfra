import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import type { RecordDetailContent, StorageDetailTab } from "../../../types/domain";
import { StorageRecordDetailTabs } from "./StorageRecordDetailTabs";

vi.mock("./BodyTab", () => ({ BodyTab: ({ markdown }: { markdown: string }) => <p>正文内容：{markdown}</p> }));

const tabs: StorageDetailTab[] = [
  { id: "body", name: "正文", renderer: "body", visible: true },
  { id: "deliverables", name: "产出", renderer: "deliverables", visible: true },
  { id: "tasks", name: "任务", renderer: "tasks", visible: true },
  { id: "acceptance", name: "验收", renderer: "acceptance", visible: true },
  { id: "activity", name: "活动", renderer: "activity", visible: true },
];

const content: RecordDetailContent = {
  recordId: "record-1",
  body: "背景",
  deliverables: [{ id: "deliverable-1", name: "原型", checked: false, attach: null, createdAt: "2026-08-11" }],
  tasks: [{ id: "task-1", name: "开发", assignee: "", deadline: "", progress: null, status: "todo", blocked: false, blockNote: "", createdAt: "2026-08-11" }],
  acceptance: [{ id: "acceptance-1", desc: "可创建", result: "unverified", failNote: "", createdAt: "2026-08-11" }],
};

function renderTabs(overrides: Partial<ComponentProps<typeof StorageRecordDetailTabs>> = {}) {
  return render(<StorageRecordDetailTabs tabs={tabs} content={content} contentLoading={false} events={[]} eventsLoading={false} eventsError={null} onSaveContent={vi.fn()} onOpenActivitySettings={vi.fn()} onUpdateActivityNote={vi.fn()} onAddActivityComment={vi.fn()} onDeleteActivityEvent={vi.fn()} {...overrides} />);
}

describe("StorageRecordDetailTabs", () => {
  it("需求模板实际渲染既有正文、产出、任务、验收和活动 Tab", async () => {
    renderTabs();
    for (const name of ["正文", "产出", "任务", "验收", "活动"]) expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    expect(screen.getByText("正文内容：背景")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "产出" }));
    expect(screen.getByDisplayValue("原型")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "任务" }));
    expect(screen.getByDisplayValue("开发")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "验收" }));
    expect(screen.getByRole("button", { name: "可创建" })).toBeInTheDocument();
  });

  it("活动配置入口仅出现在活动 Tab", async () => {
    const onOpenActivitySettings = vi.fn();
    renderTabs({ onOpenActivitySettings });
    expect(screen.queryByRole("button", { name: "活动设置" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "活动" }));
    await userEvent.click(screen.getByRole("button", { name: "活动设置" }));
    expect(onOpenActivitySettings).toHaveBeenCalledTimes(1);
  });

  it("空白项目没有详情 Tab 时不渲染需求专用内容", () => {
    renderTabs({ tabs: [] });
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
});
