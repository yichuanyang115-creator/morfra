import { describe, expect, it, vi } from "vitest";
import { AI_EVALUATION_TABLES, createEvaluationTableAdapter } from "../../fixtures/aiEvaluationTables";
import type { AIChatHandle, AIChatRequest } from "./providerClient";
import { startChatOrchestration } from "./chatOrchestrator";

const PLAN = { filters: [], projections: ["title"], groupBy: [], aggregates: [{ id: "count", operation: "count" }], sort: [], limit: 10 };

function transportFor(contents: string[]) {
  const calls: AIChatRequest[] = [];
  let index = 0;
  return {
    calls,
    transport: {
      start: vi.fn(async (request: AIChatRequest, onDelta?: (content: string) => void): Promise<AIChatHandle> => {
        calls.push(request);
        const content = contents[index++] ?? "";
        onDelta?.(content);
        return {
          requestId: request.requestId ?? `request-${index}`,
          completion: Promise.resolve({ requestId: request.requestId ?? `request-${index}`, content, streamed: true, status: "complete" as const }),
          cancel: async () => undefined,
        };
      }),
    },
  };
}

function input(adapter: ReturnType<typeof createEvaluationTableAdapter>["adapter"], question: string, overrides: Partial<Parameters<typeof startChatOrchestration>[0]> = {}) {
  return {
    tableId: "table-delivery",
    conversationId: "conversation-1",
    mode: "table-analysis" as const,
    question,
    providerConfigId: "provider-1",
    baseUrl: "https://example.test/v1",
    modelId: "model-1",
    dataExfiltrationConfirmed: true,
    adapter,
    ...overrides,
  };
}

describe("Phase 5 chatOrchestrator", () => {
  it("表格分析默认整表，所有精确结果先经过计划校验和本地分析", async () => {
    const { adapter } = createEvaluationTableAdapter();
    const fake = transportFor([JSON.stringify(PLAN), "本地结果已核对"]);
    const result = await startChatOrchestration({ ...input(adapter, "表里有多少条记录"), transport: fake.transport }).completion;

    expect(result.status).toBe("complete");
    expect(result.contextRef).toEqual({ type: "fullTable" });
    expect(result.minimalContext?.scope).toEqual({ type: "fullTable", recordIds: ["delivery-1", "delivery-2", "delivery-3"] });
    expect(result.answerBlocks.some((block) => block.type === "metrics" && block.items[0]?.value === 3)).toBe(true);
    expect(JSON.stringify(fake.calls[1])).toContain("LOCAL_ANALYSIS_CONTEXT");
    expect(JSON.stringify(fake.calls[1])).not.toContain("budget-1");
  });

  it("默认整表时忽略模型擅自声明的 recordIds，只有用户显式选择才能缩小范围", async () => {
    const { adapter } = createEvaluationTableAdapter();
    const fake = transportFor([JSON.stringify({ ...PLAN, recordIds: ["delivery-2"] }), "整表仍然有效"]);
    const result = await startChatOrchestration({ ...input(adapter, "统计整张表", { transport: fake.transport }) }).completion;
    expect(result.minimalContext?.scope).toEqual({ type: "fullTable", recordIds: ["delivery-1", "delivery-2", "delivery-3"] });
  });

  it("模型回答带有未经本地结果支持的数字时只保留安全说明和本地结构化结果", async () => {
    const { adapter } = createEvaluationTableAdapter();
    const fake = transportFor([JSON.stringify(PLAN), "本地实际计数为 3，但模型胡写共有 999 条"]);
    const result = await startChatOrchestration({ ...input(adapter, "统计整张表", { transport: fake.transport }) }).completion;
    expect(result.content).not.toContain("999");
    expect(JSON.stringify(result.answerBlocks)).not.toContain("999");
    expect(result.answerBlocks.some((block) => block.type === "metrics" && block.items[0]?.value === 3)).toBe(true);
  });

  it("表格回答按安全句子流式展示，停止态也不会落盘模型数字", async () => {
    const { adapter } = createEvaluationTableAdapter();
    const callbacks: Array<((content: string) => void) | undefined> = [];
    const deltas: string[] = [];
    let answerResolve: ((value: { requestId: string; content: string; streamed: boolean; status: "stopped" }) => void) | undefined;
    const transport = {
      start: vi.fn(async (request: AIChatRequest, onDelta?: (content: string) => void): Promise<AIChatHandle> => {
        callbacks.push(onDelta);
        if (request.requestId?.includes("-plan-")) {
          return { requestId: request.requestId, completion: Promise.resolve({ requestId: request.requestId, content: JSON.stringify(PLAN), streamed: true, status: "complete" as const }), cancel: async () => undefined };
        }
        const completion = new Promise<{ requestId: string; content: string; streamed: boolean; status: "stopped" }>((resolve) => { answerResolve = resolve; });
        return { requestId: request.requestId ?? "answer", completion, cancel: async () => { answerResolve?.({ requestId: request.requestId ?? "answer", content: "本地 999", streamed: true, status: "stopped" }); } };
      }),
    };
    const handle = startChatOrchestration({ ...input(adapter, "统计整张表", { transport, onDelta: (delta) => deltas.push(delta) }) });
    await vi.waitFor(() => expect(callbacks).toHaveLength(2));
    expect(callbacks[1]).toBeDefined();
    callbacks[1]?.("正在整理本地结论。模型声称共有 999 条。\n");
    expect(deltas).toEqual(["正在基于本地校验结果生成分析说明…"]);
    await handle.stop();
    const result = await handle.completion;
    expect(result.status).toBe("stopped");
    expect(result.content).not.toContain("999");
    expect(JSON.stringify(result.answerBlocks)).not.toContain("999");
  });

  it("显式选择范围只作用于当前消息，下一次恢复整表", async () => {
    const controls = createEvaluationTableAdapter();
    controls.setSelectedRecordIds("table-delivery", ["delivery-2"]);
    const first = transportFor([JSON.stringify(PLAN), "选中范围"]);
    const firstResult = await startChatOrchestration({
      ...input(controls.adapter, "统计选中记录", { selectionReferenced: true, selectedRecordIds: ["delivery-2"], transport: first.transport }),
    }).completion;
    expect(firstResult.minimalContext?.scope).toEqual({ type: "selectedRecords", recordIds: ["delivery-2"] });

    const second = transportFor([JSON.stringify(PLAN), "整表范围"]);
    const secondResult = await startChatOrchestration({ ...input(controls.adapter, "再次统计", { transport: second.transport }) }).completion;
    expect(secondResult.minimalContext?.scope.type).toBe("fullTable");
  });

  it("通用问题不读取表格，歧义问题先追问", async () => {
    const controls = createEvaluationTableAdapter();
    const snapshot = vi.spyOn(controls.adapter, "getTableSnapshot");
    const general = transportFor(["这是通用回答"]);
    const generalResult = await startChatOrchestration({ ...input(controls.adapter, "你好，什么是番茄工作法", { mode: "general", transport: general.transport }) }).completion;
    expect(generalResult.contextRef).toEqual({ type: "none" });
    expect(snapshot).not.toHaveBeenCalled();
    expect(general.calls).toHaveLength(1);

    const ambiguous = await startChatOrchestration({ ...input(controls.adapter, "帮我总结一下", { mode: "general", transport: general.transport }) }).completion;
    expect(ambiguous.status).toBe("clarification");
    expect(general.calls).toHaveLength(1);
  });

  it("两个非法计划后返回模型不兼容，不调用回答模型", async () => {
    const { adapter } = createEvaluationTableAdapter();
    const fake = transportFor([JSON.stringify({ ...PLAN, projections: ["missing"] }), JSON.stringify({ ...PLAN, aggregates: [{ id: "bad", operation: "sum", fieldId: "title" }] })]);
    const result = await startChatOrchestration({ ...input(adapter, "统计不存在字段", { transport: fake.transport }) }).completion;
    expect(result).toMatchObject({ status: "failed", errorCode: "model-incompatible" });
    expect(fake.calls).toHaveLength(2);
  });

  it("同名记录按稳定 tableId 隔离，不会把表 A 的记录带入表 B", async () => {
    const controls = createEvaluationTableAdapter();
    controls.setActiveTable("table-same-name-a");
    const first = transportFor([JSON.stringify({ ...PLAN, projections: ["title", "score"] }), "A"]);
    const firstResult = await startChatOrchestration({ ...input(controls.adapter, "查看重复记录", { tableId: "table-same-name-a", transport: first.transport }) }).completion;
    expect(firstResult.minimalContext?.table.tableId).toBe("table-same-name-a");
    expect(JSON.stringify(firstResult.minimalContext)).not.toContain("same-b-1");

    controls.setActiveTable("table-same-name-b");
    const second = transportFor([JSON.stringify({ ...PLAN, projections: ["title", "score"] }), "B"]);
    const secondResult = await startChatOrchestration({ ...input(controls.adapter, "查看重复记录", { tableId: "table-same-name-b", transport: second.transport }) }).completion;
    expect(secondResult.minimalContext?.table.tableId).toBe("table-same-name-b");
    expect(JSON.stringify(secondResult.minimalContext)).not.toContain("same-a-1");
    expect(AI_EVALUATION_TABLES.find((table) => table.tableId === "table-same-name-b")?.records[0]?.values.score).toBe(99);
  });
});
