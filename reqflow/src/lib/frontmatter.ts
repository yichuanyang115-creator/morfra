import { dump, load } from "js-yaml";

const DELIMITER = "---";

export interface ParsedFrontmatter<T> {
  data: T;
  content: string;
}

/**
 * 解析 `---\nYAML\n---\n正文` 格式的文件。不用 gray-matter——它内部靠 eval()
 * 解析部分 YAML 分支，在浏览器打包环境下是安全隐患（见 DEV-PLAN 技术栈变更说明）。
 */
export function parseFrontmatter<T>(raw: string): ParsedFrontmatter<T> {
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== DELIMITER) {
    return { data: {} as T, content: raw };
  }

  const endIndex = lines.findIndex((line, i) => i > 0 && line.trim() === DELIMITER);
  if (endIndex === -1) {
    return { data: {} as T, content: raw };
  }

  const yamlBlock = lines.slice(1, endIndex).join("\n");
  const content = lines.slice(endIndex + 1).join("\n").replace(/^\n/, "");
  const data = (load(yamlBlock) ?? {}) as T;

  return { data, content };
}

export function stringifyFrontmatter<T>(data: T, content: string): string {
  const yamlBlock = dump(data).trimEnd();
  return `${DELIMITER}\n${yamlBlock}\n${DELIMITER}\n\n${content}`;
}
