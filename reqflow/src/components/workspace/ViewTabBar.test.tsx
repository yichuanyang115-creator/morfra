import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ViewTabBar } from "./ViewTabBar";
import type { ViewSummary } from "../../types/domain";

function views(count: number): ViewSummary[] {
  return Array.from({ length: count }, (_, index) => ({ id: `view-${index}`, name: `视图 ${index}`, viewType: "table", position: index }));
}

const noopAsync = vi.fn(async () => undefined);

describe("ViewTabBar", () => {
  it("keeps a long tab row flat and exposes all views", () => {
    const items = views(50);
    render(<ViewTabBar tableId="table-1" views={items} activeViewId="view-49" onSelect={vi.fn()} onCreate={noopAsync} onRename={noopAsync} onDuplicate={noopAsync} onDelete={noopAsync} onReorder={noopAsync} />);

    expect(screen.getAllByRole("button", { name: /视图操作/ })).toHaveLength(50);
    fireEvent.click(screen.getByRole("button", { name: "所有视图" }));
    expect(screen.getByRole("menu", { name: "所有视图菜单" })).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(50);
  });

  it("opens view actions and protects the last view from deletion", () => {
    const item = views(1)[0];
    render(<ViewTabBar tableId="table-1" views={[item]} activeViewId={item.id} onSelect={vi.fn()} onCreate={noopAsync} onRename={noopAsync} onDuplicate={noopAsync} onDelete={noopAsync} onReorder={noopAsync} />);

    fireEvent.click(screen.getByRole("button", { name: `视图操作 ${item.name}` }));
    expect(screen.getByRole("menuitem", { name: "删除视图" })).toBeDisabled();
  });
});
