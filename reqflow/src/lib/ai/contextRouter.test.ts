import { describe, expect, it } from "vitest";
import { contextRefForRoute, routeContext } from "./contextRouter";

describe("AI 上下文路由", () => {
  it("通用问题不读表，明确表格问题读整表，歧义问题先追问", () => {
    expect(routeContext({ mode: "general", message: "你好，什么是番茄工作法" }).type).toBe("none");
    expect(routeContext({ mode: "general", message: "表里有多少条记录" }).type).toBe("fullTable");
    expect(routeContext({ mode: "general", message: "帮我总结一下" }).type).toBe("clarification");
  });

  it("只有用户显式引用时才使用选中记录，下一条默认恢复整表", () => {
    const selected = routeContext({
      mode: "table-analysis",
      message: "求和",
      selectionReferenced: true,
      selectedRecordIds: ["delivery-1"],
    });
    expect(selected).toEqual({ type: "selectedRecords", recordIds: ["delivery-1"], reason: "explicit-selection" });
    expect(contextRefForRoute(selected)).toEqual({ type: "selectedRecords", recordIds: ["delivery-1"] });
    expect(routeContext({ mode: "table-analysis", message: "总数", selectedRecordIds: ["delivery-1"] }).type).toBe("fullTable");
  });
});
