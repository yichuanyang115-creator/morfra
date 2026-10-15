import englishEmojiData from "emojibase-data/en/compact.json";
import chineseEmojiData from "emojibase-data/zh/compact.json";

export const DEFAULT_TABLE_EMOJI = "📋";

interface CompactEmojiRecord {
  group?: number;
  hexcode: string;
  label: string;
  order?: number;
  tags?: string[];
  unicode: string;
  skins?: CompactEmojiRecord[];
}

export interface TableEmojiOption {
  emoji: string;
  label: string;
  keywords: string;
  variants?: TableEmojiOption[];
}

const APPLICATION_SEARCH_ALIASES: Record<string, string[]> = {
  "1F4CB": ["表格", "清单", "默认"],
  "1F680": ["发布", "上线", "启动"],
};

export interface TableEmojiCategory {
  id: string;
  label: string;
  symbol: string;
  options: TableEmojiOption[];
}

const CATEGORY_META = [
  { group: 0, id: "smileys-emotion", label: "笑脸与情绪", symbol: "😀" },
  { group: 1, id: "people-body", label: "人物与身体", symbol: "👋" },
  { group: 3, id: "animals-nature", label: "动物与自然", symbol: "🐻" },
  { group: 4, id: "food-drink", label: "食物与饮料", symbol: "🍔" },
  { group: 5, id: "travel-places", label: "旅行与地点", symbol: "🚗" },
  { group: 6, id: "activities", label: "活动", symbol: "⚽" },
  { group: 7, id: "objects", label: "物品", symbol: "💡" },
  { group: 8, id: "symbols", label: "符号", symbol: "❤️" },
  { group: 9, id: "flags", label: "旗帜", symbol: "🏳️" },
] as const;

const englishByHexcode = new Map(
  (englishEmojiData as CompactEmojiRecord[]).map((emoji) => [emoji.hexcode, emoji]),
);

function toOption(emoji: CompactEmojiRecord): TableEmojiOption {
  const english = englishByHexcode.get(emoji.hexcode);
  const terms = [
    emoji.label,
    ...(emoji.tags ?? []),
    english?.label ?? "",
    ...(english?.tags ?? []),
    ...(APPLICATION_SEARCH_ALIASES[emoji.hexcode] ?? []),
  ].filter(Boolean);
  return {
    emoji: emoji.unicode,
    label: emoji.label,
    keywords: Array.from(new Set(terms)).join(" ").toLocaleLowerCase(),
  };
}

const chineseRecords = chineseEmojiData as CompactEmojiRecord[];

function optionsForGroup(group: number): TableEmojiOption[] {
  return chineseRecords
    .filter((emoji) => emoji.group === group)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map((emoji) => {
      const option = toOption(emoji);
      const variants = emoji.skins?.map(toOption);
      return variants?.length ? { ...option, variants } : option;
    });
}

export const TABLE_EMOJI_CATEGORIES: TableEmojiCategory[] = CATEGORY_META.map((category) => ({
  id: category.id,
  label: category.label,
  symbol: category.symbol,
  options: optionsForGroup(category.group),
}));

export const ALL_TABLE_EMOJIS = TABLE_EMOJI_CATEGORIES.flatMap((category) =>
  category.options.flatMap((option) => [option, ...(option.variants ?? [])]),
);

export function tableEmojiKey(emoji: string): string {
  return emoji.replace(/\uFE0F/g, "");
}

const tableEmojiByValue = new Map(
  ALL_TABLE_EMOJIS.map((option) => [tableEmojiKey(option.emoji), option]),
);

export function tableEmojiOption(emoji: string): TableEmojiOption | undefined {
  return tableEmojiByValue.get(tableEmojiKey(emoji));
}

export function isKnownTableEmoji(emoji: string): boolean {
  return tableEmojiByValue.has(tableEmojiKey(emoji));
}

export function searchTableEmojis(query: string): TableEmojiOption[] {
  const normalized = query.trim().toLocaleLowerCase();
  return normalized ? ALL_TABLE_EMOJIS.filter((option) => option.keywords.includes(normalized)) : [];
}

export function normalizeTableEmoji(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length <= 32 ? normalized : DEFAULT_TABLE_EMOJI;
}
