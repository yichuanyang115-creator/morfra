import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldCell } from "./FieldCell";
import type { Attribute } from "../../types/schema";
import type { Requirement } from "../../types/models";

function makeRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: "r-1",
    name: "需求一",
    stage: "design",
    createdAt: "2026-01-01T00:00:00.000Z",
    manualOrder: 0,
    body: "",
    attributeValues: {},
    deliverables: [],
    tasks: [],
    acceptance: [],
    transitions: [],
    comments: [],
    ...overrides,
  };
}

const PRIORITY_ATTR: Attribute = {
  id: "priority",
  name: "优先级",
  type: "singleSelect",
  options: [
    { id: "P0", label: "P0" },
    { id: "P1", label: "P1" },
    { id: "P2", label: "P2" },
  ],
  showOnBoard: true,
  showOnDetail: true,
};

describe("FieldCell", () => {
  describe("singleSelect", () => {
    it("渲染当前选中选项的 badge 文案", () => {
      const requirement = makeRequirement({ attributeValues: { priority: "P0" } });
      render(<FieldCell attribute={PRIORITY_ATTR} requirement={requirement} onChange={vi.fn()} />);
      expect(screen.getByText("P0", { selector: "span" })).toBeInTheDocument();
    });

    it("未设置值时不渲染 badge", () => {
      const requirement = makeRequirement({ attributeValues: {} });
      render(<FieldCell attribute={PRIORITY_ATTR} requirement={requirement} onChange={vi.fn()} />);
      expect(screen.queryByText("P0", { selector: "span" })).not.toBeInTheDocument();
      expect(screen.queryByText("P1", { selector: "span" })).not.toBeInTheDocument();
      expect(screen.queryByText("P2", { selector: "span" })).not.toBeInTheDocument();
    });

    it("选择新选项触发 onChange，携带选项 id", async () => {
      const onChange = vi.fn();
      const requirement = makeRequirement({ attributeValues: { priority: "P2" } });
      render(<FieldCell attribute={PRIORITY_ATTR} requirement={requirement} onChange={onChange} />);

      await userEvent.selectOptions(screen.getByLabelText("优先级"), "P0");
      expect(onChange).toHaveBeenCalledWith("P0");
    });

    it("readOnly 为 true 时渲染纯文本，不渲染可交互的 select", () => {
      const requirement = makeRequirement({ attributeValues: { priority: "P1" } });
      render(<FieldCell attribute={PRIORITY_ATTR} requirement={requirement} readOnly onChange={vi.fn()} />);
      expect(screen.getByText("P1")).toBeInTheDocument();
      expect(screen.queryByLabelText("优先级")).not.toBeInTheDocument();
    });

    it("非优先级单选属性使用选项自带颜色或色板兜底渲染 badge，不套用优先级专属语义色", () => {
      const attribute: Attribute = {
        id: "custom_status",
        name: "状态",
        type: "singleSelect",
        options: [{ id: "todo", label: "待办", color: "#ABCDEF" }],
        showOnBoard: true,
        showOnDetail: true,
      };
      const requirement = makeRequirement({ attributeValues: { custom_status: "todo" } });
      render(<FieldCell attribute={attribute} requirement={requirement} onChange={vi.fn()} />);
      const badge = screen.getByText("待办", { selector: "span" });
      expect(badge).toHaveStyle({ backgroundColor: "#ABCDEF" });
    });
  });

  describe("multiSelect", () => {
    const TAGS_ATTR: Attribute = {
      id: "tags",
      name: "标签",
      type: "multiSelect",
      options: [
        { id: "a", label: "A标签" },
        { id: "b", label: "B标签" },
      ],
      showOnBoard: true,
      showOnDetail: true,
    };

    it("渲染所有已选中选项的 badge", () => {
      const requirement = makeRequirement({ attributeValues: { tags: ["a", "b"] } });
      render(<FieldCell attribute={TAGS_ATTR} requirement={requirement} onChange={vi.fn()} />);
      expect(screen.getByText("A标签")).toBeInTheDocument();
      expect(screen.getByText("B标签")).toBeInTheDocument();
    });

    it("没有选中项时显示占位符", () => {
      const requirement = makeRequirement({ attributeValues: { tags: [] } });
      render(<FieldCell attribute={TAGS_ATTR} requirement={requirement} onChange={vi.fn()} />);
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("点击已选中的 badge 触发 onChange，从数组中移除该选项", async () => {
      const onChange = vi.fn();
      const requirement = makeRequirement({ attributeValues: { tags: ["a", "b"] } });
      render(<FieldCell attribute={TAGS_ATTR} requirement={requirement} onChange={onChange} />);

      await userEvent.click(screen.getByText("A标签"));
      expect(onChange).toHaveBeenCalledWith(["b"]);
    });

    it("同一选项的色板兜底颜色不随选中子集变化（按完整 options 列表的原始索引取色，不是已选子集的遍历索引）", () => {
      const attribute: Attribute = {
        id: "tags2",
        name: "标签2",
        type: "multiSelect",
        options: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
          { id: "d", label: "D" },
        ],
        showOnBoard: true,
        showOnDetail: true,
      };

      const { unmount } = render(
        <FieldCell attribute={attribute} requirement={makeRequirement({ attributeValues: { tags2: ["b", "d"] } })} onChange={vi.fn()} />,
      );
      const dColorWhenSelectedWithB = getComputedStyle(screen.getByText("D")).backgroundColor;
      unmount();

      render(
        <FieldCell attribute={attribute} requirement={makeRequirement({ attributeValues: { tags2: ["a", "b", "d"] } })} onChange={vi.fn()} />,
      );
      const dColorWhenSelectedWithAB = getComputedStyle(screen.getByText("D")).backgroundColor;

      expect(dColorWhenSelectedWithAB).toBe(dColorWhenSelectedWithB);
    });
  });

  describe("number", () => {
    const NUMBER_ATTR: Attribute = { id: "count", name: "数量", type: "number", showOnBoard: true, showOnDetail: true };

    it("渲染当前数值", () => {
      const requirement = makeRequirement({ attributeValues: { count: 42 } });
      render(<FieldCell attribute={NUMBER_ATTR} requirement={requirement} onChange={vi.fn()} />);
      expect(screen.getByRole("spinbutton")).toHaveValue(42);
    });

    it("失焦时触发 onChange，携带解析后的数字", async () => {
      const onChange = vi.fn();
      const requirement = makeRequirement({ attributeValues: { count: 1 } });
      render(<FieldCell attribute={NUMBER_ATTR} requirement={requirement} onChange={onChange} />);

      const input = screen.getByRole("spinbutton");
      await userEvent.clear(input);
      await userEvent.type(input, "99");
      await userEvent.tab();

      expect(onChange).toHaveBeenCalledWith(99);
    });

    it("清空后失焦触发 onChange(null)，不裁剪范围（区别于 percent）", async () => {
      const onChange = vi.fn();
      const requirement = makeRequirement({ attributeValues: { count: 500 } });
      render(<FieldCell attribute={NUMBER_ATTR} requirement={requirement} onChange={onChange} />);

      const input = screen.getByRole("spinbutton");
      await userEvent.clear(input);
      await userEvent.tab();

      expect(onChange).toHaveBeenCalledWith(null);
    });
  });

  describe("percent", () => {
    const PERCENT_ATTR: Attribute = { id: "progress", name: "进度", type: "percent", showOnBoard: true, showOnDetail: true };

    it("渲染当前百分比数值", () => {
      const requirement = makeRequirement({ attributeValues: { progress: 60 } });
      render(<FieldCell attribute={PERCENT_ATTR} requirement={requirement} onChange={vi.fn()} />);
      expect(screen.getByRole("spinbutton")).toHaveValue(60);
    });

    it("超出 100 的输入在失焦时被裁剪为 100", async () => {
      const onChange = vi.fn();
      const requirement = makeRequirement({ attributeValues: { progress: 0 } });
      render(<FieldCell attribute={PERCENT_ATTR} requirement={requirement} onChange={onChange} />);

      const input = screen.getByRole("spinbutton");
      await userEvent.clear(input);
      await userEvent.type(input, "150");
      await userEvent.tab();

      expect(onChange).toHaveBeenCalledWith(100);
    });
  });

  describe("date", () => {
    const DATE_ATTR: Attribute = { id: "deadline", name: "截止日期", type: "date", showOnBoard: true, showOnDetail: true };

    it("渲染格式化后的日期文案", () => {
      const requirement = makeRequirement({ attributeValues: { deadline: "2026-03-15" } });
      render(<FieldCell attribute={DATE_ATTR} requirement={requirement} onChange={vi.fn()} />);
      expect(screen.getByText("3/15/26")).toBeInTheDocument();
    });

    it("修改日期输入触发 onChange", () => {
      const onChange = vi.fn();
      const requirement = makeRequirement({ attributeValues: { deadline: "2026-01-01" } });
      render(<FieldCell attribute={DATE_ATTR} requirement={requirement} onChange={onChange} />);

      const input = document.querySelector('input[type="date"]') as HTMLInputElement;
      Object.defineProperty(input, "value", { writable: true, value: "2026-02-02" });
      input.dispatchEvent(new Event("change", { bubbles: true }));

      expect(onChange).toHaveBeenCalledWith("2026-02-02");
    });
  });

  describe("text", () => {
    const TEXT_ATTR: Attribute = { id: "assignee", name: "负责人", type: "text", showOnBoard: true, showOnDetail: true };

    it("渲染当前文本值", () => {
      const requirement = makeRequirement({ attributeValues: { assignee: "吴桐" } });
      render(<FieldCell attribute={TEXT_ATTR} requirement={requirement} onChange={vi.fn()} />);
      expect(screen.getByDisplayValue("吴桐")).toBeInTheDocument();
    });

    it("失焦时触发 onChange，携带输入值", async () => {
      const onChange = vi.fn();
      const requirement = makeRequirement({ attributeValues: { assignee: "" } });
      render(<FieldCell attribute={TEXT_ATTR} requirement={requirement} onChange={onChange} />);

      const input = screen.getByPlaceholderText("—");
      await userEvent.type(input, "李雷");
      await userEvent.tab();

      expect(onChange).toHaveBeenCalledWith("李雷");
    });
  });

  describe("checkbox", () => {
    const CHECKBOX_ATTR: Attribute = { id: "done", name: "完成", type: "checkbox", showOnBoard: true, showOnDetail: true };

    it("渲染勾选状态", () => {
      const requirement = makeRequirement({ attributeValues: { done: true } });
      render(<FieldCell attribute={CHECKBOX_ATTR} requirement={requirement} onChange={vi.fn()} />);
      expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
    });

    it("点击切换勾选状态，触发 onChange 携带取反后的值", async () => {
      const onChange = vi.fn();
      const requirement = makeRequirement({ attributeValues: { done: false } });
      render(<FieldCell attribute={CHECKBOX_ATTR} requirement={requirement} onChange={onChange} />);

      await userEvent.click(screen.getByRole("checkbox"));
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe("attachment", () => {
    const ATTACHMENT_ATTR: Attribute = { id: "files", name: "附件", type: "attachment", showOnBoard: true, showOnDetail: true };

    it("有附件时显示计数", () => {
      const requirement = makeRequirement({ attributeValues: { files: [{}, {}] } });
      render(<FieldCell attribute={ATTACHMENT_ATTR} requirement={requirement} onChange={vi.fn()} />);
      expect(screen.getByText("2 项")).toBeInTheDocument();
    });

    it("没有附件时显示占位符", () => {
      const requirement = makeRequirement({ attributeValues: { files: [] } });
      render(<FieldCell attribute={ATTACHMENT_ATTR} requirement={requirement} onChange={vi.fn()} />);
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  describe("computed", () => {
    it("createdAt 计算属性渲染格式化后的创建时间", () => {
      const attribute: Attribute = {
        id: "created_at",
        name: "创建时间",
        type: "computed",
        computedKind: "createdAt",
        showOnBoard: true,
        showOnDetail: true,
      };
      const requirement = makeRequirement({ createdAt: "2026-05-01T00:00:00.000Z" });
      render(<FieldCell attribute={attribute} requirement={requirement} onChange={vi.fn()} />);
      expect(screen.getByText("5/1/26")).toBeInTheDocument();
    });

    it("stayDays 非归档态渲染天数", () => {
      const attribute: Attribute = {
        id: "stay_days",
        name: "停留天数",
        type: "computed",
        computedKind: "stayDays",
        showOnBoard: true,
        showOnDetail: false,
      };
      const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
      const requirement = makeRequirement({
        stage: "dev",
        transitions: [{ id: "t1", from: "design", to: "dev", timestamp: tenDaysAgo, by: "我", note: "" }],
      });
      render(<FieldCell attribute={attribute} requirement={requirement} onChange={vi.fn()} />);
      expect(screen.getByText("10d")).toBeInTheDocument();
    });

    it("stayDays 归档态改为渲染最后一次流转（归档）时间，不显示天数", () => {
      const attribute: Attribute = {
        id: "stay_days",
        name: "停留天数",
        type: "computed",
        computedKind: "stayDays",
        showOnBoard: true,
        showOnDetail: false,
      };
      const requirement = makeRequirement({
        stage: "archive",
        transitions: [{ id: "t1", from: "release", to: "archive", timestamp: "2026-01-15T00:00:00.000Z", by: "我", note: "" }],
      });
      render(<FieldCell attribute={attribute} requirement={requirement} onChange={vi.fn()} />);
      expect(screen.getByText("1/15/26")).toBeInTheDocument();
    });

    it("totalDays 渲染总耗时天数", () => {
      const attribute: Attribute = {
        id: "total_days",
        name: "总耗时",
        type: "computed",
        computedKind: "totalDays",
        showOnBoard: true,
        showOnDetail: false,
      };
      const twentyDaysAgo = new Date(Date.now() - 20 * 86_400_000).toISOString();
      const requirement = makeRequirement({ stage: "dev", createdAt: twentyDaysAgo });
      render(<FieldCell attribute={attribute} requirement={requirement} onChange={vi.fn()} />);
      expect(screen.getByText("20d")).toBeInTheDocument();
    });
  });
});
