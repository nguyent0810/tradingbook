import React from "react";

export function DashboardEntrance({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <div className="dash-cockpit-v11__entrance" data-testid="dashboard-entrance">
      {items.map((child, index) => (
        <div
          key={index}
          className="dash-cockpit-v11__entrance-item"
          style={{ ["--entrance-index" as const]: index }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
