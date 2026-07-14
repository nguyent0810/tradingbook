"use client";

import dynamic from "next/dynamic";

const PipelineConnectorDot = dynamic(
  () => import("./PipelineConnectorDot").then((m) => m.PipelineConnectorDot),
  { ssr: false }
);

type Props = {
  active: boolean;
};

/** Static connector line renders immediately; the animated dot (framer-motion) loads lazily and only when active. */
export function PipelineConnector({ active }: Props) {
  return (
    <div className="relative flex h-8 w-10 shrink-0 items-center justify-center" aria-hidden>
      <svg width="40" height="16" viewBox="0 0 40 16" className="overflow-visible">
        <defs>
          <linearGradient id="sw-pipe-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(100,116,139,0.2)" />
            <stop offset="50%" stopColor="rgba(99,102,241,0.45)" />
            <stop offset="100%" stopColor="rgba(100,116,139,0.2)" />
          </linearGradient>
        </defs>
        <path
          d="M2 8 L28 8 L34 4 M28 8 L34 12"
          fill="none"
          stroke="url(#sw-pipe-grad)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {active ? <PipelineConnectorDot /> : null}
      </svg>
    </div>
  );
}
