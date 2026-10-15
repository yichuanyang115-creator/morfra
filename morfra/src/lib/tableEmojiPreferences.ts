import { isKnownTableEmoji, tableEmojiKey } from "./tableEmojiCatalog";

export const TABLE_EMOJI_RECENTS_KEY = "morfra.table-emoji-recents.v1";
const MAX_RECENTS = 16;

export function loadRecentTableEmojis(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(TABLE_EMOJI_RECENTS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string" && isKnownTableEmoji(value)).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function recordRecentTableEmoji(emoji: string): string[] {
  const recent = [
    emoji,
    ...loadRecentTableEmojis().filter((value) => tableEmojiKey(value) !== tableEmojiKey(emoji)),
  ].slice(0, MAX_RECENTS);
  try {
    window.localStorage.setItem(TABLE_EMOJI_RECENTS_KEY, JSON.stringify(recent));
  } catch {
    // 偏好写入失败不应阻断表 Emoji 的数据库保存。
  }
  return recent;
}
