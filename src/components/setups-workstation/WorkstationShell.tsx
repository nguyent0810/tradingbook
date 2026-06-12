import type { WorkstationShellProps } from "./types";
import "./setups-workstation.css";

export function WorkstationShell({
  header,
  pipeline,
  overview,
  main,
  aside,
  tail,
  momentum,
}: WorkstationShellProps) {
  return (
    <div className="sw-root space-y-4">
      {header}

      <div className="space-y-4">
        {pipeline}
        {overview}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <div className="min-w-0">{main}</div>
          <div className="min-w-0">{aside}</div>
        </div>

        {tail}
        {momentum}
      </div>
    </div>
  );
}
