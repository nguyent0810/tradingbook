"use client";

import { motion, useReducedMotion } from "framer-motion";

/** The animated traveling dot on a pipeline connector — split out so framer-motion only loads when a connector is actually active. */
export function PipelineConnectorDot() {
  const reducedMotion = useReducedMotion() ?? false;
  if (reducedMotion) return null;

  return (
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
  );
}
