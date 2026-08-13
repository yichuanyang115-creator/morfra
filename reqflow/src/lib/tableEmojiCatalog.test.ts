import { describe, expect, it } from "vitest";
import { ALL_TABLE_EMOJIS, searchTableEmojis, TABLE_EMOJI_CATEGORIES } from "./tableEmojiCatalog";

describe("tableEmojiCatalog", () => {
  it("covers the Unicode 17 catalog including smileys, flags, and skin tones", () => {
    expect(TABLE_EMOJI_CATEGORIES).toHaveLength(9);
    expect(ALL_TABLE_EMOJIS.length).toBeGreaterThan(3900);
    expect(ALL_TABLE_EMOJIS.some((option) => option.emoji === "😀")).toBe(true);
    expect(ALL_TABLE_EMOJIS.some((option) => option.emoji === "👍🏿")).toBe(true);
    expect(ALL_TABLE_EMOJIS.some((option) => option.emoji === "🇨🇳")).toBe(true);
    const people = TABLE_EMOJI_CATEGORIES.find((category) => category.id === "people-body");
    expect(people?.options.length).toBeLessThan(500);
    expect(people?.options.some((option) => option.variants?.some((variant) => variant.emoji === "👍🏿"))).toBe(true);
  });

  it("searches with both Chinese and English CLDR terms", () => {
    expect(searchTableEmojis("笑哭").some((option) => option.emoji.startsWith("😂"))).toBe(true);
    expect(searchTableEmojis("rocket").some((option) => option.emoji.startsWith("🚀"))).toBe(true);
  });
});
