import React from "react";

/** Layout wrapper for dashboard zones (no extra runtime deps). */
export function DashboardEntrance({ children }: { children: React.ReactNode }) {
  return <div className="dash-entrance space-y-6">{children}</div>;
}
