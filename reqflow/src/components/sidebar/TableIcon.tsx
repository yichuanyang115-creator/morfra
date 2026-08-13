import { normalizeTableEmoji } from "../../lib/tableEmojiCatalog";

export function TableIcon({ emoji, className }: { emoji: string | undefined; className?: string }) {
  return <span className={className} aria-hidden="true">{normalizeTableEmoji(emoji)}</span>;
}

export function NewTableIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
    <rect x="2.5" y="3" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M2.5 7.5h12M7 3v12M15.5 12v5M13 14.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>;
}
