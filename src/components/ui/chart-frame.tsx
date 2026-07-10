import type { ReactNode } from "react";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

export type ChartFrameHeight = "sparkline" | "compact" | "default" | number;

const PRESET_HEIGHT: Record<Exclude<ChartFrameHeight, number>, number> = {
  sparkline: 60,
  compact: 200,
  default: 350,
};

function resolveHeight(height: ChartFrameHeight): number {
  return typeof height === "number" ? height : PRESET_HEIGHT[height];
}

export type ChartFrameProps = {
  title?: string;
  titleId?: string;
  description?: string;
  testId?: string;
  height?: ChartFrameHeight;
  state?: "ready" | "empty" | "loading" | "error";
  emptyMessage?: string;
  errorMessage?: string;
  children?: ReactNode;
  className?: string;
};

/**
 * Responsive Recharts host with explicit plot height (avoids width/height -1 warnings).
 */
export function ChartFrame({
  title,
  titleId,
  description,
  testId,
  height = "default",
  state = "ready",
  emptyMessage = "No data to chart yet.",
  errorMessage = "Chart could not be loaded.",
  children,
  className = "",
}: ChartFrameProps) {
  const plotHeight = resolveHeight(height);
  const headingId = titleId ?? (title ? `${testId ?? "chart"}-title` : undefined);

  return (
    <figure
      className={`chart-frame chart-frame--${typeof height === "string" ? height : "custom"} ${className}`.trim()}
      data-testid={testId}
      aria-labelledby={headingId}
      style={{ ["--chart-frame-height" as string]: `${plotHeight}px` }}
    >
      {title ? (
        <figcaption className="chart-frame__header">
          <h3 id={headingId} className="chart-frame__title">
            {title}
          </h3>
          {description ? <p className="chart-frame__description">{description}</p> : null}
        </figcaption>
      ) : description ? (
        <p className="chart-frame__description chart-frame__description--solo">{description}</p>
      ) : null}

      <div
        className="chart-frame__plot"
        role={state === "ready" ? undefined : "status"}
        aria-live={state === "loading" ? "polite" : undefined}
        style={{ height: plotHeight, minHeight: plotHeight }}
      >
        {state === "loading" ? (
          <LoadingSkeleton
            className="chart-frame__skeleton"
            height={plotHeight}
            aria-label="Loading chart"
          />
        ) : state === "empty" ? (
          <p className="chart-frame__state-message">{emptyMessage}</p>
        ) : state === "error" ? (
          <p className="chart-frame__state-message chart-frame__state-message--error" role="alert">
            {errorMessage}
          </p>
        ) : (
          children
        )}
      </div>
    </figure>
  );
}
