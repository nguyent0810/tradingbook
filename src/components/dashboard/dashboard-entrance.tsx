import type { CSSProperties, ReactNode } from "react";
import React from "react";

type EntranceStyle = CSSProperties & {
  "--entrance-index"?: number;
};

export function DashboardEntrance({ children }: { children: ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <div className="dash-cockpit-v2__entrance" data-testid="dashboard-entrance">
      {items.map((child, index) => {
        const style: EntranceStyle = { "--entrance-index": index };
        return (
          <div
            key={index}
            className="dash-cockpit-v2__entrance-item"
            style={style}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
