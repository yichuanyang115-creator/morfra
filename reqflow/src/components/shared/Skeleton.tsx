export function Skeleton() {
  return (
    <div className="flex flex-col gap-3 p-5.5">
      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="flex flex-col gap-1.5">
          <div className="h-8 max-w-(--board-row-max-w) animate-pulse rounded-(--r-lg) bg-(--surface-2)" />
          {Array.from({ length: 2 }).map((_, rowIndex) => (
            <div key={rowIndex} className="h-9 max-w-(--board-row-max-w) animate-pulse rounded bg-(--surface-2)" />
          ))}
        </div>
      ))}
    </div>
  );
}
