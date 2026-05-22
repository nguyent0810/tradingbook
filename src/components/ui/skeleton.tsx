export type SkeletonProps = {
  className?: string;
  variant?: "text" | "rect" | "circle";
};

export function Skeleton({
  className = "",
  variant = "rect",
}: SkeletonProps) {
  const shape =
    variant === "circle"
      ? "rounded-full"
      : variant === "text"
        ? "h-4 w-full rounded"
        : "rounded-md";
  return <div className={`skeleton ${shape} ${className}`.trim()} aria-hidden />;
}

export function SkeletonTableRows({ rows = 4, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
