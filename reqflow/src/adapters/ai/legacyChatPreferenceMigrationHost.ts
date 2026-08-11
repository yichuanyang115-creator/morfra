import { exists } from "@tauri-apps/plugin-fs";
import { readLegacyChatPreference, type LegacyChatPreferenceCandidate } from "../../lib/ai/legacyChatMigration";
import { aiPreferencesPath } from "../../lib/ai/paths";
import { chatStatePath } from "../../lib/paths";

/**
 * 旧 Markdown 工作区的宿主迁移入口。新偏好已存在时绝不覆盖；迁移只返回 open/width 候选，
 * 写入仍由 AI 偏好 Store 完成。
 */
export async function findLegacyChatPreferenceMigration(projectId: string): Promise<LegacyChatPreferenceCandidate | null> {
  if (await exists(await aiPreferencesPath())) return null;
  return readLegacyChatPreference(await chatStatePath(projectId));
}
