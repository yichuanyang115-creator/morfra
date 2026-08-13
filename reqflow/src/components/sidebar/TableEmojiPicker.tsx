import { useMemo, useState, type KeyboardEvent } from "react";
import { DEFAULT_TABLE_EMOJI, searchTableEmojis, TABLE_EMOJI_CATEGORIES, tableEmojiKey, tableEmojiOption } from "../../lib/tableEmojiCatalog";
import { loadRecentTableEmojis } from "../../lib/tableEmojiPreferences";

interface Props {
  currentEmoji: string;
  onSelect: (emoji: string) => void;
}

export function TableEmojiPicker({ currentEmoji, onSelect }: Props) {
  const recents = useMemo(loadRecentTableEmojis, []);
  const [categoryId, setCategoryId] = useState(recents.length ? "recent" : TABLE_EMOJI_CATEGORIES[0]?.id ?? "smileys-emotion");
  const [query, setQuery] = useState("");
  const [variantBase, setVariantBase] = useState<ReturnType<typeof tableEmojiOption>>();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = useMemo(() => {
    if (normalizedQuery) return searchTableEmojis(normalizedQuery);
    if (categoryId === "recent") return recents.map((emoji) => tableEmojiOption(emoji) ?? ({ emoji, label: emoji, keywords: "最近使用" }));
    return TABLE_EMOJI_CATEGORIES.find((category) => category.id === categoryId)?.options ?? [];
  }, [categoryId, normalizedQuery, recents]);

  function moveGridFocus(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button[data-emoji]") ?? []);
    const current = buttons.indexOf(event.currentTarget);
    const columns = 10;
    const next = event.key === "Home" ? 0
      : event.key === "End" ? buttons.length - 1
      : event.key === "ArrowLeft" ? Math.max(0, current - 1)
      : event.key === "ArrowRight" ? Math.min(buttons.length - 1, current + 1)
      : event.key === "ArrowUp" ? Math.max(0, current - columns)
      : Math.min(buttons.length - 1, current + columns);
    buttons[next]?.focus();
  }

  function chooseOption(option: NonNullable<ReturnType<typeof tableEmojiOption>>) {
    if (option.variants?.length) {
      setVariantBase(option);
      return;
    }
    onSelect(option.emoji);
  }

  return <div className="morfra-table-emoji-picker">
    <label className="morfra-table-emoji-search">
      <span className="sr-only">搜索 Emoji</span>
      <input autoFocus type="search" value={query} onChange={(event) => { setQuery(event.target.value); setVariantBase(undefined); }} placeholder="搜索 Emoji" />
    </label>
    {!normalizedQuery && <div className="morfra-table-emoji-categories" role="tablist" aria-label="Emoji 分类">
      {recents.length > 0 && <button type="button" role="tab" aria-selected={categoryId === "recent"} title="最近使用" onClick={() => { setCategoryId("recent"); setVariantBase(undefined); }}>🕘</button>}
      {TABLE_EMOJI_CATEGORIES.map((category) => <button key={category.id} type="button" role="tab" aria-selected={categoryId === category.id} title={category.label} aria-label={category.label} onClick={() => { setCategoryId(category.id); setVariantBase(undefined); }}>{category.symbol}</button>)}
    </div>}
    {variantBase?.variants?.length && <div className="morfra-table-emoji-variants" role="group" aria-label={`${variantBase.label}肤色变体`}>
      {[variantBase, ...variantBase.variants].map((option) => <button key={option.emoji} type="button" title={option.label} aria-label={option.label} aria-pressed={tableEmojiKey(currentEmoji) === tableEmojiKey(option.emoji)} onClick={() => onSelect(option.emoji)}>{option.emoji}</button>)}
    </div>}
    <div className="morfra-table-emoji-grid" role="grid" aria-label={normalizedQuery ? "Emoji 搜索结果" : "选择表 Emoji"}>
      {visible.map((option) => <button key={option.emoji} type="button" role="gridcell" data-emoji={option.emoji} title={option.variants?.length ? `${option.label}（含肤色变体）` : option.label} aria-label={option.variants?.length ? `${option.label}，选择肤色变体` : option.label} aria-haspopup={option.variants?.length ? "true" : undefined} aria-selected={tableEmojiKey(currentEmoji) === tableEmojiKey(option.emoji)} onKeyDown={moveGridFocus} onClick={() => chooseOption(option)}>{option.emoji}</button>)}
      {!visible.length && <p>没有找到匹配的 Emoji</p>}
    </div>
    <button type="button" className="morfra-table-emoji-reset" onClick={() => onSelect(DEFAULT_TABLE_EMOJI)}>重置为默认 <span aria-hidden="true">{DEFAULT_TABLE_EMOJI}</span></button>
  </div>;
}
