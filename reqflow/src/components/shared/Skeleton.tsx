export function Skeleton() {
  return (
    <div className="theme-module-feedback min-h-full bg-(--module-scope-background-canvas) flex flex-col gap-3 p-5.5">
      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="flex flex-col gap-1.5">
          <div className="h-8 max-w-[776px] animate-pulse rounded-(--r-lg) bg-(--module-scope-background-elevated)" />
          {Array.from({ length: 2 }).map((_, rowIndex) => (
            <div key={rowIndex} className="h-9 max-w-[776px] animate-pulse rounded bg-(--module-scope-background-elevated)" />
          ))}
        </div>
      ))}
    </div>
  );
}
