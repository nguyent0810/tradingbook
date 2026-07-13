"use client";

import { motion, useReducedMotion } from "framer-motion";

type Props = {
  active: boolean;
};

export function PipelineConnector({ active }: Props) {
  const reducedMotion = useReducedMotion() ?? false;

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
        {active && !reducedMotion ? (
          <motion.circle
            r="2.5"
            fill="#6366f1"
            initial={{ offsetDistance: "0%" }}
            animate={{ offsetDistance: "100%" }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
            style={{
              offsetPath: 'path("M2 8 L28 8")',
              filter: "drop-shadow(0 0 4px rgba(99,102,241,0.8))",
            }}
          />
        ) : null}
      </svg>
    </div>
  );
}
