import { exists, readTextFile } from "@tauri-apps/plugin-fs";
import { parseFrontmatter } from "../frontmatter";

export interface LegacyChatPreferenceCandidate {
  open?: boolean;
  width?: number;
}

export function parseLegacyChatPreference(raw: string): LegacyChatPreferenceCandidate | null {
  try {
    const { data } = parseFrontmatter<unknown>(raw);
    if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
    const source = data as Record<string, unknown>;
    const candidate: LegacyChatPreferenceCandidate = {};
    if (typeof source.open === "boolean") candidate.open = source.open;
    if (typeof source.width === "number" && Number.isFinite(source.width)) candidate.width = source.width;
    return Object.keys(candidate).length > 0 ? candidate : null;
  } catch {
    return null;
  }
}

/** 只读旧文件；调用方负责决定是否采用候选偏好。 */
export async function readLegacyChatPreference(path: string): Promise<LegacyChatPreferenceCandidate | null> {
  if (!(await exists(path))) return null;
  return parseLegacyChatPreference(await readTextFile(path));
}
