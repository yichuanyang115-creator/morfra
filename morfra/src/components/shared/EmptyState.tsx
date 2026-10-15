interface EmptyStateProps {
  text: string;
}

export function EmptyState({ text }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-5 py-15 text-center text-(--module-scope-text-secondary)">
      <svg className="size-8 text-(--module-scope-border-strong)" viewBox="0 0 20 20" fill="none">
        <path
          d="M4 14.5V6a1 1 0 0 1 1-1h4l2 2h5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
      <p className="m-0 text-[13px]">{text}</p>
    </div>
  );
}
