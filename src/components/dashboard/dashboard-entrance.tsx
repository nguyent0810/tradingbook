import type { ReactNode } from "react";
import { CommandDeckEntrance } from "@/components/command-deck";

export function DashboardEntrance({ children }: { children: ReactNode }) {
  return (
    <CommandDeckEntrance stagger testId="dashboard-entrance">
      {children}
    </CommandDeckEntrance>
  );
}
