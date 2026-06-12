"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { WireAnchor } from "../types";

type Props = {
  anchors: WireAnchor[];
  coreCenter: { x: number; y: number } | null;
  wirePhase: number;
  bootComplete: boolean;
  width: number;
  height: number;
};

function buildPath(
  from: { x: number; y: number },
  to: { x: number; y: number }
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const cx1 = from.x + dx * 0.35;
  const cy1 = from.y;
  const cx2 = to.x - dx * 0.35;
  const cy2 = to.y;
  return `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`;
}

export function DataFlowLayer({
  anchors,
  coreCenter,
  wirePhase,
  bootComplete,
  width,
  height,
}: Props) {
  const reducedMotion = useReducedMotion();

  if (!coreCenter || width <= 0 || height <= 0) return null;

  return (
    <svg
      className="ccd-wire-layer"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <defs>
        <linearGradient id="ccd-wire-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(0, 240, 255, 0.15)" />
          <stop offset="50%" stopColor="rgba(0, 240, 255, 0.85)" />
          <stop offset="100%" stopColor="rgba(16, 185, 129, 0.4)" />
        </linearGradient>
      </defs>

      {anchors.map((anchor, index) => {
        const d = buildPath(coreCenter, { x: anchor.x, y: anchor.y });
        const dashLength = 12;
        const gap = 8;

        return (
          <g key={anchor.id}>
            <path
              d={d}
              fill="none"
              stroke="rgba(0, 240, 255, 0.06)"
              strokeWidth="1.5"
            />
            <motion.path
              className="ccd-wire-path"
              d={d}
              fill="none"
              stroke="url(#ccd-wire-grad)"
              strokeWidth="1"
              strokeLinecap="round"
              strokeDasharray={`${dashLength} ${gap}`}
              initial={
                reducedMotion
                  ? { pathLength: 1, opacity: 0.35 }
                  : { pathLength: 0, opacity: 0 }
              }
              animate={
                reducedMotion
                  ? { pathLength: 1, opacity: 0.35 }
                  : {
                      pathLength: bootComplete ? 1 : 0,
                      opacity: bootComplete ? 0.45 : 0,
                    }
              }
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : {
                      pathLength: { duration: 0.8, delay: index * 0.12, ease: "easeOut" },
                      opacity: { duration: 0.4, delay: index * 0.12 },
                    }
              }
              style={
                reducedMotion
                  ? { strokeDashoffset: 0 }
                  : {
                      strokeDashoffset: -(wirePhase + index * 6),
                      animation: "ccd-wire-flow 1.2s linear infinite",
                      animationDelay: `${index * 0.15}s`,
                    }
              }
            />
          </g>
        );
      })}
    </svg>
  );
}
