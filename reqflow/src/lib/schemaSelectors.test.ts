import { describe, expect, it } from "vitest";
import type { Attribute, Schema } from "../types/schema";
import { boardAttributesFor } from "./schemaSelectors";

function makeAttribute(overrides: Partial<Attribute>): Attribute {
  return { id: "a", name: "属性", type: "text", showOnBoard: true, showOnDetail: true, ...overrides };
}

function makeSchema(attributes: Attribute[], columnOrder: string[] = []): Schema {
  return {
    version: 1,
    stageOptions: [],
    attributes,
    tabs: [],
    viewPreferences: { columnOrder, columnWidths: {} },
  };
}

describe("boardAttributesFor", () => {
  it("schema 为 null 时返回空数组", () => {
    expect(boardAttributesFor(null)).toEqual([]);
  });

  it("过滤掉 showOnBoard 为 false 的属性", () => {
    const schema = makeSchema([
      makeAttribute({ id: "a", showOnBoard: true }),
      makeAttribute({ id: "b", showOnBoard: false }),
    ]);
    expect(boardAttributesFor(schema).map((a) => a.id)).toEqual(["a"]);
  });

  it("columnOrder 为空时保持 attributes 原始顺序", () => {
    const schema = makeSchema([makeAttribute({ id: "b" }), makeAttribute({ id: "a" })]);
    expect(boardAttributesFor(schema).map((a) => a.id)).toEqual(["b", "a"]);
  });

  it("columnOrder 非空时按其顺序重排", () => {
    const schema = makeSchema(
      [makeAttribute({ id: "b" }), makeAttribute({ id: "a" }), makeAttribute({ id: "c" })],
      ["c", "a", "b"],
    );
    expect(boardAttributesFor(schema).map((a) => a.id)).toEqual(["c", "a", "b"]);
  });

  it("columnOrder 中未列出的属性排在已列出的属性之后，不丢失", () => {
    const schema = makeSchema(
      [makeAttribute({ id: "a" }), makeAttribute({ id: "b" }), makeAttribute({ id: "new" })],
      ["b", "a"],
    );
    expect(boardAttributesFor(schema).map((a) => a.id)).toEqual(["b", "a", "new"]);
  });
});
