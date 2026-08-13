import { beforeEach, describe, expect, it } from "vitest";
import { loadRecentTableEmojis, recordRecentTableEmoji, TABLE_EMOJI_RECENTS_KEY } from "./tableEmojiPreferences";

describe("tableEmojiPreferences", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps recent Emoji across projects in one application preference", () => {
    recordRecentTableEmoji("🚀");
    recordRecentTableEmoji("🎯");
    recordRecentTableEmoji("🚀");
    expect(loadRecentTableEmojis()).toEqual(["🚀", "🎯"]);
  });

  it("ignores malformed and unknown preference values", () => {
    window.localStorage.setItem(TABLE_EMOJI_RECENTS_KEY, JSON.stringify(["not-an-emoji", "📋", 42]));
    expect(loadRecentTableEmojis()).toEqual(["📋"]);
    window.localStorage.setItem(TABLE_EMOJI_RECENTS_KEY, "{");
    expect(loadRecentTableEmojis()).toEqual([]);
  });
});
