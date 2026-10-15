import { describe, expect, it } from "vitest";
import { buildBoardColumns, EMPTY_BOARD_CONFIG, moveCardValue } from "./boardProjection";
import type { FieldSummary, RecordData } from "../../types/domain";
import { EMPTY_VIEW_PIPELINE } from "../table/viewPipeline";

const title: FieldSummary = { id: "title", tableId: "t", groupId: null, name: "标题", fieldType: "text", isTitle: true, position: 0, config: {}, options: [] };
const tags: FieldSummary = { id: "tags", tableId: "t", groupId: null, name: "标签", fieldType: "multi_select", isTitle: false, position: 1, config: {}, options: [{ id: "a", fieldId: "tags", name: "A", color: "blue", position: 0 }, { id: "b", fieldId: "tags", name: "B", color: "blue", position: 1 }] };
const record = (id: string, values: string[]): RecordData => ({ id, tableId: "t", position: 0, autoNumber: 1, createdAt: "1", updatedAt: "1", values: { title: id }, multiSelectValues: { tags: values } });

describe("boardProjection", () => {
  it("keeps select option columns and projects a multi-select record independently", () => {
    const columns = buildBoardColumns([record("r1", ["a", "b"]), record("r2", [])], [title, tags], { ...EMPTY_BOARD_CONFIG, groupFieldId: "tags", cardPositions: { b: ["r1"] } }, EMPTY_VIEW_PIPELINE);
    expect(columns.map((column) => [column.key, column.recordIds])).toEqual([["a", ["r1"]], ["b", ["r1"]], ["__empty__", ["r2"]]]);
  });
  it("moves a multi-select projection without removing unrelated memberships", () => {
    expect(moveCardValue(record("r1", ["a", "b"]), tags, "a", "b")).toEqual(["b"]);
  });
  it("uses field sorting rather than saved manual positions while a sort is active", () => {
    const columns = buildBoardColumns(
      [record("zeta", ["a"]), record("alpha", ["a"])],
      [title, tags],
      { ...EMPTY_BOARD_CONFIG, groupFieldId: "tags", cardPositions: { a: ["zeta", "alpha"] } },
      { ...EMPTY_VIEW_PIPELINE, sorts: [{ id: "title-sort", fieldId: "title", direction: "asc" }] },
    );
    expect(columns.find((column) => column.key === "a")?.recordIds).toEqual(["alpha", "zeta"]);
  });
});
