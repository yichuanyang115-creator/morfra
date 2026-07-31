import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BoardHeader } from "./BoardHeader";
import type { Attribute } from "../../types/schema";

function makeAttribute(overrides: Partial<Attribute>): Attribute {
  return { id: "a", name: "属性", type: "text", showOnBoard: true, showOnDetail: true, ...overrides };
}

describe("BoardHeader", () => {
  it("始终渲染名称列，不管传入多少属性", () => {
    render(<BoardHeader attributes={[]} />);
    expect(screen.getByText("名称")).toBeInTheDocument();
  });

  it("按传入顺序渲染每个属性的显示名", () => {
    render(
      <BoardHeader
        attributes={[
          makeAttribute({ id: "priority", name: "优先级" }),
          makeAttribute({ id: "assignee", name: "负责人" }),
        ]}
      />,
    );
    const labels = screen.getAllByText(/./).map((el) => el.textContent);
    expect(labels.indexOf("名称")).toBeLessThan(labels.indexOf("优先级"));
    expect(labels.indexOf("优先级")).toBeLessThan(labels.indexOf("负责人"));
  });
});
