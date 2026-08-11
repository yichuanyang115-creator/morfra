import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FieldSummary } from "../../types/domain";
import { GridContextMenu, uniformValueAvailability, validateBatchValue } from "./GridContextMenu";

const progress: FieldSummary = { id: "progress", tableId: "table-1", groupId: null, name: "进度", fieldType: "progress", isTitle: false, position: 0, config: {}, options: [] };
const select: FieldSummary = { id: "status", tableId: "table-1", groupId: null, name: "状态", fieldType: "select", isTitle: false, position: 1, config: {}, options: [{ id: "open", fieldId: "status", name: "进行中", color: "blue", position: 0 }] };

describe("统一设置值校验", () => {
  it("拒绝非有限数字和越界进度，不能把它们转换为空值", () => {
    expect(validateBatchValue(progress, "abc")).toBeInstanceOf(Error);
    expect(validateBatchValue(progress, "101")).toBeInstanceOf(Error);
    expect(validateBatchValue(progress, "50")).toBe(50);
  });

  it("只接受当前字段的选项 ID，空值仅由专属控件明确选择", () => {
    expect(validateBatchValue(select, "missing")).toBeInstanceOf(Error);
    expect(validateBatchValue(select, "open")).toBe("open");
    expect(validateBatchValue(select, null)).toBeNull();
  });

  it("统一设置值只会在同字段的多单元格选区启用", () => {
    const fields = [progress, select];
    expect(uniformValueAvailability({ active: { row: 0, column: 0 }, range: { anchor: { row: 0, column: 0 }, focus: { row: 0, column: 0 } }, rows: [] }, fields).canSetValue).toBe(false);
    expect(uniformValueAvailability({ active: { row: 1, column: 0 }, range: { anchor: { row: 0, column: 0 }, focus: { row: 1, column: 0 } }, rows: [] }, fields).canSetValue).toBe(true);
    expect(uniformValueAvailability({ active: { row: 1, column: 1 }, range: { anchor: { row: 0, column: 0 }, focus: { row: 1, column: 1 } }, rows: [] }, fields).canSetValue).toBe(false);
    const collapsed = { ...progress, id: "collapsed:group-1" };
    const availability = uniformValueAvailability({ active: { row: 1, column: 0 }, range: { anchor: { row: 0, column: 0 }, focus: { row: 1, column: 0 } }, rows: [] }, [collapsed]);
    expect(availability.canSetValue).toBe(false);
    render(<GridContextMenu x={0} y={0} field={collapsed} rowSelected={false} canClear canSetValue={availability.canSetValue} setValueReason={availability.setValueReason} onCopy={() => undefined} onPaste={() => undefined} onClear={() => undefined} onDeleteRows={() => undefined} onOpenDetail={() => undefined} onSetValue={() => undefined} onClose={() => undefined} />);
    expect(screen.getByRole("menuitem", { name: "统一设置值" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "统一设置值" })).toHaveAttribute("title", expect.stringContaining("多个可编辑单元格"));
  });
});
