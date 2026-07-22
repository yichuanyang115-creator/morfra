import { describe, expect, it } from "vitest";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter";

interface Sample {
  id: string;
  name: string;
}

describe("frontmatter body round-trip", () => {
  it("解析 frontmatter 之后正文（body）原样保留，包含 Markdown 格式", () => {
    const raw = [
      "---",
      "id: abc123",
      "name: 测试需求",
      "---",
      "",
      "## 背景",
      "",
      "这是**加粗**文本和 `代码` 片段。",
      "",
      "- 列表项一",
      "- 列表项二",
    ].join("\n");

    const { data, content } = parseFrontmatter<Sample>(raw);

    expect(data.id).toBe("abc123");
    expect(data.name).toBe("测试需求");
    expect(content).toContain("## 背景");
    expect(content).toContain("这是**加粗**文本和 `代码` 片段。");
    expect(content).toContain("- 列表项一");
  });

  it("stringifyFrontmatter 序列化后再 parseFrontmatter 解析，body 内容不丢不变形", () => {
    const data: Sample = { id: "req-1", name: "需求 A" };
    const body = "## 现状问题\n\n多行\n正文\n内容。\n\n> 引用块\n";

    const raw = stringifyFrontmatter(data, body);
    const { data: parsedData, content: parsedBody } = parseFrontmatter<Sample>(raw);

    expect(parsedData).toEqual(data);
    expect(parsedBody).toBe(body);
  });

  it("空 body 序列化再解析后仍是空字符串，不产生多余换行残留", () => {
    const data: Sample = { id: "req-2", name: "空需求" };
    const raw = stringifyFrontmatter(data, "");
    const { content } = parseFrontmatter<Sample>(raw);
    expect(content).toBe("");
  });
});
